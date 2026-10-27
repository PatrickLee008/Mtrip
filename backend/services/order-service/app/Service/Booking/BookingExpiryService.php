<?php

declare(strict_types=1);

namespace App\Service\Booking;

use App\Constants\BookingConst;
use App\Service\OrderStockService;
use App\Service\Payment\MmqrCheckoutService;
use App\Service\Payment\PaymentSettleService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Payment\SettleRules;
use Mtrip\Shared\Support\UserNotify;
use Psr\Log\LoggerInterface;

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

    /** Trip 整单关闭(与取消共用同一实现) */
    #[Inject]
    protected BookingLifecycleService $lifecycle;

    /** KBZPay MMQR 取消前查单 / 已付落账 */
    #[Inject]
    protected MmqrCheckoutService $checkout;

    #[Inject]
    protected PaymentSettleService $settle;

    #[Inject]
    protected LoggerFactory $loggerFactory;

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
        $checked = [];
        foreach ($ids as $orderId) {
            try {
                if (! $this->mmqrAllowsCancel($orderId, $checked)) {
                    continue;
                }
                $this->expireOne($orderId);
            } catch (\Throwable) {
                // 单笔失败不阻断批次,下轮重试
            }
        }
    }

    /**
     * KBZPay MMQR 前置查单(方案 22 §6.3 末段):出过码(pay_method=5)的待支付单取消前先让支付中心实时查 KBZ
     *
     * - paid / late → 直接走 onPaid 落账(本轮不取消);
     * - pending(WAIT_PAY / PAYING)→ 本轮不取消,下轮再查;
     * - 支付中心不可用 → 本轮不取消并告警,避免把已付款订单误取消;
     *   但过期超过 SettleRules::EXPIRY_GRACE_SECONDS(30 分钟)后 pending / 不可用都照常取消:
     *   KBZ 码先于订单过期(timeout = 剩余-1 分钟),30 分钟后仍未确认基本可判定未付;
     *   不能无限期占库存,真有迟到到账由业务通知走「恢复或原路退款」兜底。
     * - 无流水 / failed / closed → 照常取消。
     * 同一 Trip / 订单本批只查一次($checked 缓存)。返回 true = 可以取消。
     */
    private function mmqrAllowsCancel(int $orderId, array &$checked): bool
    {
        $order = Db::table('order_main')->where('id', $orderId)
            ->first(['id', 'order_no', 'trip_id', 'pay_method', 'payment_expires_at']);
        if (! $order || (int) $order->pay_method !== BookingConst::PAY_METHOD_KBZ_MMQR) {
            return true;
        }
        $tripId = (int) $order->trip_id;
        if ($tripId > 0) {
            $bizType = BookingConst::PAY_BIZ_TRIP;
            $bizNo = (string) Db::table('order_trip')->where('id', $tripId)->value('trip_no');
        } else {
            $bizType = BookingConst::PAY_BIZ_ORDER;
            $bizNo = (string) $order->order_no;
        }
        $key = $bizType . ':' . $bizNo;
        if (isset($checked[$key])) {
            return $checked[$key];
        }

        $query = null;
        $unavailable = false;
        try {
            $query = $this->checkout->center()->queryPayment(['bizType' => $bizType, 'bizNo' => $bizNo, 'refresh' => 1]);
        } catch (BusinessException $e) {
            $unavailable = $e->getCode() !== ErrorCode::NOT_FOUND;
        } catch (\Throwable) {
            $unavailable = true;
        }
        $expiresAt = strtotime((string) $order->payment_expires_at) ?: time();
        $action = SettleRules::expiryAction($query['status'] ?? null, $unavailable, $expiresAt, time());
        $context = ['orderId' => $orderId, 'bizType' => $bizType, 'bizNo' => $bizNo, 'payStatus' => $query['status'] ?? null, 'action' => $action];

        if ($action === SettleRules::EXPIRY_SETTLE && $query !== null) {
            $result = $this->settle->onPaid($query, false);
            $this->logger()->info('expiry_precheck_settled 取消前查单发现已支付,已落账', $context + ['settle' => $result['action']]);
            // 已入账 → 不再是待支付;判为原路退款(金额不符 / 券或商户不可用等)→ 订单照常超时取消,释放库存
            return $checked[$key] = in_array($result['action'], [SettleRules::ACTION_REFUND, 'ignored'], true);
        }
        if ($action === SettleRules::EXPIRY_DEFER) {
            if ($unavailable) {
                $this->logger()->warning('expiry_precheck_unavailable 支付中心不可用,本轮不取消', $context);
            }
            return $checked[$key] = false;
        }
        if ($unavailable || ($query['status'] ?? '') === 'pending') {
            $this->logger()->warning('expiry_precheck_grace_exceeded 超过宽限仍未确认支付,照常取消', $context);
        }
        return $checked[$key] = true;
    }

    private function logger(): LoggerInterface
    {
        return $this->loggerFactory->get('payment-settle');
    }

    /** 单笔过期处理(幂等:状态复检,重复调用无副作用) */
    public function expireOne(int $orderId): bool
    {
        $closedSiblings = [];
        $order = Db::transaction(function () use ($orderId, &$closedSiblings) {
            $trip = $this->lifecycle->lockTripFor($orderId);
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
                'cancel_reason' => BookingConst::EXPIRY_CANCEL_REASON,
                'cancel_time' => date('Y-m-d H:i:s'),
                'version' => Db::raw('version + 1'),
            ]);
            $this->stockService->release($order);
            $order['booking_status'] = BookingConst::STATUS_CANCELLED;
            $this->events->log($order, 'payment_expired', BookingConst::OPERATOR_SYSTEM, 0, '', 1, [
                'expiredAt' => date('Y-m-d H:i:s'),
            ], 'payment');
            $closedSiblings = $this->lifecycle->closePendingTrip($trip, $order, BookingConst::EXPIRY_CANCEL_REASON,BookingConst::OPERATOR_SYSTEM, 0, '');
            return $order;
        });

        if ($order !== null) {
            foreach ([$order, ...$closedSiblings] as $expired) {
                try {
                    $this->notify->push($expired, '预订支付超时已取消', "预订「{$expired['goods_name']}」(订单 {$expired['order_no']})住客未在时限内支付,已自动取消并释放库存。");
                } catch (\Throwable) {
                }
                try {
                    UserNotify::order($expired, 'booking_expired');
                } catch (\Throwable) {
                }
            }
            return true;
        }
        return false;
    }
}
