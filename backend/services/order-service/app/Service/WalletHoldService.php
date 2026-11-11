<?php

declare(strict_types=1);

namespace App\Service;

use App\Constants\BookingConst;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Wallet\WalletConfig;
use Mtrip\Shared\Wallet\WalletLedger;

/**
 * 钱包部分抵扣(Super Admin PRD v1.0.14 模块 25):结账时钱包自动抵扣(可关闭),最高到「全局配置 → wallet」的单笔限额,
 * 不足部分用其他支付方式付清。
 *
 * 抵扣额在发起支付时就从钱包扣出(wallet_hold_status 1 冻结),其他方式只付 pay_amount - wallet_amount;
 *   - 其他方式付清 → markPaid(2 已支付);mock 渠道当场付清;
 *   - 未付清就取消 / 超时 → release(3 已退回),抵扣额重新入账(新批次、按配置重新起算有效期);
 *   - 超时取消后其他方式迟到到账要恢复预订 → rehold 重新扣钱包,余额不够则抛错,由调用方转原路退款。
 * 部分抵扣的订单退款一律退回钱包(OrderController::refundChannelOf / BookingRefundService)。
 * 所有方法都须在已行锁订单(及 Trip)的事务内调用。
 */
class WalletHoldService
{
    public const NONE = 0;
    public const HELD = 1;
    public const PAID = 2;
    public const RELEASED = 3;

    /** 订单类型 → 钱包限额类型(order_type:1 酒店 2 门票;汽车订单上线后在此映射) */
    public static function limitType(int $orderType): string
    {
        return $orderType === 1 ? 'hotel' : '';
    }

    /** 本次可抵扣金额 = min(可用余额, 单笔限额(0 不限), 应付) */
    public static function portion(float $available, float $cap, float $payable): float
    {
        $amount = min($available, $payable);
        if ($cap > 0) {
            $amount = min($amount, $cap);
        }
        return max(0.0, round($amount, 2));
    }

    /**
     * 独立单:按需冻结钱包抵扣额,返回本单钱包支付额(已冻结的直接复用,不重复扣)。
     * $useWallet=false 且之前冻结过 → 先退回再按不用钱包处理(用户在支付页关掉了钱包)。
     */
    public function holdOrder(array $order, bool $useWallet): float
    {
        $orderId = (int) $order['id'];
        $row = (array) Db::table('order_main')->where('id', $orderId)->first(['wallet_amount', 'wallet_hold_status']);
        if ((int) $row['wallet_hold_status'] === self::HELD) {
            if ($useWallet) {
                return (float) $row['wallet_amount'];
            }
            $this->releaseOrder($order, '用户改为不使用钱包', false);
        }
        if (! $useWallet) {
            return 0.0;
        }
        $payable = round((float) $order['pay_amount'], 2);
        $amount = self::portion(
            WalletLedger::availableLocked((int) $order['user_id']),
            WalletConfig::maxUse(self::limitType((int) $order['order_type'])),
            $payable,
        );
        if ($amount <= 0) {
            return 0.0;
        }
        WalletLedger::debit((int) $order['site_id'], (int) $order['user_id'], $amount, WalletLedger::TYPE_SPEND, $orderId,
            "订单 {$order['order_no']} 钱包抵扣");
        Db::table('order_main')->where('id', $orderId)->update(['wallet_amount' => $amount, 'wallet_hold_status' => self::HELD]);
        return $amount;
    }

    /**
     * Trip 整单:冻结抵扣额记在 order_trip,并按各预订应付比例分摊到 order_main.wallet_amount(末单吸收尾差)。
     *
     * @param list<array> $bookings 已行锁的预订行
     */
    public function holdTrip(array $trip, array $bookings, bool $useWallet): float
    {
        $tripId = (int) $trip['id'];
        $row = (array) Db::table('order_trip')->where('id', $tripId)->first(['wallet_amount', 'wallet_hold_status']);
        if ((int) $row['wallet_hold_status'] === self::HELD) {
            if ($useWallet) {
                return (float) $row['wallet_amount'];
            }
            $this->releaseTrip($trip, '用户改为不使用钱包', false);
        }
        if (! $useWallet) {
            return 0.0;
        }
        $payable = round((float) $trip['pay_amount'], 2);
        // Trip 目前只含酒店预订,按酒店限额
        $amount = self::portion(
            WalletLedger::availableLocked((int) $trip['user_id']),
            WalletConfig::maxUse('hotel'),
            $payable,
        );
        if ($amount <= 0) {
            return 0.0;
        }
        WalletLedger::debit((int) $trip['site_id'], (int) $trip['user_id'], $amount, WalletLedger::TYPE_SPEND, $tripId,
            "行程 {$trip['trip_no']} 钱包抵扣");
        Db::table('order_trip')->where('id', $tripId)->update(['wallet_amount' => $amount, 'wallet_hold_status' => self::HELD]);
        foreach (self::splitByPay($bookings, $amount) as $orderId => $share) {
            Db::table('order_main')->where('id', $orderId)->update(['wallet_amount' => $share, 'wallet_hold_status' => self::HELD]);
        }
        return $amount;
    }

    /** 钱包付全额(payMethod 3):记钱包支付额,直接置已支付 */
    public function recordFullOrder(int $orderId, float $amount): void
    {
        Db::table('order_main')->where('id', $orderId)->update(['wallet_amount' => round($amount, 2), 'wallet_hold_status' => self::PAID]);
    }

    /** @param list<array> $bookings */
    public function recordFullTrip(array $trip, array $bookings): void
    {
        Db::table('order_trip')->where('id', (int) $trip['id'])
            ->update(['wallet_amount' => round((float) $trip['pay_amount'], 2), 'wallet_hold_status' => self::PAID]);
        foreach ($bookings as $b) {
            Db::table('order_main')->where('id', (int) $b['id'])
                ->update(['wallet_amount' => round((float) $b['pay_amount'], 2), 'wallet_hold_status' => self::PAID]);
        }
    }

    /** 其他方式付清:冻结 → 已支付 */
    public function markPaid(array $orderIds, int $tripId = 0): void
    {
        if ($orderIds !== []) {
            Db::table('order_main')->whereIn('id', $orderIds)->where('wallet_hold_status', self::HELD)
                ->update(['wallet_hold_status' => self::PAID]);
        }
        if ($tripId > 0) {
            Db::table('order_trip')->where('id', $tripId)->where('wallet_hold_status', self::HELD)
                ->update(['wallet_hold_status' => self::PAID]);
        }
    }

    /**
     * 未付清就取消 / 超时:冻结额退回钱包(幂等:只处理冻结中的)。
     * $keepAmount:超时 / 取消保留 wallet_amount(迟到到账恢复时据此重新扣回、到账金额校验仍按差额);
     * 用户主动关掉钱包则清零(之后出的码是全额)。
     */
    public function releaseOrder(array $order, string $reason, bool $keepAmount = true): void
    {
        $row = (array) Db::table('order_main')->where('id', (int) $order['id'])->first(['wallet_amount', 'wallet_hold_status', 'trip_id']);
        if ((int) $row['wallet_hold_status'] !== self::HELD || (int) $row['trip_id'] > 0) {
            return; // Trip 预订的抵扣挂在 Trip 上,由 releaseTrip 统一退
        }
        $amount = round((float) $row['wallet_amount'], 2);
        if ($amount > 0) {
            WalletLedger::credit((int) $order['site_id'], (int) $order['user_id'], $amount, WalletLedger::TYPE_REFUND,
                (int) $order['id'], 0, "订单 {$order['order_no']} 未付清,钱包抵扣退回({$reason})");
        }
        Db::table('order_main')->where('id', (int) $order['id'])
            ->update($keepAmount ? ['wallet_hold_status' => self::RELEASED] : ['wallet_hold_status' => self::NONE, 'wallet_amount' => 0]);
    }

    public function releaseTrip(array $trip, string $reason, bool $keepAmount = true): void
    {
        $row = (array) Db::table('order_trip')->where('id', (int) $trip['id'])->first(['wallet_amount', 'wallet_hold_status']);
        if ((int) $row['wallet_hold_status'] !== self::HELD) {
            return;
        }
        $amount = round((float) $row['wallet_amount'], 2);
        if ($amount > 0) {
            WalletLedger::credit((int) $trip['site_id'], (int) $trip['user_id'], $amount, WalletLedger::TYPE_REFUND,
                (int) $trip['id'], 0, "行程 {$trip['trip_no']} 未付清,钱包抵扣退回({$reason})");
        }
        $after = $keepAmount ? ['wallet_hold_status' => self::RELEASED] : ['wallet_hold_status' => self::NONE, 'wallet_amount' => 0];
        Db::table('order_trip')->where('id', (int) $trip['id'])->update($after);
        Db::table('order_main')->where('trip_id', (int) $trip['id'])->where('wallet_hold_status', self::HELD)->update($after);
    }

    /**
     * 超时取消后其他方式迟到到账、要恢复预订:之前退回的抵扣额重新从钱包扣出(余额不足抛错 → 调用方转原路退款)。
     *
     * @param list<array> $orders 已行锁的预订行
     */
    public function rehold(?array $trip, array $orders): void
    {
        if ($trip !== null) {
            $row = (array) Db::table('order_trip')->where('id', (int) $trip['id'])->first(['wallet_amount', 'wallet_hold_status']);
            if ((int) $row['wallet_hold_status'] === self::RELEASED && (float) $row['wallet_amount'] > 0) {
                WalletLedger::debit((int) $trip['site_id'], (int) $trip['user_id'], (float) $row['wallet_amount'], WalletLedger::TYPE_SPEND,
                    (int) $trip['id'], "行程 {$trip['trip_no']} 迟到付清,钱包抵扣重新扣回");
                Db::table('order_trip')->where('id', (int) $trip['id'])->update(['wallet_hold_status' => self::HELD]);
                Db::table('order_main')->where('trip_id', (int) $trip['id'])->where('wallet_hold_status', self::RELEASED)
                    ->update(['wallet_hold_status' => self::HELD]);
            }
            return;
        }
        foreach ($orders as $o) {
            $row = (array) Db::table('order_main')->where('id', (int) $o['id'])->first(['wallet_amount', 'wallet_hold_status']);
            if ((int) $row['wallet_hold_status'] === self::RELEASED && (float) $row['wallet_amount'] > 0) {
                WalletLedger::debit((int) $o['site_id'], (int) $o['user_id'], (float) $row['wallet_amount'], WalletLedger::TYPE_SPEND,
                    (int) $o['id'], "订单 {$o['order_no']} 迟到付清,钱包抵扣重新扣回");
                Db::table('order_main')->where('id', (int) $o['id'])->update(['wallet_hold_status' => self::HELD]);
            }
        }
    }

    /** 订单 / Trip 当前钱包支付额(冻结或已支付才算) */
    public static function walletAmountOf(array $row): float
    {
        return in_array((int) ($row['wallet_hold_status'] ?? 0), [self::HELD, self::PAID], true)
            ? round((float) ($row['wallet_amount'] ?? 0), 2) : 0.0;
    }

    /**
     * 抵扣额按各预订应付比例分摊(纯函数口径:分为单位,末单吸收尾差)。
     *
     * @param list<array> $bookings
     * @return array<int, float> orderId => 分摊额
     */
    public static function splitByPay(array $bookings, float $amount): array
    {
        $total = array_sum(array_map(static fn ($b) => WalletLedger::cents($b['pay_amount']), $bookings));
        $left = WalletLedger::cents($amount);
        $out = [];
        $n = count($bookings);
        foreach (array_values($bookings) as $i => $b) {
            $share = $i === $n - 1 || $total <= 0
                ? $left
                : (int) floor(WalletLedger::cents($amount) * WalletLedger::cents($b['pay_amount']) / $total);
            $share = min($share, $left);
            $out[(int) $b['id']] = $share / 100;
            $left -= $share;
        }
        return $out;
    }

    /** 抵扣后剩余应由其他方式支付的金额;为 0 表示钱包已付清 */
    public static function remainder(float $payAmount, float $walletAmount): float
    {
        if ($walletAmount - $payAmount > 0.005) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '钱包抵扣额超过应付金额');
        }
        return max(0.0, round($payAmount - $walletAmount, 2));
    }

    /** 订单是否用过钱包抵扣(部分抵扣的订单退款退回钱包) */
    public static function isMixed(array $order): bool
    {
        return (int) ($order['pay_method'] ?? 0) !== 3
            && (float) ($order['wallet_amount'] ?? 0) > 0
            && in_array((int) ($order['wallet_hold_status'] ?? 0), [self::HELD, self::PAID], true);
    }
}
