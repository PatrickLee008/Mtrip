<?php

declare(strict_types=1);

namespace App\Service\Booking;

use Hyperf\DbConnection\Db;

/**
 * 预订时间线:不可覆盖事件流水(预订/支付/库存/退款/同步/安全)
 * 失败记录只落脱敏后的业务原因,不暴露内部异常栈。
 */
class BookingEventService
{
    /** 写一条时间线事件(须在调用方事务内或事件后置容错调用) */
    public function log(
        array $order,
        string $eventType,
        int $operatorType,
        int $operatorId = 0,
        string $operatorName = '',
        int $status = 1,
        ?array $detail = null,
        string $category = 'booking'
    ): void {
        Db::table('order_booking_event')->insert([
            'site_id' => (int) ($order['site_id'] ?? 0),
            'order_id' => (int) ($order['id'] ?? 0),
            'order_no' => (string) ($order['order_no'] ?? ''),
            'merchant_id' => (int) ($order['merchant_id'] ?? 0),
            'event_category' => $category,
            'event_type' => $eventType,
            'status' => $status,
            'detail' => $detail !== null ? json_encode($detail, JSON_UNESCAPED_UNICODE) : null,
            'operator_type' => $operatorType,
            'operator_id' => $operatorId,
            'operator_name' => mb_substr($operatorName, 0, 50),
        ]);
    }

    /** 时间线分页(详情面板展示,倒序) */
    public function list(int $orderId, int $page, int $pageSize): array
    {
        $query = Db::table('order_booking_event')->where('order_id', $orderId)->orderByDesc('id');
        $total = (clone $query)->count();
        $list = $query->forPage($page, $pageSize)->get()
            ->map(static function ($row) {
                $row = (array) $row;
                $row['detail'] = is_string($row['detail']) && $row['detail'] !== ''
                    ? json_decode($row['detail'], true)
                    : null;
                return $row;
            })->all();
        return ['list' => $list, 'total' => $total];
    }
}
