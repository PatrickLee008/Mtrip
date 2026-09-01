<?php

declare(strict_types=1);

namespace App\Service\Booking;

use App\Constants\BookingConst;
use App\Service\OrderStockService;
use App\Service\WalletService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\OrderNoGenerator;

/**
 * 预订退款服务(实现方案 §7.1):按下单时冻结的政策快照试算/发起/跟踪退款。
 * 商户发起即按现有钱包退款模型闭环(入 mTrip 钱包 + 资金流水),不受后来规则修改影响。
 */
class BookingRefundService
{
    #[Inject]
    protected OrderStockService $stockService;

    #[Inject]
    protected WalletService $walletService;

    #[Inject]
    protected BookingEventService $events;

    #[Inject]
    protected BookingNotificationService $notify;

    /**
     * 政策试算:基于订单取消政策快照(无快照=免费取消全额可退)。
     * @return array{payAmount:float,refundable:float,cancellationFee:float,refundedAlready:float,remainingRefundable:float}
     */
    public function quote(array $order): array
    {
        $pay = (float) $order['pay_amount'];
        $policy = $order['cancellation_policy_snapshot'] ?? null;
        if (is_string($policy)) {
            $policy = json_decode($policy, true);
        }
        $refundable = $pay;
        if (is_array($policy)) {
            $type = (int) ($policy['ruleType'] ?? 1);
            if ($type === 3) {
                $refundable = 0.0;
            } elseif ($type === 2) {
                $refundable = $this->stepRefundable($pay, (array) ($policy['rules'] ?? []), (string) ($order['use_date'] ?? ''));
            }
        }
        $refundedAlready = round((float) Db::table('order_refund')
            ->where('order_id', (int) $order['id'])
            ->where('status', 3)
            ->whereNull('deleted_at')
            ->sum('refund_amount'), 2);
        $remaining = max(0.0, round($pay - $refundedAlready, 2));
        $refundable = min($refundable, $remaining);
        return [
            'payAmount' => round($pay, 2),
            'refundable' => round($refundable, 2),
            'cancellationFee' => round($pay - $refundable, 2),
            'refundedAlready' => $refundedAlready,
            'remainingRefundable' => $remaining,
        ];
    }

    /**
     * 商户发起退款(行锁+前置校验+幂等):按试算上限内金额直退钱包。
     * $amount=null 按政策全额可退额;部分退款订单继续有效,全额退款关闭预订。
     */
    public function apply(array $order, int $operatorId, string $operatorName, ?float $amount, string $reason): array
    {
        $result = Db::transaction(function () use ($order, $operatorId, $operatorName, $amount, $reason) {
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
            $pending = Db::table('order_refund')->where('order_id', (int) $order['id'])
                ->whereIn('status', [0, 1, 2])->whereNull('deleted_at')->exists();
            if ($pending) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该预订已有进行中的退款单');
            }
            $quote = $this->quote($order);
            if ($quote['remainingRefundable'] <= 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该预订已无可退金额');
            }
            $refundAmount = $amount !== null ? round($amount, 2) : $quote['refundable'];
            if ($refundAmount <= 0 || $refundAmount > $quote['remainingRefundable'] + 0.001) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '退款金额须在可退范围内');
            }
            $refundAmount = min($refundAmount, $quote['remainingRefundable']);
            $fullRefund = $refundAmount >= $quote['remainingRefundable'] - 0.001;

            $refundNo = 'R' . date('YmdHis') . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            Db::table('order_refund')->insert([
                'refund_no' => $refundNo,
                'site_id' => (int) $order['site_id'],
                'order_id' => (int) $order['id'],
                'order_no' => (string) $order['order_no'],
                'user_id' => (int) $order['user_id'],
                'merchant_id' => (int) $order['merchant_id'],
                'refund_type' => $fullRefund ? 1 : 2,
                'apply_amount' => $refundAmount,
                'refund_amount' => $refundAmount,
                'deduct_amount' => round($quote['payAmount'] - $refundAmount, 2),
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
            if ($fullRefund && in_array($bookingStatus, [BookingConst::STATUS_CONFIRMED, BookingConst::STATUS_CANCELLED], true)) {
                $this->stockService->refundRestore($order);
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
            return ['refundNo' => $refundNo, 'refundAmount' => $refundAmount, 'fullRefund' => $fullRefund, 'order' => $order];
        });

        try {
            $this->notify->push($result['order'], '预订退款已处理', "预订「{$result['order']['goods_name']}」(订单 {$result['order']['order_no']})已退款 {$result['refundAmount']}(" . ($result['fullRefund'] ? '全额' : '部分') . '),退入住客 mTrip 钱包。');
        } catch (\Throwable) {
        }
        return $result;
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
