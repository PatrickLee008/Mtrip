<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

/**
 * 酒店附加服务的唯一规则实现(商户端保存归一化 + 订单计价共用,改一处即两处生效)。
 *
 * 服务项固定 7 个(KEYS),商户逐项开关、填价格、选计价方式;配置存 merchant_store.addons,
 * 随物业资料审核发布。计价方式可多选,金额 = 单价 × 人数(person)× 晚数(night)× 间数(room),
 * 都不选 = 按次收一次。附加服务不参与优惠券与长住折扣,取消时全额退(见 order-service 退款试算)。
 */
final class HotelAddons
{
    public const KEYS = ['breakfast', 'airport_transfer', 'spa', 'laundry', 'room_service', 'extra_bed', 'late_checkout'];

    public const UNITS = ['person', 'night', 'room'];

    /** 单价上限,与房价同口径 */
    public const MAX_PRICE = 99999999.99;

    /**
     * 商户提交的配置 → 固定 7 项、顺序固定的规范结构。未提交的项补成停用;
     * 启用的项价格须 > 0。$strict=false 用于读取存量数据(不抛错,非法值按停用处理)。
     *
     * @return list<array{key:string,enabled:bool,price:float,units:list<string>,description:string}>
     */
    public static function normalize(mixed $value, bool $strict = true): array
    {
        if (is_string($value)) $value = json_decode($value, true);
        $byKey = [];
        foreach (is_array($value) ? $value : [] as $row) {
            if (is_array($row) && is_string($row['key'] ?? null)) $byKey[$row['key']] = $row;
        }
        if ($strict) {
            foreach (array_keys($byKey) as $key) {
                if (! in_array($key, self::KEYS, true)) throw new \InvalidArgumentException('不支持的附加服务:' . $key);
            }
        }
        $result = [];
        foreach (self::KEYS as $key) {
            $row = $byKey[$key] ?? [];
            $enabled = filter_var($row['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $price = $row['price'] ?? 0;
            $validPrice = is_numeric($price) && (float) $price >= 0 && (float) $price <= self::MAX_PRICE;
            if ($strict && ! $validPrice) throw new \InvalidArgumentException('附加服务价格超出有效范围');
            $price = $validPrice ? round((float) $price, 2) : 0.0;
            $units = [];
            foreach (is_array($row['units'] ?? null) ? $row['units'] : [] as $unit) {
                if (in_array($unit, self::UNITS, true) && ! in_array($unit, $units, true)) $units[] = $unit;
            }
            usort($units, static fn ($a, $b) => array_search($a, self::UNITS, true) <=> array_search($b, self::UNITS, true));
            if ($enabled && $price <= 0) {
                if ($strict) throw new \InvalidArgumentException('启用的附加服务须填写大于 0 的价格');
                $enabled = false;
            }
            $result[] = [
                'key' => $key,
                'enabled' => $enabled,
                'price' => $price,
                'units' => $units,
                'description' => mb_substr(trim((string) ($row['description'] ?? '')), 0, 200),
            ];
        }
        return $result;
    }

    /** 已启用的项(C 端展示与下单只认这些) */
    public static function enabled(mixed $value): array
    {
        return array_values(array_filter(self::normalize($value, false), static fn (array $row) => $row['enabled']));
    }

    /** 单项金额:单价 × 选中计价维度的乘积 */
    public static function amount(array $addon, int $guests, int $nights, int $rooms): float
    {
        $factor = 1;
        foreach ($addon['units'] as $unit) {
            $factor *= match ($unit) {
                'person' => max(1, $guests),
                'night' => max(1, $nights),
                'room' => max(1, $rooms),
                default => 1,
            };
        }
        return round((float) $addon['price'] * $factor, 2);
    }

    /**
     * 按用户选择计价。$keys 里出现未启用 / 不存在的项直接拒绝(价格可能已变,不能静默丢弃)。
     *
     * @return array{amount:float, items:list<array{key:string,price:float,units:list<string>,quantity:int,amount:float}>}
     */
    public static function quote(mixed $config, array $keys, int $guests, int $nights, int $rooms): array
    {
        $enabled = [];
        foreach (self::enabled($config) as $row) $enabled[$row['key']] = $row;
        $items = [];
        $total = 0.0;
        foreach (array_values(array_unique(array_map('strval', $keys))) as $key) {
            if (! isset($enabled[$key])) throw new \InvalidArgumentException('附加服务不可用或已下架:' . $key);
            $addon = $enabled[$key];
            $amount = self::amount($addon, $guests, $nights, $rooms);
            $items[] = [
                'key' => $key, 'price' => $addon['price'], 'units' => $addon['units'],
                'quantity' => (int) round($amount / max(0.01, $addon['price'])), 'amount' => $amount,
            ];
            $total = round($total + $amount, 2);
        }
        return ['amount' => $total, 'items' => $items];
    }
}
