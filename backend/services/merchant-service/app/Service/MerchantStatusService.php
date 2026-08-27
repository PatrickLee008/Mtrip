<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessPolicy;

class MerchantStatusService
{
    public function change(int $merchantId, string $action, array $input, string $ip = ''): array
    {
        if (! in_array($action, ['suspend', 'activate', 'reactivate', 'blacklist', 'unblacklist'], true)
            || ! AdminContext::hasPermission('merchant:status:' . $action)
            || (in_array($action, ['reactivate', 'blacklist', 'unblacklist'], true) && ! AdminContext::isSuper())) {
            throw new BusinessException(ErrorCode::FORBIDDEN);
        }
        return $this->transition($merchantId, $action, $input, [
            'type' => 'admin', 'id' => AdminContext::adminId(),
            'name' => AdminContext::adminName(), 'super' => AdminContext::isSuper(),
            'site' => AdminContext::scopeSiteId(), 'ip' => $ip,
        ]);
    }

    private function transition(int $merchantId, string $action, array $input, array $actor): array
    {
        foreach (['note', 'reason', 'requestId', 'evidence', 'suspendedUntil'] as $field) {
            if (isset($input[$field]) && ! is_string($input[$field])) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '状态参数类型错误');
            }
        }
        $note = trim((string) ($input['note'] ?? $input['reason'] ?? ''));
        $requestId = (string) ($input['requestId'] ?? '');
        $version = filter_var($input['expectedVersion'] ?? null, FILTER_VALIDATE_INT);
        $evidence = trim((string) ($input['evidence'] ?? ''));
        if ($note === '' || mb_strlen($note) > 500 || mb_strlen($evidence) > 500
            || ! preg_match('/^[a-zA-Z0-9_-]{8,80}$/D', $requestId) || $version === false || $version < 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '备注(1-500字)、expectedVersion和requestId必填');
        }
        $until = MerchantAccessPolicy::deadline($input['suspendedUntil'] ?? null);
        if ($until !== null && $action !== 'suspend') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '只有暂停操作可配置期限');
        }
        $hash = hash('sha256', json_encode([$action, $note, $version, $until, $evidence], JSON_UNESCAPED_UNICODE));
        return Db::transaction(function () use ($merchantId, $action, $actor, $note, $requestId, $version, $evidence, $until, $hash, $input) {
            // 统一锁顺序：商户→黑名单/历史→事件；订单也先锁商户。
            $merchant = Db::table('merchant_info')->where('id', $merchantId)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $merchant) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '商户不存在');
            }
            if ($actor['site'] !== null && (int) $merchant->site_id !== $actor['site']) {
                throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
            }
            $existing = Db::table('merchant_status_history')->where('merchant_id', $merchantId)
                ->where('actor_type', $actor['type'])->where('actor_id', $actor['id'])->where('request_id', $requestId)->first();
            if ($existing) {
                if (! hash_equals($existing->request_hash, $hash)) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, 'requestId已用于不同请求');
                }
                return json_decode($existing->result_json, true, 512, JSON_THROW_ON_ERROR);
            }
            if ((int) $merchant->status_version !== $version) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '商户状态已更新，请刷新后重试');
            }
            $now = gmdate('Y-m-d H:i:s');
            if ($until !== null && $until <= $now) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '暂停截止时间必须晚于当前时间');
            }
            $blacklisted = Db::table('merchant_blacklist')->where('merchant_id', $merchantId)->where('status', 1)->lockForUpdate()->first() !== null;
            if ($action === 'expire' && ((int) $merchant->active_suspension_id !== (int) ($input['suspensionId'] ?? 0)
                || ! $merchant->active_suspension_id || ! $merchant->suspended_until || $merchant->suspended_until > $now)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '暂停实例未到期或已失效');
            }
            $target = MerchantAccessPolicy::target((int) $merchant->status, $blacklisted,
                (bool) $merchant->reactivation_requires_super, $action, $actor['super']);
            if ($action === 'blacklist') {
                Db::table('merchant_blacklist')->insert([
                    'site_id' => $merchant->site_id, 'merchant_id' => $merchantId,
                    'reason' => mb_substr($note, 0, 255), 'evidence' => $evidence,
                    'operator_id' => $actor['id'], 'operator_name' => $actor['name'], 'status' => 1,
                ]);
            } elseif ($action === 'unblacklist') {
                Db::table('merchant_blacklist')->where('merchant_id', $merchantId)->where('status', 1)
                    ->update(['status' => 2, 'removed_at' => $now, 'removed_by' => $actor['id']]);
            }
            $result = ['merchantId' => $merchantId, 'status' => $target, 'statusVersion' => $version + 1,
                'isBlacklisted' => $action === 'blacklist', 'suspendedUntil' => $until,
                'reactivationRequiresSuper' => $action === 'unblacklist'];
            $historyId = (int) Db::table('merchant_status_history')->insertGetId([
                'site_id' => $merchant->site_id, 'merchant_id' => $merchantId, 'action' => $action,
                'from_status' => MerchantAccessPolicy::label((int) $merchant->status, $blacklisted),
                'to_status' => MerchantAccessPolicy::label($target, $action === 'blacklist'),
                'note' => $note, 'evidence' => $evidence, 'suspended_until' => $until,
                'previous_suspension_id' => $merchant->active_suspension_id,
                'from_version' => $version, 'to_version' => $version + 1,
                'actor_type' => $actor['type'], 'actor_id' => $actor['id'], 'actor_name' => $actor['name'],
                'ip_address' => mb_substr($actor['ip'], 0, 45), 'request_id' => $requestId,
                'request_hash' => $hash, 'result_json' => json_encode($result), 'created_at' => $now,
            ]);
            Db::table('merchant_info')->where('id', $merchantId)->update([
                'status' => $target, 'status_version' => $version + 1, 'suspended_until' => $until,
                'active_suspension_id' => $action === 'suspend' ? $historyId : null,
                'reactivation_requires_super' => $action === 'unblacklist' ? 1 : 0,
            ]);
            $description = $action . ': ' . $note;
            Db::table('merchant_activity_log')->insert([
                'site_id' => $merchant->site_id, 'merchant_id' => $merchantId,
                'activity_type' => $action === 'suspend' ? 'suspension' : ($action === 'blacklist' ? 'blacklist' : 'reactivation'),
                'description' => mb_substr($description, 0, 255), 'performed_by' => $actor['name'],
                'performed_by_id' => $actor['id'], 'actor_type' => $actor['type'], 'entity_type' => 'merchant_status', 'entity_id' => $historyId,
                'ip_address' => mb_substr($actor['ip'], 0, 45), 'created_at' => $now,
            ]);
            // 真实站内投递和强审计与状态同库同事务；外部服务商未配置，不报告已发送。
            $notificationId = (int) Db::table('merchant_notify')->insertGetId([
                'site_id' => $merchant->site_id, 'merchant_id' => $merchantId, 'category' => 'account',
                'title' => 'Merchant status updated / 商户状态变更', 'message' => $description,
                'channels' => 'inapp', 'status' => 1, 'send_type' => 1, 'send_at' => $now, 'delivered_at' => $now,
                'operator_id' => $actor['id'], 'operator_name' => $actor['name'], 'created_at' => $now,
            ]);
            Db::table('merchant_notify_delivery')->insert([
                'notify_id' => $notificationId, 'channel' => 'inapp', 'status' => 'delivered',
                'attempts' => 1, 'scheduled_at' => $now, 'delivered_at' => $now, 'receipt' => 'inapp:' . $notificationId,
            ]);
            return $result;
        });
    }

    /** 只恢复当前仍有效的到期实例；可由多个worker安全重复调用。 */
    public function expireDue(): int
    {
        $rows = Db::table('merchant_info')->where('status', 4)->whereNull('deleted_at')
            ->where('reactivation_requires_super', 0)->whereNotNull('active_suspension_id')
            ->where('suspended_until', '<=', gmdate('Y-m-d H:i:s'))->orderBy('id')->limit(200)->get();
        $count = 0;
        foreach ($rows as $row) {
            try {
                $this->transition((int) $row->id, 'expire', [
                    'note' => '临时暂停到期，系统自动恢复', 'expectedVersion' => (int) $row->status_version,
                    'requestId' => 'expiry-' . $row->active_suspension_id, 'suspensionId' => $row->active_suspension_id,
                ], ['type' => 'system', 'id' => 0, 'name' => 'System', 'super' => false, 'site' => null, 'ip' => '']);
                ++$count;
            } catch (BusinessException $e) {
                if (! in_array($e->getCode(), [ErrorCode::DATA_CONFLICT, ErrorCode::FORBIDDEN, ErrorCode::NOT_FOUND], true)) {
                    throw $e;
                }
            }
        }
        return $count;
    }
}
