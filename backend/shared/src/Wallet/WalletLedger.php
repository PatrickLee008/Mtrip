<?php

declare(strict_types=1);

namespace Mtrip\Shared\Wallet;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * mTrip 钱包账本(Super Admin PRD v1.0.14 模块 25):所有钱包余额变动的唯一入口。
 *
 * 余额仍以 user_info.balance 为准(App / 后台都读它),流水仍写 user_balance_log;新增按笔记账的额度批次
 * user_wallet_lot —— 每笔入账开一个批次并按「全局配置 → wallet」的有效天数定到期日,扣款按到期日最早的批次
 * 先扣(FIFO),到期任务把批次剩余额度作废并记一笔「过期」流水(change_type 6)。
 *
 * change_type:1 充值 2 消费 3 退款 4 调账 / 推荐返利 5 提现 6 过期。
 * 调用方必须在事务内调用 credit / debit(内部行锁 user_info);expireDue 自带事务,给定时任务用。
 * 金额一律换成整数分计算,避免 DECIMAL ↔ float 的尾差。
 */
final class WalletLedger
{
    public const TYPE_TOP_UP = 1;
    public const TYPE_SPEND = 2;
    public const TYPE_REFUND = 3;
    public const TYPE_ADJUST = 4;
    public const TYPE_WITHDRAW = 5;
    public const TYPE_EXPIRED = 6;

    public const LOT_ACTIVE = 1;
    public const LOT_USED = 2;
    public const LOT_EXPIRED = 3;

    /**
     * 入账:开一个额度批次(到期日按配置),余额增加,写流水(带 expires_at)。
     *
     * @return array{balance: float, logId: int, expiresAt: ?string}
     */
    public static function credit(int $siteId, int $userId, float $amount, int $changeType, int $orderId, int $operatorId, string $remark): array
    {
        $cents = self::cents($amount);
        if ($cents <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '入账金额须大于0');
        }
        $before = self::lockBalanceCents($userId);
        $after = $before + $cents;
        $expiresAt = WalletConfig::expiresAt(WalletConfig::validityDays());
        Db::table('user_info')->where('id', $userId)->update(['balance' => self::money($after)]);
        $logId = (int) Db::table('user_balance_log')->insertGetId([
            'site_id' => $siteId,
            'user_id' => $userId,
            'change_type' => $changeType,
            'amount' => self::money($cents),
            'before_balance' => self::money($before),
            'after_balance' => self::money($after),
            'order_id' => $orderId,
            'operator_id' => $operatorId,
            'remark' => mb_substr($remark, 0, 255),
            'expires_at' => $expiresAt,
        ]);
        Db::table('user_wallet_lot')->insert([
            'site_id' => $siteId,
            'user_id' => $userId,
            'source_log_id' => $logId,
            'change_type' => $changeType,
            'amount' => self::money($cents),
            'remaining' => self::money($cents),
            'expires_at' => $expiresAt,
            'status' => self::LOT_ACTIVE,
        ]);
        return ['balance' => $after / 100, 'logId' => $logId, 'expiresAt' => $expiresAt];
    }

    /**
     * 扣款:先把该用户已到期的批次作废(过期额度不能花),再按到期日最早的批次先扣;余额不足抛 DATA_CONFLICT。
     *
     * @return float 扣款后余额
     */
    public static function debit(int $siteId, int $userId, float $amount, int $changeType, int $orderId, string $remark, int $operatorId = 0): float
    {
        $cents = self::cents($amount);
        if ($cents <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '扣款金额须大于0');
        }
        self::lockBalanceCents($userId);
        self::expireLocked($userId);
        $before = self::lockBalanceCents($userId);
        if ($before < $cents) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '钱包余额不足');
        }
        $lots = Db::table('user_wallet_lot')
            ->where('user_id', $userId)->where('status', self::LOT_ACTIVE)->where('remaining', '>', 0)
            ->orderByRaw('expires_at IS NULL, expires_at, id')
            ->lockForUpdate()->get(['id', 'remaining'])
            ->map(static fn ($r) => ['id' => (int) $r->id, 'remaining' => self::cents((float) $r->remaining)])->all();
        foreach (self::allocate($lots, $cents)['take'] as $lotId => $take) {
            $left = self::lotRemaining($lots, $lotId) - $take;
            Db::table('user_wallet_lot')->where('id', $lotId)->update([
                'remaining' => self::money($left),
                'status' => $left > 0 ? self::LOT_ACTIVE : self::LOT_USED,
            ]);
        }
        $after = $before - $cents;
        Db::table('user_info')->where('id', $userId)->update(['balance' => self::money($after)]);
        Db::table('user_balance_log')->insert([
            'site_id' => $siteId,
            'user_id' => $userId,
            'change_type' => $changeType,
            'amount' => self::money(-$cents),
            'before_balance' => self::money($before),
            'after_balance' => self::money($after),
            'order_id' => $orderId,
            'operator_id' => $operatorId,
            'remark' => mb_substr($remark, 0, 255),
        ]);
        return $after / 100;
    }

    /** 当前可用余额(读之前先作废已到期批次;须在事务内) */
    public static function availableLocked(int $userId): float
    {
        self::lockBalanceCents($userId);
        self::expireLocked($userId);
        return self::lockBalanceCents($userId) / 100;
    }

    /**
     * 定时任务:作废所有已到期批次,每个用户一个事务。
     *
     * @return array{users: int, lots: int}
     */
    public static function expireDue(int $limit = 500): array
    {
        $userIds = Db::table('user_wallet_lot')
            ->where('status', self::LOT_ACTIVE)->where('remaining', '>', 0)
            ->whereNotNull('expires_at')->where('expires_at', '<=', date('Y-m-d H:i:s'))
            ->distinct()->limit($limit)->pluck('user_id')->map(static fn ($v) => (int) $v)->all();
        $lots = 0;
        foreach ($userIds as $userId) {
            $lots += (int) Db::transaction(static function () use ($userId): int {
                self::lockBalanceCents($userId);
                return self::expireLocked($userId);
            });
        }
        return ['users' => count($userIds), 'lots' => $lots];
    }

    /**
     * 按到期日最早优先把扣款金额分摊到批次(纯函数,单测覆盖)。
     * 批次合计不足时(历史余额早于批次上线且未回填),不足部分记入 uncovered,由调用方按余额兜底。
     *
     * @param list<array{id:int, remaining:int}> $lots 已按扣减顺序排好,金额为分
     * @return array{take: array<int, int>, uncovered: int}
     */
    public static function allocate(array $lots, int $cents): array
    {
        $take = [];
        foreach ($lots as $lot) {
            if ($cents <= 0) {
                break;
            }
            $use = min($cents, max(0, $lot['remaining']));
            if ($use > 0) {
                $take[$lot['id']] = $use;
                $cents -= $use;
            }
        }
        return ['take' => $take, 'uncovered' => max(0, $cents)];
    }

    public static function cents(float|int|string $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    public static function money(int $cents): string
    {
        return number_format($cents / 100, 2, '.', '');
    }

    /** 作废该用户已到期批次,每个批次一条过期流水;调用方须已行锁 user_info。@return int 作废的批次数 */
    private static function expireLocked(int $userId): int
    {
        $due = Db::table('user_wallet_lot')
            ->where('user_id', $userId)->where('status', self::LOT_ACTIVE)->where('remaining', '>', 0)
            ->whereNotNull('expires_at')->where('expires_at', '<=', date('Y-m-d H:i:s'))
            ->orderBy('expires_at')->orderBy('id')->lockForUpdate()
            ->get(['id', 'site_id', 'remaining', 'expires_at']);
        if (count($due) === 0) {
            return 0;
        }
        $balance = self::lockBalanceCents($userId);
        foreach ($due as $lot) {
            // 余额已被历史数据改小时不扣成负数(批次与余额漂移的兜底)
            $cents = min(self::cents((float) $lot->remaining), $balance);
            Db::table('user_wallet_lot')->where('id', $lot->id)->update(['remaining' => '0.00', 'status' => self::LOT_EXPIRED]);
            if ($cents <= 0) {
                continue;
            }
            $after = $balance - $cents;
            Db::table('user_balance_log')->insert([
                'site_id' => (int) $lot->site_id,
                'user_id' => $userId,
                'change_type' => self::TYPE_EXPIRED,
                'amount' => self::money(-$cents),
                'before_balance' => self::money($balance),
                'after_balance' => self::money($after),
                'order_id' => 0,
                'operator_id' => 0,
                'remark' => '钱包额度过期(批次 ' . $lot->id . ',到期 ' . $lot->expires_at . ')',
            ]);
            $balance = $after;
        }
        Db::table('user_info')->where('id', $userId)->update(['balance' => self::money($balance)]);
        return count($due);
    }

    private static function lockBalanceCents(int $userId): int
    {
        $user = Db::table('user_info')->where('id', $userId)->lockForUpdate()->first(['id', 'balance']);
        if (! $user) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '钱包目标用户不存在');
        }
        return self::cents((float) $user->balance);
    }

    /** @param list<array{id:int, remaining:int}> $lots */
    private static function lotRemaining(array $lots, int $lotId): int
    {
        foreach ($lots as $lot) {
            if ($lot['id'] === $lotId) {
                return $lot['remaining'];
            }
        }
        return 0;
    }
}
