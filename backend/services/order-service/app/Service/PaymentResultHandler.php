<?php

declare(strict_types=1);

namespace App\Service;

use App\Constants\BookingConst;
use App\Service\Booking\BookingEventService;
use App\Service\Booking\BookingNotificationService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * 支付结果统一入口(实现方案 §3.3/§7.1):
 * 本期接模拟支付,未来真实支付回调复用同一入口;页面/控制器不得直接改预订状态。
 * 调用方须在已持有订单行锁的事务内调用(保证支付/超时竞争只有一个合法结果)。
 */
class PaymentResultHandler
{
    #[Inject]
    protected BookingEventService $events;

    #[Inject]
    protected BookingNotificationService $notify;

    /**
     * 支付成功 → Pending Payment 转 Confirmed(仅确认一次)。
     * @param array $order 已行锁的订单行
     * @return string 核销码
     */
    public function markPaid(array $order, int $payMethod, string $tradeNo, string $verifyCode): string
    {
        $status = (int) $order['booking_status'];
        if ((int) $order['order_status'] === 1 && ($status === BookingConst::STATUS_CONFIRMED || $status === 0)) {
            return (string) $order['verify_code']; // 幂等:已支付直接返回原核销码(含旧订单兼容态)
        }
        // 新预订须处于待支付;旧订单(booking_status=0)以 order_status=0 判定兼容双写
        if ((int) $order['order_status'] !== 0 || ! in_array($status, [0, BookingConst::STATUS_PENDING_PAYMENT], true)) {
            // 已被超时任务取消或其他终态:迟到支付不得直接确认
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '订单不是待支付状态');
        }
        Db::table('order_main')->where('id', (int) $order['id'])->update([
            'order_status' => 1,
            'booking_status' => BookingConst::STATUS_CONFIRMED,
            'payment_status' => BookingConst::PAY_PAID,
            'pay_method' => $payMethod,
            'pay_trade_no' => $tradeNo,
            'pay_time' => date('Y-m-d H:i:s'),
            'confirmed_at' => date('Y-m-d H:i:s'),
            'verify_code' => $verifyCode,
            'version' => Db::raw('version + 1'),
        ]);
        $order['booking_status'] = BookingConst::STATUS_CONFIRMED;
        $this->events->log($order, 'payment_success', BookingConst::OPERATOR_GUEST, (int) $order['user_id'], '', 1, [
            'payMethod' => $payMethod,
            'tradeNo' => $tradeNo,
        ], 'payment');
        return $verifyCode;
    }

    /** 支付失败记录(不改变预订状态,仅支付状态与时间线) */
    public function markFailed(array $order, string $reason): void
    {
        Db::table('order_main')->where('id', (int) $order['id'])
            ->where('booking_status', BookingConst::STATUS_PENDING_PAYMENT)
            ->update(['payment_status' => BookingConst::PAY_FAILED, 'version' => Db::raw('version + 1')]);
        $this->events->log($order, 'payment_failed', BookingConst::OPERATOR_GUEST, (int) $order['user_id'], '', 2, [
            'reason' => mb_substr($reason, 0, 200),
        ], 'payment');
    }

    /** 支付成功后的商户通知(事件后置容错,不影响支付主流程) */
    public function notifyMerchantConfirmed(array $order): void
    {
        try {
            $this->notify->push(
                $order,
                '新预订已确认',
                "收到新预订「{$order['goods_name']}」(订单 {$order['order_no']},{$order['sku_name']} ×{$order['quantity']},入住 {$order['use_date']}),住客 {$order['contact_name']},已支付确认。"
            );
        } catch (\Throwable) {
        }
    }

    /** 新预订创建通知(待支付下单成功即通知商户,事件后置容错) */
    public function notifyMerchantNewBooking(array $order): void
    {
        try {
            $this->notify->push(
                $order,
                '收到新预订(待支付)',
                "收到新预订「{$order['goods_name']}」(订单 {$order['order_no']},{$order['sku_name']} ×{$order['quantity']},入住 {$order['use_date']}),等待住客支付。"
            );
        } catch (\Throwable) {
        }
    }
}
