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

    /** KBZ 原路退款排队 / 提交(与平台退款同一套) */
    #[Inject]
    protected RefundSettleService $refundSettle;

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
                $policyRefundable = $this->stepRefundable($roomPay, is_string($policy['rules'] ?? null) ? (json_decode($policy['rules'], true) ?: []) : (array) ($policy['rules'] ?? []), (string) ($order['use_date'] ?? ''));
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
        $remainingPaid = max(0.0, round($pay - $refundedAlready, 2));
        $remainingRefundable = max(0.0, round($policyRefundable - $refundedAlready, 2));
        $refundable = min($remainingPaid, $remainingRefundable);
        return [
            'payAmount' => round($pay, 2),
            'policyRefundable' => round($policyRefundable, 2),
            'refundable' => round($refundable, 2),
            'cancellationFee' => round($pay - $policyRefundable, 2),
            'refundedAlready' => $refundedAlready,
            'remainingPaid' => $remainingPaid,
            'remainingRefundable' => round($refundable, 2),
        ];
    }

    /**
     * 商户发起退款(行锁+前置校验+幂等):按试算上限内金额退款。
     * $amount=null 按政策全额可退额;部分退款订单继续有效,全额退款关闭预订。
     *
     * - 钱包 / mock 支付的订单:直退 mTrip 钱包,当场完成;
     * - KBZPay MMQR 支付的订单(pay_method=5):原路退回,与平台退款同一套——建「退款中」退款单并排队
     *   (独立单立即提交支付中心,行程支付等合并窗口),到账由支付中心通知经 RefundSettleService::completeRow 收敛
     *   (库存回补 / 返券 / 订单退款状态 / 支出流水都在到账时做);全额退款的已确认预订当场取消。
     * - 进行中的退款单阻塞新退款,但迟到支付退款单(late_pay=1)不阻塞(SettleRules::hasBlockingRefund)。
     *
     * @return array{refundNo:string, refundAmount:float, fullRefund:bool, order:array, channel:string, message:string, kbzRefund?:array}
     */
    public function apply(array $order, int $operatorId, string $operatorName, ?float $amount, string $reason): array
    {
        if (RefundSettleService::isKbzOrder($order)) {
            return $this->applyOriginal($order, $operatorId, $operatorName, $amount, $reason);
        }
        $result = Db::transaction(function () use ($order, $operatorId, $operatorName, $amount, $reason) {
            $order = $this->lockRefundable($order);
            if (RefundSettleService::isKbzOrder($order)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单支付方式已变更,请刷新后重试');
            }
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
            ]);

            $bookingStatus = (int) $order['booking_status'];
            $update = [
                'refund_status' => $fullRefund ? 3 : 2,
                'payment_status' => $fullRefund ? BookingConst::PAY_REFUNDED : BookingConst::PAY_PARTIAL_REFUNDED,
                'version' => Db::raw('version + 1'),
            ];
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

    /** KBZPay MMQR 订单的商户退款:建退款中单 + 排队原路退回(见 apply 注释) */
    private function applyOriginal(array $order, int $operatorId, string $operatorName, ?float $amount, string $reason): array
    {
        $result = Db::transaction(function () use ($order, $operatorId, $operatorName, $amount, $reason) {
            $order = $this->lockRefundable($order);
            if (! RefundSettleService::isKbzOrder($order)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单支付方式已变更,请刷新后重试');
            }
            if (! PaymentRules::isValidPayNo((string) $order['pay_trade_no'])) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单缺少 KBZPay 支付单号,无法原路退款');
            }
            [$quote, $refundAmount, $fullRefund] = $this->resolveAmount($order, $amount);
            $refundNo = RefundSettleService::newRefundNo();
            $now = date('Y-m-d H:i:s');
            $id = (int) Db::table('order_refund')->insertGetId(array_merge([
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
                'refund_channel' => 2,
                'reason' => mb_substr($reason !== '' ? $reason : '商户按政策退款', 0, 500),
                'status' => 2,
                'merchant_audit_by' => $operatorId,
                'merchant_audit_time' => $now,
            ], RefundSettleService::queueFields($order)));

            // 订单进入「退款中」;到账时 completeRow 再写 部分退款 / 已退款、回补库存、返券
            $update = ['refund_status' => 1, 'version' => Db::raw('version + 1')];
            if ($fullRefund && (int) $order['booking_status'] === BookingConst::STATUS_CONFIRMED) {
                // 全额退款即关闭预订(与钱包退款一致,预订当场取消,不等渠道到账)
                $update['booking_status'] = BookingConst::STATUS_CANCELLED;
                $update['cancel_reason'] = '全额退款关闭';
                $update['cancel_time'] = $now;
            }
            Db::table('order_main')->where('id', (int) $order['id'])->update($update);
            $this->events->log($order, 'refund_applied', BookingConst::OPERATOR_MERCHANT, $operatorId, $operatorName, 1, [
                'refundNo' => $refundNo,
                'refundAmount' => $refundAmount,
                'fullRefund' => $fullRefund,
                'channel' => 'original',
                'payNo' => (string) $order['pay_trade_no'],
            ], 'refund');
            $refund = (array) Db::table('order_refund')->where('id', $id)->first();
            return ['refundNo' => $refundNo, 'refundAmount' => $refundAmount, 'fullRefund' => $fullRefund, 'order' => $order, 'refund' => $refund];
        });

        try {
            $kbz = $this->refundSettle->afterQueued($result['refund'], $result['order'], 0);
        } catch (\Throwable $e) {
            // 立即提交没成(如该支付单正被并发处理):退款单仍在队列,由 kbz-refund-batch 补提交
            $kbz = ['status' => 'queued', 'refundNo' => '', 'message' => '已加入 KBZPay 原路退款队列,稍后自动提交'];
        }
        try {
            UserNotify::order($result['order'], 'refund_requested_original', ['amount' => $result['refundAmount']]);
        } catch (\Throwable) {
        }
        try {
            $this->notify->push($result['order'], '预订退款已提交', "预订「{$result['order']['goods_name']}」(订单 {$result['order']['order_no']})已发起退款 {$result['refundAmount']}(" . ($result['fullRefund'] ? '全额' : '部分') . '),将原路退回住客 KBZPay 支付账户。');
        } catch (\Throwable) {
        }
        unset($result['refund']);
        return $result + ['channel' => 'original', 'message' => '退款已提交,' . $kbz['message'], 'kbzRefund' => $kbz];
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

    /** 阶梯退款:按政策快照规则,距入住(当日14:00)剩余小时命中可满足的最优档 */
    private function stepRefundable(float $pay, array $rules, string $useDate): float
    {
        if ($rules === []) {
            return $pay;
        }
        $checkin = $useDate !== '' ? strtotime($useDate . ' 14:00:00') : false;
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
