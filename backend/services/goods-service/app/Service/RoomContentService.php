<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

final class RoomContentService
{
    public const JSON_FIELDS = ['images', 'facilities', 'bedding', 'image_gallery', 'panorama', 'vr_tour', 'floor_plan', 'refund_policy'];

    public static function unpack(array $row): array
    {
        foreach (self::JSON_FIELDS as $key) {
            if (is_string($row[$key] ?? null)) $row[$key] = json_decode($row[$key], true) ?? [];
        }
        return $row;
    }

    public static function siteCurrency(int $siteId): string
    {
        $currency = strtoupper((string) Db::connection('system')->table('sys_site')->where('id', $siteId)->whereNull('deleted_at')->value('currency'));
        if (! preg_match('/^[A-Z]{3}$/D', $currency)) self::invalid('所属站点尚未配置有效币种');
        return $currency;
    }

    public function normalize(array $data, array $property, bool $submit, array $legacy = []): array
    {
        $data = self::unpack($data);
        $legacy = self::unpack($legacy);
        $currency = self::siteCurrency((int) $property['site_id']);
        if (! empty($data['currency']) && strtoupper($data['currency']) !== $currency) self::invalid('币种必须与商户所属站点一致');
        if (! empty($legacy['currency']) && $legacy['currency'] !== $currency) self::invalid('存量房型币种与站点不一致，请先核对金额');
        $data['currency'] = $currency;
        if (mb_strlen((string) ($data['room_name'] ?? '')) > 100) self::invalid('房型名称不能超过 100 个字符');
        if (trim((string) ($data['room_name'] ?? '')) === '') self::invalid('请填写房型名称');
        foreach (['base_price', 'weekend_price', 'extra_bed_price'] as $key) {
            if (! is_numeric($data[$key] ?? 0) || (float) ($data[$key] ?? 0) < 0 || (float) ($data[$key] ?? 0) > 99999999.99) self::invalid('价格超出有效范围');
        }
        foreach (['base_stock', 'launch_stock', 'max_adults', 'max_children', 'max_guests', 'bed_count'] as $key) {
            $value = $data[$key] ?? 0;
            $max = in_array($key, ['base_stock', 'launch_stock'], true) ? 65535 : 127;
            if (! is_numeric($value) || (int) $value != $value || $value < 0 || $value > $max) self::invalid('数量必须为有效非负整数');
        }
        if (($data['launch_stock'] ?? 0) > ($data['base_stock'] ?? 0)) self::invalid('默认可售配额不能超过实体房间总数');
        if (($data['max_guests'] ?? 0) < max((int) ($data['max_adults'] ?? 0), (int) ($data['max_children'] ?? 0))) self::invalid('总入住人数不能少于成人或儿童上限');
        if ($submit && (($data['max_guests'] ?? 0) < 1 || ($data['max_adults'] ?? 0) < 1)) self::invalid('请设置有效入住容量');
        $area = (string) ($data['area'] ?? '');
        if (($area !== '' || $submit) && (! is_numeric($area) || (float) $area <= 0 || (float) $area > 100000)) self::invalid('请填写有效的平方米面积');
        if (! in_array($data['area_unit'] ?? 'sqm', ['sqm', 'sqft'], true)) self::invalid('面积单位不支持');
        $beds = $data['bedding'] ?? [];
        if (! is_array($beds) || count($beds) > 20) self::invalid('床型配置不正确');
        foreach ($beds as $bed) {
            if (! is_array($bed) || trim((string) ($bed['type'] ?? '')) === '' || mb_strlen($bed['type']) > 50 || ! is_numeric($bed['quantity'] ?? null) || (int) $bed['quantity'] != $bed['quantity'] || $bed['quantity'] < 1 || $bed['quantity'] > 100) self::invalid('请填写床型和有效数量');
        }
        if ($beds) {
            $data['bed_type'] = mb_substr(implode(' + ', array_column($beds, 'type')), 0, 50);
            $data['bed_count'] = array_sum(array_column($beds, 'quantity'));
            if ($data['bed_count'] > 127) self::invalid('单个房型配置的床铺总数不能超过 127');
        }
        if ($submit && trim((string) ($data['bed_type'] ?? '')) === '') self::invalid('请设置床型');
        $gallery = $data['image_gallery'] ?? null;
        if ($gallery !== null) {
            if (! is_array($gallery) || count($gallery) > 10) self::invalid('房型最多上传 10 张图片');
            foreach ($gallery as $image) {
                if (! is_array($image) || ! is_string($image['url'] ?? null) || $image['url'] === '' || ! in_array($image['category'] ?? '', ['bedroom', 'bathroom', 'view', 'other'], true)) self::invalid('请选择有效图片分类');
            }
            $data['images'] = array_column($gallery, 'url');
        }
        $images = $data['images'] ?? [];
        if (! is_array($images) || count(array_filter($images, 'is_string')) !== count($images) || count($images) > 10 || count(array_unique($images)) !== count($images)) self::invalid('图片最多 10 张且不能重复');
        if ($submit && ! $images) self::invalid('提交审核前至少上传一张房型图片');
        foreach ($images as $url) $this->media($url, 'image', $property, $legacy['images'] ?? []);
        $this->media($data['video_url'] ?? '', 'video', $property, [$legacy['video_url'] ?? '']);
        $panorama = $data['panorama'] ?? [];
        $vr = $data['vr_tour'] ?? [];
        $floor = $data['floor_plan'] ?? [];
        foreach ([$panorama, $vr, $floor] as $config) {
            if (! is_array($config) || (isset($config['enabled']) && ! is_bool($config['enabled']))) self::invalid('媒体配置格式不正确');
        }
        if (! empty($panorama['enabled']) && empty($panorama['url'])) self::invalid('请上传本地 360 全景图');
        $this->media($panorama['url'] ?? '', 'panorama', $property);
        if (! empty($vr['enabled'])) self::invalid('外部 VR 服务商尚未接入，暂不能启用');
        $url = $vr['url'] ?? '';
        if ($url !== '' && (! is_string($url) || strlen($url) > 2000 || ! filter_var($url, FILTER_VALIDATE_URL) || parse_url($url, PHP_URL_SCHEME) !== 'https' || parse_url($url, PHP_URL_USER) !== null || parse_url($url, PHP_URL_PASS) !== null)) self::invalid('外部 VR 地址须为有效 HTTPS 地址');
        $this->media($vr['cover'] ?? '', 'vr_cover', $property);
        $this->media($floor['image'] ?? '', 'floorplan', $property);
        if (! empty($floor['enabled']) && empty($floor['image'])) self::invalid('请上传平面图');
        $pins = $floor['hotspots'] ?? [];
        if (! is_array($pins) || count($pins) > 50) self::invalid('平面图最多设置 50 个热点');
        $ids = [];
        foreach ($pins as $pin) {
            if (! is_array($pin) || empty($pin['id']) || in_array($pin['id'], $ids, true) || empty(trim((string) ($pin['title'] ?? ''))) || mb_strlen($pin['title']) > 80 || mb_strlen($pin['description'] ?? '') > 500) self::invalid('热点需要唯一标识、标题和有效说明');
            $ids[] = $pin['id'];
            foreach (['x', 'y'] as $axis) if (! is_numeric($pin[$axis] ?? null) || $pin[$axis] < 0 || $pin[$axis] > 1) self::invalid('热点位置必须位于平面图内');
            $this->media($pin['image'] ?? '', 'closeup', $property);
        }
        $facilities = $data['facilities'] ?? [];
        if (! is_array($facilities) || count($facilities) > 100) self::invalid('客房设施格式不正确');
        foreach ($facilities as $item) if (! is_string($item) || mb_strlen($item) > 80) self::invalid('客房设施名称不正确');
        $meal = $data['meal_plan'] ?? '';
        if (in_array($meal, ['room_only', 'breakfast', 'half_board', 'full_board', 'all_inclusive'], true)) {
            $data['breakfast'] = $meal === 'room_only' ? 0 : 1;
        }
        $policy = $data['refund_policy'] ?? null;
        if ($policy) {
            if (! is_array($policy) || ! in_array($policy['ruleType'] ?? null, [1, 2, 3], true)) self::invalid('取消政策类型不正确');
            $rules = $policy['rules'] ?? [];
            if (! is_array($rules) || count($rules) > 20 || ($policy['ruleType'] === 2 && ! $rules)) self::invalid('请配置阶梯退款规则');
            $hours = [];
            foreach ($rules as $rule) {
                if (! is_array($rule) || ! is_numeric($rule['hours_before'] ?? null) || (int) $rule['hours_before'] != $rule['hours_before'] || $rule['hours_before'] < 0 || $rule['hours_before'] > 8760 || in_array($rule['hours_before'], $hours) || ! is_numeric($rule['refund_rate'] ?? null) || $rule['refund_rate'] < 0 || $rule['refund_rate'] > 100) self::invalid('退款阶梯须为不同的提前小时数，退款比例为 0–100%');
                $hours[] = $rule['hours_before'];
            }
            if ($policy['ruleType'] === 2 && ! in_array(0, $hours)) self::invalid('阶梯规则必须明确提前 0 小时的退款比例');
            if (mb_strlen((string) ($policy['remark'] ?? '')) > 500) self::invalid('取消政策说明过长');
            $data['cancellation_policy'] = mb_substr((string) ($policy['remark'] ?? ''), 0, 255);
        }
        foreach (self::JSON_FIELDS as $key) {
            if (array_key_exists($key, $data)) $data[$key] = $data[$key] === null ? null : json_encode($data[$key], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        return $data;
    }

    private function media(mixed $url, string $kind, array $property, array $legacy = []): void
    {
        if ($url === '') return;
        if (! is_string($url) || strlen($url) > 255) self::invalid('媒体地址不正确');
        if (in_array($url, $legacy, true)) return;
        if (! Db::table('hotel_room_media')->where('url', $url)->where('kind', $kind)->where('site_id', $property['site_id'])->where('property_id', $property['id'])->exists()) self::invalid('请使用当前物业上传的有效媒体文件');
    }

    public static function invalid(string $message): never
    {
        throw new BusinessException(ErrorCode::PARAM_ERROR, $message);
    }
}
