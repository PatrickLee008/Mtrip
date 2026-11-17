<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Account\AccountDeletionPolicy;
use Mtrip\Shared\Account\UserSessionRevocation;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\RedisLock;
use Mtrip\Shared\Wallet\WalletLedger;

/**
 * mTrip 账户注销(Consumer App PRD 模块 19)
 *
 * App:警告页 → Continue → 输入 DELETE → Confirm → 本服务判定(AccountDeletionPolicy):
 *   有进行中 / 待处理预订 → 拦截;钱包余额 > 0 → 默认拦截(用户联系客服);
 *   客服 / 后台已批准没收(user_account_deletion.status=1,未过期,余额不高于批准时)→ 余额经 WalletLedger 没收并记台账 → 注销。
 *
 * 注销 = 账号置为 3 已注销 + 解绑登录凭据(mobile_hash / email_hash / 社交身份置空并归档到注销记录),
 * 资料本身保留 90 天(PRD 数据保留政策),到期由 AccountPurge 定时任务匿名化。
 * 解绑之后同一手机号 / 邮箱 / 社交账号可注册**新**账号,新账号与旧数据、钱包、权益无任何关联。
 * 已签发的 JWT 通过 UserSessionRevocation 标记即时失效。
 */
class AccountDeletionService
{
    public const STATUS_APPROVED = 1;
    public const STATUS_CLOSED = 2;
    public const STATUS_REVOKED = 3;

    public function __construct(
        protected ConfigInterface $config,
        protected Redis $redis,
        protected RedisLock $lock,
        protected UserAuthService $auth,
    ) {
    }

    /** 用户在 App 内确认注销 */
    public function delete(int $userId, string $confirmWord, string $ip): void
    {
        if (! AccountDeletionPolicy::confirmed($confirmWord)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'Please type DELETE to confirm');
        }
        $this->lock->run("mtrip:lock:user:delete:{$userId}", 30, function () use ($userId, $ip): void {
            $siteId = Db::transaction(function () use ($userId, $ip): int {
                $user = Db::table('user_info')->where('id', $userId)->whereNull('deleted_at')->lockForUpdate()->first();
                if (! $user) {
                    throw new BusinessException(ErrorCode::UNAUTHORIZED);
                }
                $user = (array) $user;
                if ((int) $user['user_status'] !== 1) {
                    // 冻结 / 拉黑中的账号在风控处理中,自助注销会绕过处理流程
                    throw new BusinessException(ErrorCode::FORBIDDEN, 'Your account is restricted. Please contact customer support.');
                }
                $siteId = (int) $user['site_id'];
                $balanceCents = WalletLedger::cents(WalletLedger::availableLocked($userId));
                $approval = $this->validApproval($userId, true);
                $bookings = $this->ongoingBookingCount($userId);
                $decision = AccountDeletionPolicy::decide(
                    $bookings,
                    $balanceCents,
                    $approval ? WalletLedger::cents($approval['approved_balance']) : null,
                );
                if (! $decision['allowed']) {
                    throw new BusinessException(ErrorCode::ACCOUNT_DELETION_BLOCKED, $this->blockedMessage($decision['blockers']), [
                        'blockers' => $decision['blockers'],
                        'ongoingBookings' => $bookings,
                        'walletBalance' => WalletLedger::money($balanceCents),
                    ]);
                }
                $this->close($user, $approval, $decision['forfeitCents'], $ip);
                return $siteId;
            });
            // 事务提交后再吊销旧 Token:吊销失败不影响注销结果(登录凭据已在库里解绑)
            try {
                $ttl = max(86400, (int) $this->config->get('mtrip.app_jwt_ttl', 604800) + 3600);
                $this->redis->setex(UserSessionRevocation::key($userId), $ttl, '1');
            } catch (\Throwable) {
            }
            $this->auth->actionLog($siteId, $userId, 1, '注销账户', $ip);
        }, 'Request in progress, please wait');
    }

    /**
     * 客服 / 后台批准「有余额时注销」(余额届时没收)。批准记下当前余额作为没收上限,有效期 7 天;
     * 用户仍需自己在 App 内输入 DELETE 完成注销。同一用户已有有效批准时覆盖为最新一次。
     *
     * @param array<string, mixed> $user user_info 行
     * @return array<string, mixed>
     */
    public function approve(array $user, string $reason, int $adminId, string $adminName): array
    {
        if ((int) $user['user_status'] === 3) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该用户已注销');
        }
        $userId = (int) $user['id'];
        return Db::transaction(function () use ($user, $userId, $reason, $adminId, $adminName): array {
            $balance = WalletLedger::cents(WalletLedger::availableLocked($userId));
            if ($balance <= 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '用户钱包余额为 0,无需批准即可自助注销');
            }
            Db::table('user_account_deletion')->where('user_id', $userId)->where('status', self::STATUS_APPROVED)
                ->update(['status' => self::STATUS_REVOKED]);
            $now = date('Y-m-d H:i:s');
            $expires = date('Y-m-d H:i:s', time() + AccountDeletionPolicy::APPROVAL_VALID_DAYS * 86400);
            $id = (int) Db::table('user_account_deletion')->insertGetId([
                'site_id' => (int) $user['site_id'],
                'user_id' => $userId,
                'status' => self::STATUS_APPROVED,
                'approved_balance' => WalletLedger::money($balance),
                'approve_reason' => mb_substr($reason, 0, 255),
                'approved_by' => $adminId,
                'approved_name' => mb_substr($adminName, 0, 50),
                'approved_at' => $now,
                'approval_expires_at' => $expires,
            ]);
            return ['id' => $id, 'approvedBalance' => WalletLedger::money($balance), 'expiresAt' => $expires];
        });
    }

    /** 撤销尚未被用户使用的批准 */
    public function revoke(int $userId): int
    {
        return Db::table('user_account_deletion')->where('user_id', $userId)->where('status', self::STATUS_APPROVED)
            ->update(['status' => self::STATUS_REVOKED]);
    }

    /** @return array<string, mixed>|null 当前有效的没收批准(后台展示 / 注销判定) */
    public function validApproval(int $userId, bool $lock = false): ?array
    {
        $query = Db::table('user_account_deletion')
            ->where('user_id', $userId)->where('status', self::STATUS_APPROVED)
            ->where('approval_expires_at', '>', date('Y-m-d H:i:s'))
            ->orderByDesc('id');
        if ($lock) {
            $query->lockForUpdate();
        }
        $row = $query->first();
        return $row ? (array) $row : null;
    }

    /** 进行中 / 待处理的预订数(口径见 AccountDeletionPolicy::isOngoingBooking) */
    public function ongoingBookingCount(int $userId): int
    {
        $rows = Db::table('order_main')->where('user_id', $userId)->whereNull('deleted_at')
            ->where(static function ($q): void {
                $q->whereIn('booking_status', [1, 2, 3])
                    ->orWhere(static fn ($legacy) => $legacy->where('booking_status', 0)->whereIn('order_status', [0, 1, 2]))
                    ->orWhere('order_status', 5)
                    ->orWhere('refund_status', 1);
            })
            ->get(['booking_status', 'order_status', 'refund_status']);
        $count = 0;
        foreach ($rows as $row) {
            if (AccountDeletionPolicy::isOngoingBooking((array) $row)) {
                ++$count;
            }
        }
        return $count;
    }

    /**
     * 执行注销(事务内,已行锁 user_info)
     *
     * @param array<string, mixed>      $user
     * @param array<string, mixed>|null $approval
     */
    private function close(array $user, ?array $approval, int $forfeitCents, string $ip): void
    {
        $userId = (int) $user['id'];
        $siteId = (int) $user['site_id'];
        $now = date('Y-m-d H:i:s');

        // 社交身份整行归档(含加密的 Apple refresh token,留给后续向 Apple 吊销授权;匿名化时一并清除)
        $identities = Db::table('user_social_identity')->where('user_id', $userId)
            ->get(['site_id', 'provider', 'provider_app_id', 'provider_user_id', 'consent_version', 'consent_at', 'provider_refresh_token', 'created_at'])
            ->map(static fn ($r) => (array) $r)->all();
        $closing = [
            'status' => self::STATUS_CLOSED,
            'closed_at' => $now,
            'purge_after' => date('Y-m-d H:i:s', time() + AccountDeletionPolicy::RETENTION_DAYS * 86400),
            'archived_mobile_hash' => $user['mobile_hash'] ?: null,
            'archived_email_hash' => ($user['email_hash'] ?? null) ?: null,
            'archived_identities' => $identities === [] ? null : json_encode($identities, JSON_UNESCAPED_UNICODE),
            'client_ip' => mb_substr($ip, 0, 50),
        ];
        if ($approval) {
            $deletionId = (int) $approval['id'];
            Db::table('user_account_deletion')->where('id', $deletionId)->update($closing);
        } else {
            $deletionId = (int) Db::table('user_account_deletion')->insertGetId($closing + ['site_id' => $siteId, 'user_id' => $userId]);
        }

        if ($forfeitCents > 0 && $approval) {
            $forfeit = WalletLedger::forfeitAll($siteId, $userId, (int) $approval['approved_by'],
                '账户注销没收余额(注销单 ' . $deletionId . ',批准人 ' . $approval['approved_name'] . ')');
            if ($forfeit['cents'] > 0) {
                Db::table('user_wallet_forfeit')->insert([
                    'site_id' => $siteId,
                    'user_id' => $userId,
                    'deletion_id' => $deletionId,
                    'amount' => WalletLedger::money($forfeit['cents']),
                    'balance_log_id' => $forfeit['logId'],
                    'approved_by' => (int) $approval['approved_by'],
                    'approved_name' => (string) $approval['approved_name'],
                    'reason' => (string) $approval['approve_reason'],
                ]);
                Db::table('user_account_deletion')->where('id', $deletionId)
                    ->update(['forfeited_amount' => WalletLedger::money($forfeit['cents'])]);
            }
        }

        Db::table('user_social_identity')->where('user_id', $userId)->delete();
        Db::table('user_info')->where('id', $userId)->update([
            'user_status' => 3,
            'mobile_hash' => null,
            'email_hash' => null,
            'remark' => mb_substr('[注销] ' . $now . ' ' . (string) $user['remark'], 0, 500),
        ]);
    }

    /** @param list<string> $blockers */
    private function blockedMessage(array $blockers): string
    {
        $booking = in_array(AccountDeletionPolicy::BLOCKER_BOOKING, $blockers, true);
        $wallet = in_array(AccountDeletionPolicy::BLOCKER_WALLET, $blockers, true);
        return match (true) {
            $booking && $wallet => 'You have ongoing bookings and a remaining mTrip Wallet balance. Please contact customer support.',
            $booking => 'You have ongoing or pending bookings. Please complete or cancel them, or contact customer support.',
            default => 'Your mTrip Wallet still has a balance. Please contact customer support.',
        };
    }
}
