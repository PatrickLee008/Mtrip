<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Hyperf\DbConnection\Db;

/**
 * C 端站内通知(Consumer App PRD 模块 10 Notification Center)的唯一写入口。
 *
 * 一条通知 = 事件键 + 变量(params JSON)。**文案在 App 端按当前语言渲染**(i18n `notifications.events.{event}`),
 * 这样切换语言后历史通知也跟着变;这里另外按英文模板渲染一份 title/content 存库,
 * 给后台排查和没有对应文案的旧版本 App 兜底。
 *
 * 写在 mtrip_business.notify_record,order-service / user-service 都直接调用;
 * 只做站内信(In-App),Push / SMS / Email 待接第三方服务商后在 send() 里扩展分发。
 * 调用方须在业务事务**之后**调用并自行容错 —— 通知失败不能回滚预订、退款等主流程。
 */
final class UserNotify
{
    /** 业务类型:1 订单(App「Booking」页签)/ 3 系统(「System」页签) */
    public const BIZ_ORDER = 1;

    public const BIZ_SYSTEM = 3;

    /**
     * 事件 → [业务类型, 英文标题, 英文正文];正文里的 {var} 用 params 替换。
     * 新增事件时三处同改:这里、App i18n `notifications.events.*`、App 通知页的跳转映射。
     */
    public const EVENTS = [
        'booking_confirmed' => [self::BIZ_ORDER, 'Booking confirmed', 'Your booking at {hotel} ({orderNo}) for {checkIn} - {checkOut} has been confirmed.'],
        'booking_cancelled' => [self::BIZ_ORDER, 'Booking cancelled', 'Your booking at {hotel} ({orderNo}) has been cancelled.'],
        'booking_expired' => [self::BIZ_ORDER, 'Booking cancelled', 'Your booking at {hotel} ({orderNo}) was cancelled because payment was not completed in time.'],
        'refund_requested' => [self::BIZ_ORDER, 'Cancellation requested', 'Your cancellation for {hotel} ({orderNo}) was submitted. A refund of {amount} to your mTrip Wallet is pending review.'],
        'refund_completed' => [self::BIZ_ORDER, 'Refund completed', 'A refund of {amount} for {hotel} ({orderNo}) has been credited to your mTrip Wallet.'],
        // 原路退回(KBZPay 等外部渠道支付的订单;钱包 / mock 单仍用上面两条)
        'refund_requested_original' => [self::BIZ_ORDER, 'Cancellation requested', 'Your cancellation for {hotel} ({orderNo}) was submitted. A refund of {amount} will be returned to your original payment account after review.'],
        'refund_completed_original' => [self::BIZ_ORDER, 'Refund completed', 'A refund of {amount} for {hotel} ({orderNo}) has been returned to your original payment account.'],
        'refund_completed_wallet_fallback' => [self::BIZ_ORDER, 'Refund completed', 'The payment channel refund limit was reached, so the refund of {amount} for {hotel} ({orderNo}) has been credited to your mTrip Wallet.'],
        // 付款在支付窗口关闭后才到账(方案 22 §6.3)
        'payment_late_recovered' => [self::BIZ_ORDER, 'Booking confirmed', 'Your payment for {hotel} ({orderNo}) arrived after the booking timed out. The booking has been restored and confirmed.'],
        'payment_late_refunded' => [self::BIZ_ORDER, 'Payment refunded', 'Your payment for {hotel} ({orderNo}) arrived after the booking was closed. A full refund of {amount} to your original payment account is being processed.'],
        'payment_late_refund_failed' => [self::BIZ_ORDER, 'Refund under review', 'Your payment for {hotel} ({orderNo}) arrived after the booking was closed. The automatic refund of {amount} did not go through; our support team will process it manually.'],
        'review_request' => [self::BIZ_ORDER, 'How was your stay?', 'Share your experience at {hotel} and earn loyalty points.'],
        'appeal_result' => [self::BIZ_SYSTEM, 'Appeal result', 'Your account appeal has been reviewed: {result}.'],
    ];

    /** 按英文模板渲染标题与正文(存库兜底用);缺的变量留空 */
    public static function render(string $event, array $params): array
    {
        [, $title, $body] = self::EVENTS[$event] ?? [self::BIZ_SYSTEM, $event, ''];
        $body = (string) preg_replace_callback('/\{(\w+)\}/', static function (array $m) use ($params): string {
            $value = $params[$m[1]] ?? '';
            return is_scalar($value) ? (string) $value : '';
        }, $body);
        return [$title, $body];
    }

    /** 写一条站内通知;未知事件直接忽略(不让拼写错误把主流程带崩) */
    public static function send(int $siteId, int $userId, string $event, array $params, int $bizId = 0): void
    {
        if ($userId <= 0 || ! isset(self::EVENTS[$event])) {
            return;
        }
        [$title, $content] = self::render($event, $params);
        Db::table('notify_record')->insert([
            'site_id' => $siteId,
            'user_id' => $userId,
            'event_key' => $event,
            'params' => json_encode($params, JSON_UNESCAPED_UNICODE),
            'title' => mb_substr($title, 0, 200),
            'content' => mb_substr($content, 0, 1000),
            'biz_type' => self::EVENTS[$event][0],
            'biz_id' => $bizId,
            'is_read' => 0,
        ]);
    }

    /** 订单类通知的公共变量(酒店名 / 订单号 / 入离日期),从 order_main 行取 */
    public static function orderParams(array $order, array $extra = []): array
    {
        return [
            'hotel' => (string) ($order['goods_name'] ?? ''),
            'orderNo' => (string) ($order['order_no'] ?? ''),
            'checkIn' => (string) ($order['use_date'] ?? ''),
            'checkOut' => (string) ($order['end_date'] ?? ''),
        ] + $extra;
    }

    /** 订单类通知的快捷写法:站点 / 用户 / 业务 ID 都取自订单行 */
    public static function order(array $order, string $event, array $extra = []): void
    {
        self::send((int) $order['site_id'], (int) $order['user_id'], $event, self::orderParams($order, $extra), (int) $order['id']);
    }
}
