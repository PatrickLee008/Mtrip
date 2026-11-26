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
 *   授权超管批准 + 独立财务经办/复核,未过期且余额不高于两次审核额度 → WalletLedger 作废、记台账 → 注销。
 *   在生效阈值内，用户确认注销后在同一事务内作废剩余额度。
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
                $policy = AccountDeletionWorkflow::policy();
                $decision = AccountDeletionPolicy::decide(
                    $bookings,
                    $balanceCents,
                    $approval ? min(WalletLedger::cents($approval['approved_balance']), WalletLedger::cents($approval['finance_balance'])) : null,
                    WalletLedger::cents($policy['threshold_amount'] ?? 0),
                );
                if (! $decision['allowed']) {
                    throw new BusinessException(ErrorCode::ACCOUNT_DELETION_BLOCKED, $this->blockedMessage($decision['blockers']), [
                        'blockers' => $decision['blockers'],
                        'ongoingBookings' => $bookings,
                        'walletBalance' => WalletLedger::money($balanceCents),
                    ]);
                }
                $this->close($user, $approval, $decision['forfeitCents'], $ip, $policy);
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

    /** @return array<string, mixed>|null 当前有效的没收批准(后台展示 / 注销判定) */
    public function validApproval(int $userId, bool $lock = false): ?array
    {
        $query = Db::table('user_account_deletion')
            ->where('user_id', $userId)->where('status', self::STATUS_APPROVED)
            ->where('policy_version', '>', 0)->where('requested_by', '>', 0)
            ->where('finance_state', 2)->where('finance_maker_id', '>', 0)->where('finance_checker_id', '>', 0)
            ->whereColumn('finance_maker_id', '<>', 'finance_checker_id')
            ->whereColumn('finance_maker_id', '<>', 'approved_by')->whereColumn('finance_checker_id', '<>', 'approved_by')
            ->where('approval_expires_at', '>', gmdate('Y-m-d H:i:s'))
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
        return count(AccountDeletionBookings::blockers($userId));
    }

    /**
     * 执行注销(事务内,已行锁 user_info)
     *
     * @param array<string, mixed>      $user
     * @param array<string, mixed>|null $approval
     */
    private function close(array $user, ?array $approval, int $forfeitCents, string $ip, array $policy): void
    {
        $userId = (int) $user['id'];
        $siteId = (int) $user['site_id'];
        $now = gmdate('Y-m-d H:i:s');

        // 社交身份整行归档(含加密的 Apple refresh token,留给后续向 Apple 吊销授权;匿名化时一并清除)
        $identities = Db::table('user_social_identity')->where('user_id', $userId)
            ->get(['site_id', 'provider', 'provider_app_id', 'provider_user_id', 'consent_version', 'consent_at', 'provider_refresh_token', 'created_at'])
            ->map(static fn ($r) => (array) $r)->all();
        $closing = [
            'status' => self::STATUS_CLOSED,
            'closed_at' => $now,
            'purge_after' => gmdate('Y-m-d H:i:s', time() + AccountDeletionPolicy::RETENTION_DAYS * 86400),
            'archived_mobile_hash' => $user['mobile_hash'] ?: null,
            'archived_email_hash' => ($user['email_hash'] ?? null) ?: null,
            'archived_identities' => $identities === [] ? null : json_encode($identities, JSON_UNESCAPED_UNICODE),
            'client_ip' => mb_substr($ip, 0, 50),
        ];
        if ($approval) {
            $deletionId = (int) $approval['id'];
            Db::table('user_account_deletion')->where('id', $deletionId)->update($closing);
            AccountDeletionWorkflow::event($approval, 'completed', $userId, 'Consumer', 'Consumer confirmed DELETE',
                ['amount' => WalletLedger::money($forfeitCents)]);
        } else {
            $deletionId = (int) Db::table('user_account_deletion')->insertGetId($closing + ['site_id' => $siteId, 'user_id' => $userId,
                'policy_version' => $policy['id'] ?? 0, 'threshold_snapshot' => $policy['threshold_amount'] ?? 0]);
            if ($forfeitCents > 0) {
                AccountDeletionWorkflow::event(['id' => $deletionId, 'site_id' => $siteId, 'user_id' => $userId],
                    'completed', $userId, 'Consumer', 'Consumer confirmed DELETE and forfeiture',
                    ['amount' => WalletLedger::money($forfeitCents), 'threshold' => $policy['threshold_amount']]);
            }
        }

        if ($forfeitCents > 0) {
            $approver = (int) ($approval['approved_by'] ?? 0);
            $reason = $approval['approve_reason'] ?? 'Consumer confirmed balance forfeiture within the configured threshold';
            $forfeit = WalletLedger::forfeitAll($siteId, $userId, $approver,
                '账户注销余额作废，注销单 ' . $deletionId);
            if ($forfeit['cents'] > 0) {
                Db::table('user_wallet_forfeit')->insert([
                    'site_id' => $siteId,
                    'user_id' => $userId,
                    'deletion_id' => $deletionId,
                    'amount' => WalletLedger::money($forfeit['cents']),
                    'balance_log_id' => $forfeit['logId'],
                    'approved_by' => $approver,
                    'approved_name' => (string) ($approval['approved_name'] ?? ''),
                    'reason' => $reason,
                ]);
                Db::table('user_account_deletion')->where('id', $deletionId)
                    ->update(['forfeited_amount' => WalletLedger::money($forfeit['cents'])]);
            }
        }

        Db::table('user_social_identity')->where('user_id', $userId)->delete();
        // Closing a zero-balance account must also invalidate any unfinished escalation.
        $unused = Db::table('user_account_deletion')->where('user_id', $userId)->where('id', '<>', $deletionId)
            ->whereIn('status', [1, 4])->lockForUpdate()->get();
        foreach ($unused as $row) {
            Db::table('user_account_deletion')->where('id', $row->id)->update(['status' => self::STATUS_REVOKED]);
            AccountDeletionWorkflow::event((array) $row, 'revoked', $userId, 'Consumer', 'Account closed');
        }
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
