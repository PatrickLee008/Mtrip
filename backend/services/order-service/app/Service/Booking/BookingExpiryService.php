<?php

declare(strict_types=1);

namespace App\Service\Booking;

use App\Constants\BookingConst;
use App\Service\OrderStockService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;

/**
 * 预订支付超时服务(实现方案 §2.3):每分钟扫描到期未支付预订,
 * 批量、幂等(行锁+状态复检)、可重试;超时即取消并释放锁定库存。
 * 竞争规则:与支付共用同一行锁,先完成事务者生效,迟到支付不得直接确认。
 */
class BookingExpiryService
{
    #[Inject]
    protected OrderStockService $stockService;

    #[Inject]
    protected BookingEventService $events;

    #[Inject]
    protected BookingNotificationService $notify;

    /** 定时任务入口:批量处理到期预订(单批上限 200,超出下轮继续) */
    public function expireDue(): void
    {
        $ids = Db::table('order_main')
            ->where('booking_status', BookingConst::STATUS_PENDING_PAYMENT)
            ->where('payment_status', BookingConst::PAY_PENDING)
            ->whereNotNull('payment_expires_at')
            ->where('payment_expires_at', '<=', date('Y-m-d H:i:s'))
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->limit(200)
            ->pluck('id')
            ->map(static fn ($id) => (int) $id)
            ->all();
        foreach ($ids as $orderId) {
            try {
                $this->expireOne($orderId);
            } catch (\Throwable) {
                // 单笔失败不阻断批次,下轮重试
            }
        }
    }

    /** 单笔过期处理(幂等:状态复检,重复调用无副作用) */
    public function expireOne(int $orderId): bool
    {
        $order = Db::transaction(function () use ($orderId) {
            $order = Db::table('order_main')->where('id', $orderId)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $order) {
                return null;
            }
            $order = (array) $order;
            if ((int) $order['booking_status'] !== BookingConst::STATUS_PENDING_PAYMENT
                || (int) $order['payment_status'] !== BookingConst::PAY_PENDING) {
                return null; // 已支付/已取消/已过期,幂等跳过
            }
            if ($order['payment_expires_at'] !== null && strtotime((string) $order['payment_expires_at']) > time()) {
                return null; // 未到截止时间(时钟偏差保护)
            }
            Db::table('order_main')->where('id', $orderId)->update([
                'order_status' => 4,
                'booking_status' => BookingConst::STATUS_CANCELLED,
                'cancel_reason' => '支付超时,系统自动取消',
                'cancel_time' => date('Y-m-d H:i:s'),
                'version' => Db::raw('version + 1'),
            ]);
            $this->stockService->release($order);
            $order['booking_status'] = BookingConst::STATUS_CANCELLED;
            $this->events->log($order, 'payment_expired', BookingConst::OPERATOR_SYSTEM, 0, '', 1, [
                'expiredAt' => date('Y-m-d H:i:s'),
            ], 'payment');
            return $order;
        });

        if ($order !== null) {
            try {
                $this->notify->push($order, '预订支付超时已取消', "预订「{$order['goods_name']}」(订单 {$order['order_no']})住客未在时限内支付,已自动取消并释放库存。");
            } catch (\Throwable) {
            }
            return true;
        }
        return false;
    }
}
