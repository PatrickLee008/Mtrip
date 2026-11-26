<?php

declare(strict_types=1);

namespace App\Service\Booking;

use App\Constants\BookingConst;
use App\Service\OrderStockService;
use App\Service\Payment\RefundSettleService;
use App\Service\PricingService;
use App\Service\WalletService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Payment\PaymentRules;
use Mtrip\Shared\Payment\SettleRules;
use Mtrip\Shared\Support\OrderNoGenerator;
use Mtrip\Shared\Support\UserNotify;

/**
 * 预订退款服务(实现方案 §7.1):按下单时冻结的政策快照试算/发起/跟踪退款。
 * 钱包 / mock 支付:商户发起即按钱包退款模型闭环(入 mTrip 钱包 + 资金流水);
 * KBZPay MMQR 支付:原路退回,经 RefundSettleService 排队 / 提交支付中心(方案 22 §9.1 遗留 2)。
 * 金额按下单时冻结的政策快照计算,不受后来规则修改影响。
 */
class BookingRefundService
{
    #[Inject]
    protected OrderStockService $stockService;

    /** 取消/全额退款后返还优惠券 */
    #[Inject]
    protected PricingService $pricingService;

    #[Inject]
    protected WalletService $walletService;

    #[Inject]
    protected BookingEventService $events;

    #[Inject]
    protected BookingNotificationService $notify;

    /**
     * 政策试算:基于订单取消政策快照(无快照=免费取消全额可退)。
     * @return array{payAmount:float,policyRefundable:float,refundable:float,cancellationFee:float,refundedAlready:float,remainingPaid:float,remainingRefundable:float}
     */
    public function quote(array $order): array
    {
        /* 附加服务全额退,不受取消政策影响:政策只作用于房费部分,最后再把附加服务加回可退额 */
        $pay = (float) $order['pay_amount'];
        $addon = min($pay, max(0.0, (float) ($order['addon_amount'] ?? 0)));
        $roomPay = round($pay - $addon, 2);
        $policy = $order['cancellation_policy_snapshot'] ?? null;
        if (is_string($policy)) {
            $policy = json_decode($policy, true);
        }
        $policyRefundable = $roomPay;
        if (is_array($policy)) {
            $type = (int) ($policy['ruleType'] ?? 1);
            if ($type === 3) {
                $policyRefundable = 0.0;
            } elseif ($type === 2) {
                $policyRefundable = $this->stepRefundable($roomPay, is_string($policy['rules'] ?? null) ? (json_decode($policy['rules'], true) ?: []) : (array) ($policy['rules'] ?? []), $order);
            }
        }
        $policyRefundable = round($policyRefundable + $addon, 2);
        // 迟到支付退款单(late_pay=1)退的是未计入订单的钱,不占订单可退额
        $refundedAlready = round((float) Db::table('order_refund')
            ->where('order_id', (int) $order['id'])
            ->where('status', 3)
            ->where('late_pay', 0)
            ->whereNull('deleted_at')
            ->sum('refund_amount'), 2);
        $completed = $this->completedComponents($order);
        $noShow = $this->isPayAtHotelNoShow($order);
        if ($noShow) {
            $policyRefundable = round($refundedAlready + PayAtHotelRefundBreakdown::noShowRefundable($order, $completed), 2);
        }
        $remainingPaid = max(0.0, round($pay - $refundedAlready, 2));
        $remainingRefundable = max(0.0, round($policyRefundable - $refundedAlready, 2));
        $refundable = min($remainingPaid, $remainingRefundable);
        $parts = $this->breakdown($order, $refundable, $completed);
        if ((int) ($order['pay_at_hotel'] ?? 0) === 1) {
            $refundable = min($refundable, round(array_sum($parts), 2));
            $policyRefundable = round($refundedAlready + $refundable, 2);
        }
        return [
            'payAmount' => round($pay, 2),
            'policyRefundable' => round($policyRefundable, 2),
            'refundable' => round($refundable, 2),
            'cancellationFee' => round($pay - $policyRefundable, 2),
            'refundedAlready' => $refundedAlready,
            'remainingPaid' => $remainingPaid,
            'remainingRefundable' => round($refundable, 2),
        ] + $parts;
    }

    public function breakdownFor(array $order, float $amount): array
    {
        return $this->breakdown($order, $amount, $this->completedComponents($order));
    }

    /** Merchant escalations require platform review; they never directly debit or credit a wallet. */
    public function requestFromMerchant(array $order, int $actor, string $name, ?float $amount, string $reason): array
    {
        return Db::transaction(function () use ($order, $actor, $name, $amount, $reason): array {
            $order = $this->lockRefundable($order);
            [$quote, $approved, $full] = $this->resolveAmount($order, $amount);
            $no = RefundSettleService::newRefundNo();
            Db::table('order_refund')->insert(['refund_no' => $no, 'site_id' => $order['site_id'], 'order_id' => $order['id'],
                'order_no' => $order['order_no'], 'user_id' => $order['user_id'], 'merchant_id' => $order['merchant_id'],
                'property_id' => $order['property_id'], 'room_type_id' => $order['room_type_id'], 'refund_type' => $full ? 1 : 2,
                'apply_amount' => $approved, 'refund_amount' => $approved,
                'refund_channel' => (int) ($order['pay_at_hotel'] ?? 0) === 1 ? 0 : 1,
                'reason' => mb_substr($reason !== '' ? $reason : 'Merchant refund escalation', 0, 500), 'status' => 1,
                'merchant_audit_by' => $actor, 'merchant_audit_time' => gmdate('Y-m-d H:i:s')]
                + $this->breakdownFor($order, $approved));
            Db::table('order_main')->where('id', $order['id'])->update(['refund_status' => 1, 'order_status' => 5, 'version' => Db::raw('version + 1')]);
            $this->events->log($order, 'refund_applied', BookingConst::OPERATOR_MERCHANT, $actor, $name, 1,
                ['refundNo' => $no, 'refundAmount' => $approved, 'platformReviewRequired' => true], 'refund');
            return ['refundNo' => $no, 'refundAmount' => $approved, 'channel' => (int) ($order['pay_at_hotel'] ?? 0) === 1 ? 'awaiting_guest' : 'wallet',
                'refundStatus' => 'pending_review'];
        });
    }

    /** A confirmed prepaid cancellation waits for the guest to select the payout destination. */
    public function refundHotelCancellation(array $order, int $actor, string $name): void
    {
        if (Db::table('order_refund')->where('order_id', $order['id'])->where('status', 2)->where('late_pay', 0)->whereNull('deleted_at')->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'A refund is processing; finish it before hotel cancellation');
        }
        Db::table('order_refund')->where('order_id', $order['id'])->whereIn('status', [0,1])->where('late_pay', 0)
            ->whereNull('deleted_at')->update(['status' => 5, 'audit_remark' => 'Superseded by full hotel cancellation refund']);
        $completed = $this->completedComponents($order);
        $paidBack = (float) Db::table('order_refund')->where('order_id', $order['id'])->where('status', 3)->where('late_pay', 0)
            ->whereNull('deleted_at')->sum('refund_amount');
        $remaining = round((float) $order['pay_amount'] - $paidBack, 2);
        if ($remaining <= 0) return;
        Db::table('order_refund')->insert(['refund_no' => RefundSettleService::newRefundNo(),
            'site_id' => $order['site_id'], 'order_id' => $order['id'], 'order_no' => $order['order_no'],
            'user_id' => $order['user_id'], 'merchant_id' => $order['merchant_id'], 'property_id' => $order['property_id'],
            'room_type_id' => $order['room_type_id'], 'refund_type' => 1, 'apply_amount' => $remaining, 'refund_amount' => $remaining,
            'refund_channel' => 0, 'reason' => 'Booking cancelled before check-in: awaiting guest refund destination', 'status' => 2,
            'merchant_audit_by' => $actor, 'merchant_audit_time' => gmdate('Y-m-d H:i:s')]
            + PayAtHotelRefundBreakdown::of($order, $remaining, $completed));
        Db::table('order_main')->where('id', $order['id'])->update(['refund_status' => 1]);
    }

    /**
     * 商户发起退款(行锁+前置校验+幂等):按试算上限内金额退款。
     * $amount=null 按政策全额可退额;部分退款订单继续有效,全额退款关闭预订。
     *
     * 该内部入口处理 No-show 差额及附加服务，按钱包记账。
     * - 进行中的退款单阻塞新退款,但迟到支付退款单(late_pay=1)不阻塞(SettleRules::hasBlockingRefund)。
     *
     * @return array{refundNo:string, refundAmount:float, fullRefund:bool, order:array, channel:string, message:string, kbzRefund?:array}
     */
    public function apply(array $order, int $operatorId, string $operatorName, ?float $amount, string $reason): array
    {

        $result = Db::transaction(function () use ($order, $operatorId, $operatorName, $amount, $reason) {
            $order = $this->lockRefundable($order);
            [$quote, $refundAmount, $fullRefund] = $this->resolveAmount($order, $amount);

            $refundNo = RefundSettleService::newRefundNo();
            Db::table('order_refund')->insert([
                'refund_no' => $refundNo,
                'site_id' => (int) $order['site_id'],
                'order_id' => (int) $order['id'],
                'order_no' => (string) $order['order_no'],
                'user_id' => (int) $order['user_id'],
                'merchant_id' => (int) $order['merchant_id'],
                'property_id' => (int) $order['property_id'],
                'room_type_id' => (int) $order['room_type_id'],
                'refund_type' => $fullRefund ? 1 : 2,
                'apply_amount' => $refundAmount,
                'refund_amount' => $refundAmount,
                'deduct_amount' => $quote['cancellationFee'],
                'refund_channel' => 1,
                'reason' => mb_substr($reason !== '' ? $reason : '商户按政策退款', 0, 500),
                'status' => 3,
                'merchant_audit_by' => $operatorId,
                'merchant_audit_time' => date('Y-m-d H:i:s'),
                'refund_time' => date('Y-m-d H:i:s'),
            ] + $this->breakdown($order, $refundAmount, $this->completedComponents($order)));

            $bookingStatus = (int) $order['booking_status'];
            $update = [
                'refund_status' => $fullRefund ? 3 : 2,
                'payment_status' => $fullRefund ? BookingConst::PAY_REFUNDED : BookingConst::PAY_PARTIAL_REFUNDED,
                'version' => Db::raw('version + 1'),
            ];
            if ((int) ($order['pay_at_hotel'] ?? 0) === 1) $update['hotel_reconciliation_status'] = 0;
            if ($fullRefund) {
                $update['order_status'] = 6;
                // 全额退款关闭预订;未履约(已确认)的预订同时置为已取消
                if ($bookingStatus === BookingConst::STATUS_CONFIRMED) {
                    $update['booking_status'] = BookingConst::STATUS_CANCELLED;
                    $update['cancel_reason'] = '全额退款关闭';
                    $update['cancel_time'] = date('Y-m-d H:i:s');
                }
            }
            Db::table('order_main')->where('id', (int) $order['id'])->update($update);
            // 库存:未履约的全额退款回补已售;已入住/已退房视为已消耗不回补
            if ($fullRefund && $bookingStatus === BookingConst::STATUS_CONFIRMED) {
                $this->stockService->refundRestore($order);
            }
            // 全额退款即订单关闭:返还优惠券(部分退款订单仍有效,券继续占用)
            if ($fullRefund) {
                $this->pricingService->releaseCoupon($order);
            }
            // 退入 mTrip 钱包 + 资金流水(与后台退款到账确认同模型)
            if ($refundAmount > 0) {
                $this->walletService->credit(
                    (int) $order['site_id'],
                    (int) $order['user_id'],
                    $refundAmount,
                    3,
                    (int) $order['id'],
                    $operatorId,
                    "退款单 {$refundNo} 退入钱包",
                );
            }
            Db::table('finance_flow')->insert([
                'flow_no' => OrderNoGenerator::flowNo(),
                'site_id' => (int) $order['site_id'],
                'flow_type' => 2,
                'biz_type' => 2,
                'amount' => $refundAmount,
                'order_id' => (int) $order['id'],
                'merchant_id' => (int) $order['merchant_id'],
                'property_id' => (int) $order['property_id'],
                'room_type_id' => (int) $order['room_type_id'],
                'user_id' => (int) $order['user_id'],
                'pay_channel' => 0,
                'trade_no' => '',
                'flow_status' => 1,
                'remark' => "退款单 {$refundNo} 商户退款入钱包",
                'operator_id' => $operatorId,
            ]);
            $this->events->log($order, 'refund_completed', BookingConst::OPERATOR_MERCHANT, $operatorId, $operatorName, 1, [
                'refundNo' => $refundNo,
                'refundAmount' => $refundAmount,
                'fullRefund' => $fullRefund,
            ], 'refund');
            return ['refundNo' => $refundNo, 'refundAmount' => $refundAmount, 'fullRefund' => $fullRefund, 'order' => $order,
                'channel' => 'wallet', 'message' => '退款已完成'];
        });

        try {
            UserNotify::order($result['order'], 'refund_completed', ['amount' => $result['refundAmount']]);
        } catch (\Throwable) {
        }
        try {
            $this->notify->push($result['order'], '预订退款已处理', "预订「{$result['order']['goods_name']}」(订单 {$result['order']['order_no']})已退款 {$result['refundAmount']}(" . ($result['fullRefund'] ? '全额' : '部分') . '),退入住客 mTrip 钱包。');
        } catch (\Throwable) {
        }
        return $result;
    }

    /** 行锁取订单并做退款前置校验(已支付、非待支付、无阻塞中的退款单) */
    private function lockRefundable(array $order): array
    {
        $order = (array) Db::table('order_main')->where('id', (int) $order['id'])->whereNull('deleted_at')->lockForUpdate()->first();
        if ($order === []) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '预订不存在');
        }
        if ((int) $order['payment_status'] !== BookingConst::PAY_PAID
            && (int) $order['payment_status'] !== BookingConst::PAY_PARTIAL_REFUNDED) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已支付预订可退款');
        }
        if ((int) $order['booking_status'] === BookingConst::STATUS_PENDING_PAYMENT) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '待支付预订请直接取消');
        }
        $refunds = Db::table('order_refund')->where('order_id', (int) $order['id'])->whereNull('deleted_at')
            ->get(['status', 'late_pay'])->map(static fn ($r) => (array) $r)->all();
        if (SettleRules::hasBlockingRefund($refunds)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该预订已有进行中的退款单');
        }
        return $order;
    }

    /**
     * 按试算核定本次退款额
     *
     * @return array{0: array, 1: float, 2: bool} [quote, refundAmount, fullRefund]
     */
    private function resolveAmount(array $order, ?float $amount): array
    {
        $quote = $this->quote($order);
        if ($quote['refundable'] <= 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该预订已无可退金额');
        }
        $refundAmount = $amount !== null ? round($amount, 2) : $quote['refundable'];
        if ($refundAmount <= 0 || $refundAmount > $quote['refundable'] + 0.001) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '退款金额须在可退范围内');
        }
        $refundAmount = min($refundAmount, $quote['refundable']);
        $fullRefund = $quote['refundedAlready'] + $refundAmount >= $quote['payAmount'] - 0.001;
        return [$quote, $refundAmount, $fullRefund];
    }

    private function completedComponents(array $order): array
    {
        if ((int) ($order['pay_at_hotel'] ?? 0) !== 1) {
            return [];
        }
        $rows = Db::table('order_refund')->where('order_id', (int) $order['id'])
            ->where('status', 3)->where('late_pay', 0)->whereNull('deleted_at')
            ->get(['refund_hotel_commission', 'refund_hotel_deposit', 'refund_transaction_fee', 'refund_addon']);
        $totals = array_fill_keys(['refund_hotel_commission', 'refund_hotel_deposit', 'refund_transaction_fee', 'refund_addon'], 0.0);
        foreach ($rows as $row) {
            foreach ($totals as $key => $_) {
                $totals[$key] = round($totals[$key] + (float) $row->{$key}, 2);
            }
        }
        return $totals;
    }

    private function isPayAtHotelNoShow(array $order): bool
    {
        return (int) ($order['pay_at_hotel'] ?? 0) === 1
            && (int) ($order['booking_status'] ?? 0) === BookingConst::STATUS_NO_SHOW;
    }

    private function breakdown(array $order, float $amount, array $completed): array
    {
        $order['hotel_transaction_fee'] = 0;
        if ((int) ($order['pay_at_hotel'] ?? 0) === 1 && ! $this->isPayAtHotelNoShow($order) && $this->protectedCommission($order)) {
            // Past the disclosed free-cancellation window, commission and its fee are non-refundable.
            $order['hotel_commission'] = 0;
            $order['hotel_deposit'] = 0;
        }
        return $this->isPayAtHotelNoShow($order)
            ? PayAtHotelRefundBreakdown::noShow($order, $amount, $completed)
            : PayAtHotelRefundBreakdown::of($order, $amount, $completed);
    }

    private function protectedCommission(array $order): bool
    {
        $policy = $order['cancellation_policy_snapshot'] ?? null;
        $policy = is_string($policy) ? json_decode($policy, true) : $policy;
        if (! is_array($policy) || (int) ($policy['ruleType'] ?? 1) === 1) return false;
        if ((int) $policy['ruleType'] === 3) return true;
        $rules = is_string($policy['rules'] ?? null) ? (json_decode($policy['rules'], true) ?: []) : (array) ($policy['rules'] ?? []);
        return $this->stepRefundable(100, $rules, $order) < 100;
    }

    /** 阶梯退款:按政策快照规则,距入住(当日14:00)剩余小时命中可满足的最优档 */
    private function stepRefundable(float $pay, array $rules, array $order): float
    {
        if ($rules === []) {
            return $pay;
        }
        $useDate = (string) ($order['use_date'] ?? '');
        $snapshot = $order['no_show_policy_snapshot'] ?? null;
        $snapshot = is_string($snapshot) ? json_decode($snapshot, true) : $snapshot;
        $timezone = $snapshot['timezone'] ?? Db::connection('system')->table('sys_site')->where('id', $order['site_id'])->value('timezone') ?? 'UTC';
        try { $zone = new \DateTimeZone((string) $timezone); } catch (\Exception) { $zone = new \DateTimeZone('UTC'); }
        $checkin = $useDate !== '' ? (new \DateTimeImmutable($useDate . ' 14:00:00', $zone))->getTimestamp() : false;
        $hoursUntil = $checkin !== false ? ($checkin - time()) / 3600 : 0;
        usort($rules, static fn ($a, $b) => (float) ($b['hours_before'] ?? 0) <=> (float) ($a['hours_before'] ?? 0));
        foreach ($rules as $tier) {
            $tier = (array) $tier;
            if ($hoursUntil >= (float) ($tier['hours_before'] ?? 0)) {
                return round($pay * (float) ($tier['refund_rate'] ?? 0) / 100, 2);
            }
        }
        return 0.0;
    }
}
