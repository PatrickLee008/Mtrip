<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;

/** In-app is the only configured transport. Provider channels must never claim success. */
class MerchantNotificationService
{
    public const CHANNELS = ['inapp' => true, 'email' => false, 'sms' => false, 'push' => false];

    public function send(int $merchantId, array $input): array
    {
        $channels = $input['channels'] ?? [];
        if (! is_array($channels) || $channels === []) throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择发送渠道');
        foreach ($channels as $channel) {
            if (! is_string($channel) || ! array_key_exists($channel, self::CHANNELS)) throw new BusinessException(ErrorCode::PARAM_ERROR, '未知通知渠道');
            if (! self::CHANNELS[$channel]) throw new BusinessException(ErrorCode::DATA_CONFLICT, '外部通知服务商尚未配置，未发送任何渠道');
        }
        $request = (string) ($input['requestId'] ?? '');
        if (! preg_match('/^[A-Za-z0-9_-]{8,64}$/D', $request)) throw new BusinessException(ErrorCode::PARAM_ERROR, '缺少有效requestId');
        $category = (string) ($input['category'] ?? 'system');
        if (! in_array($category, ['booking', 'promotion', 'rewards', 'wallet', 'refund', 'account', 'security', 'support', 'system'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR);
        $title = trim((string) ($input['title'] ?? ''));
        $message = trim((string) ($input['message'] ?? ''));
        if ($title === '' || $message === '' || mb_strlen($title) > 200 || mb_strlen($message) > 1000) throw new BusinessException(ErrorCode::PARAM_ERROR, '标题或正文为空或超长');
        $sendType = (int) ($input['sendType'] ?? 1);
        if (! in_array($sendType, [1, 2], true)) throw new BusinessException(ErrorCode::PARAM_ERROR);
        $sendAt = null;
        if ($sendType === 2) {
            $raw = (string) ($input['sendAt'] ?? '');
            if (! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/D', $raw)) throw new BusinessException(ErrorCode::PARAM_ERROR, '定时发送必须带明确时区');
            try { $date = new \DateTimeImmutable($raw); } catch (\Throwable) { throw new BusinessException(ErrorCode::PARAM_ERROR); }
            $errors = \DateTimeImmutable::getLastErrors();
            if (($errors && ($errors['warning_count'] || $errors['error_count']))) throw new BusinessException(ErrorCode::PARAM_ERROR, '发送时间无效');
            $sendAt = $date->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        }
        $linkType = (string) ($input['deepLinkType'] ?? 'none');
        $linkValue = trim((string) ($input['deepLinkValue'] ?? ''));
        $templateId = (int) ($input['templateId'] ?? 0);
        $hash = hash('sha256', json_encode([$category, $title, $message, $linkType, $linkValue, $sendType, $sendAt, $templateId]));
        return Db::transaction(function () use ($merchantId, $request, $hash, $category, $title, $message, $sendType, $sendAt, $linkType, $linkValue, $templateId) {
            $merchant = Db::table('merchant_info')->where('id', $merchantId)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $merchant) throw new BusinessException(ErrorCode::NOT_FOUND);
            if (! AdminContext::isSuper() && (int) $merchant->site_id !== AdminContext::siteId()) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
            $old = Db::table('merchant_notify')->where('merchant_id', $merchantId)->where('request_id', $request)->first();
            if ($old) {
                if ($old->payload_hash !== $hash || (int) $old->operator_id !== AdminContext::adminId()) throw new BusinessException(ErrorCode::DATA_CONFLICT, '同一请求号内容不同');
                return $this->receipt((int) $old->id);
            }
            if ($sendType === 2 && $sendAt <= gmdate('Y-m-d H:i:s')) throw new BusinessException(ErrorCode::PARAM_ERROR, '定时发送必须为未来时间');
            if ($templateId > 0 && ! Db::table('notify_template')->where('id', $templateId)->where('status', 1)->whereIn('site_id', [0, $merchant->site_id])->exists()) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '模板不可用');
            $this->validateLink($merchantId, (int) $merchant->site_id, $linkType, $linkValue);
            $now = gmdate('Y-m-d H:i:s');
            $id = (int) Db::table('merchant_notify')->insertGetId([
                'site_id' => $merchant->site_id, 'merchant_id' => $merchantId, 'category' => $category, 'title' => $title, 'message' => $message,
                'deep_link_type' => $linkType, 'deep_link_value' => $linkValue, 'channels' => 'inapp', 'send_type' => $sendType,
                'send_at' => $sendAt ?? $now, 'status' => $sendType === 1 ? 1 : 2, 'delivered_at' => $sendType === 1 ? $now : null,
                'operator_id' => AdminContext::adminId(), 'operator_name' => AdminContext::adminName(), 'request_id' => $request, 'payload_hash' => $hash, 'template_id' => $templateId ?: null,
            ]);
            Db::table('merchant_notify_delivery')->insert(['notify_id' => $id, 'channel' => 'inapp', 'status' => $sendType === 1 ? 'delivered' : 'scheduled', 'attempts' => $sendType === 1 ? 1 : 0, 'scheduled_at' => $sendAt ?? $now, 'delivered_at' => $sendType === 1 ? $now : null, 'receipt' => $sendType === 1 ? 'inapp:' . $id : '']);
            Db::table('merchant_activity_log')->insert(['site_id' => $merchant->site_id, 'merchant_id' => $merchantId, 'activity_type' => 'notification', 'description' => 'In-app notification ' . $id . ($sendType === 1 ? ' delivered' : ' scheduled'), 'performed_by' => AdminContext::adminName(), 'performed_by_id' => AdminContext::adminId(), 'actor_type' => 'admin', 'entity_type' => 'notification', 'entity_id' => $id]);
            return $this->receipt($id);
        });
    }

    public function validateLink(int $merchantId, int $siteId, string $type, string $value): void
    {
        if ($type === 'none' && $value === '') return;
        if (in_array($type, ['wallet', 'user_profile'], true) && $value === '') return;
        if ($type === 'page' && in_array($value, ['/dashboard', '/order', '/promotions', '/earnings', '/notifications', '/settings'], true)) return;
        if (in_array($type, ['booking_detail', 'promotion'], true) && ctype_digit($value) && (int) $value > 0) {
            $table = $type === 'booking_detail' ? 'order_main' : 'marketing_coupon';
            if (Db::table($table)->where('id', (int) $value)->where('merchant_id', $merchantId)->where('site_id', $siteId)->whereNull('deleted_at')->exists()) return;
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '链接目标不属于该商户');
        }
        throw new BusinessException(ErrorCode::PARAM_ERROR, '仅支持受控应用内页面、本商户预订或促销，不允许外部链接');
    }

    public function receipt(int $id): array
    {
        return ['id' => $id, 'deliveries' => Db::table('merchant_notify_delivery')->where('notify_id', $id)->get()->map(static fn ($r) => (array) $r)->all()];
    }

    public function deliverDue(): int
    {
        $count = 0;
        $ids = Db::table('merchant_notify')->where('status', 2)->whereNotNull('request_id')->where('send_at', '<=', gmdate('Y-m-d H:i:s'))->orderBy('id')->limit(200)->pluck('id');
        foreach ($ids as $id) $count += Db::transaction(function () use ($id) {
            $row = Db::table('merchant_notify')->where('id', $id)->lockForUpdate()->first();
            if (! $row || (int) $row->status !== 2 || $row->send_at > gmdate('Y-m-d H:i:s')) return 0;
            $delivery = Db::table('merchant_notify_delivery')->where('notify_id', $id)->where('channel', 'inapp')->where('status', 'scheduled')->first();
            if (! $delivery) return 0;
            $now = gmdate('Y-m-d H:i:s');
            Db::table('merchant_notify')->where('id', $id)->update(['status' => 1, 'delivered_at' => $now]);
            Db::table('merchant_notify_delivery')->where('id', $delivery->id)->update(['status' => 'delivered', 'attempts' => 1, 'delivered_at' => $now, 'receipt' => 'inapp:' . $id]);
            Db::table('merchant_activity_log')->insert(['site_id' => $row->site_id, 'merchant_id' => $row->merchant_id, 'activity_type' => 'notification', 'description' => 'Scheduled in-app notification ' . $id . ' delivered', 'performed_by' => 'System', 'actor_type' => 'system', 'entity_type' => 'notification', 'entity_id' => $id]);
            return 1;
        });
        return $count;
    }
}
