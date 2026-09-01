<?php

declare(strict_types=1);

namespace App\Service\Booking;

use Hyperf\DbConnection\Db;

/**
 * 商户预订通知:新预订/支付确认/取消/退款/入住/退房/No-show/同步失败。
 * 复用既有 merchant_notify(booking 分类 + booking_detail 深链);
 * 通知写入失败不回滚预订主事务,由调用方事件后置容错。
 */
class BookingNotificationService
{
    /** 深链前缀:商户端 /order 页按 notificationTarget 自动打开目标预订 */
    private const DEEP_LINK_PREFIX = '/order?notificationTarget=';

    /** 推送一条商户预订通知(失败抛异常由调用方吞掉,不阻断主流程) */
    public function push(array $order, string $title, string $message): void
    {
        if ((int) ($order['merchant_id'] ?? 0) <= 0) {
            return;
        }
        Db::table('merchant_notify')->insert([
            'site_id' => (int) ($order['site_id'] ?? 0),
            'merchant_id' => (int) $order['merchant_id'],
            'category' => 'booking',
            'title' => mb_substr($title, 0, 200),
            'message' => mb_substr($message, 0, 1000),
            'deep_link_type' => 'booking_detail',
            'deep_link_value' => self::DEEP_LINK_PREFIX . (int) $order['id'],
            'channels' => 'inapp',
            'send_type' => 1,
            'send_at' => date('Y-m-d H:i:s'),
            'status' => 1,
            'operator_id' => 0,
            'operator_name' => 'system',
        ]);
    }
}
