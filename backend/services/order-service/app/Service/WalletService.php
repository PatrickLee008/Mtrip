<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * mTrip 钱包服务:统一入账(退款到账 / 推荐返利 / 后续活动奖励复用)
 * change_type:1充值 2消费 3退款 4调账 5提现
 */
class WalletService
{
    /**
     * 给用户钱包入账(须在事务内调用):行锁 user_info + 前后余额快照写 user_balance_log。
     * @return float 入账后余额
     */
    public function credit(int $siteId, int $userId, float $amount, int $changeType, int $orderId, int $operatorId, string $remark): float
    {
        $user = Db::table('user_info')->where('id', $userId)->lockForUpdate()->first(['id', 'balance']);
        if (! $user) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '钱包目标用户不存在');
        }
        $before = (float) $user->balance;
        $after = round($before + $amount, 2);
        Db::table('user_info')->where('id', $userId)->update(['balance' => $after]);
        Db::table('user_balance_log')->insert([
            'site_id' => $siteId,
            'user_id' => $userId,
            'change_type' => $changeType,
            'amount' => $amount,
            'before_balance' => $before,
            'after_balance' => $after,
            'order_id' => $orderId,
            'operator_id' => $operatorId,
            'remark' => $remark,
        ]);
        return $after;
    }

    /**
     * 从用户钱包扣款(须在事务内调用):行锁 user_info,余额不足直接抛错,
     * 流水 amount 记负数(与 credit 的正数入账成对)。
     * @return float 扣款后余额
     */
    public function debit(int $siteId, int $userId, float $amount, int $changeType, int $orderId, string $remark): float
    {
        if ($amount <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '扣款金额须大于0');
        }
        $user = Db::table('user_info')->where('id', $userId)->lockForUpdate()->first(['id', 'balance']);
        if (! $user) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '钱包目标用户不存在');
        }
        $before = (float) $user->balance;
        // 金额为 DECIMAL(12,2),留 0.005 容差避免浮点尾差把刚好够的余额判成不足
        if ($before + 0.005 < $amount) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '钱包余额不足');
        }
        $after = round($before - $amount, 2);
        Db::table('user_info')->where('id', $userId)->update(['balance' => $after]);
        Db::table('user_balance_log')->insert([
            'site_id' => $siteId,
            'user_id' => $userId,
            'change_type' => $changeType,
            'amount' => -$amount,
            'before_balance' => $before,
            'after_balance' => $after,
            'order_id' => $orderId,
            'operator_id' => 0,
            'remark' => $remark,
        ]);
        return $after;
    }
}
