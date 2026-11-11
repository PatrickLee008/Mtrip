<?php

declare(strict_types=1);

namespace App\Service;

use Mtrip\Shared\Wallet\WalletLedger;

/**
 * mTrip 钱包服务:统一入账(退款到账 / 推荐返利 / 后续活动奖励复用)与扣款(钱包支付)。
 * 记账口径(额度批次、到期、FIFO 扣减)统一在 shared WalletLedger,这里保留原签名给订单 / 退款 / 推荐调用。
 * change_type:1充值 2消费 3退款 4调账 5提现 6过期
 */
class WalletService
{
    /**
     * 给用户钱包入账(须在事务内调用):开一个按配置有效期到期的额度批次。
     * @return float 入账后余额
     */
    public function credit(int $siteId, int $userId, float $amount, int $changeType, int $orderId, int $operatorId, string $remark): float
    {
        return WalletLedger::credit($siteId, $userId, $amount, $changeType, $orderId, $operatorId, $remark)['balance'];
    }

    /**
     * 从用户钱包扣款(须在事务内调用):先作废已到期额度,再按到期日最早的批次先扣;余额不足抛错。
     * @return float 扣款后余额
     */
    public function debit(int $siteId, int $userId, float $amount, int $changeType, int $orderId, string $remark): float
    {
        return WalletLedger::debit($siteId, $userId, $amount, $changeType, $orderId, $remark);
    }

    /** 定时任务:作废已到期的钱包额度(crontab wallet-credit-expiry) */
    public function expireDue(): void
    {
        WalletLedger::expireDue();
    }
}
