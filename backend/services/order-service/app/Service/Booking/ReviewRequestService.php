<?php

declare(strict_types=1);

namespace App\Service\Booking;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Support\UserNotify;

/**
 * 「邀请评价」站内通知(Consumer App PRD 模块 10 Review Request):离店 1 天后,还没评价的预订发一次。
 *
 * 规则(PRD Business Rules):
 *   - 只针对已入住 / 已完成(order_status 2/3)、归属了物业的酒店预订 —— 与评价接口的可评条件一致;
 *   - 每个预订只发一次(按 notify_record 的 event_key + biz_id 判重),已经评价过的不发;
 *   - 只回看最近 30 天离店的预订,首次上线不会给陈年老单群发。
 * 每小时跑一次,单批上限 500,超出下轮继续。
 */
class ReviewRequestService
{
    private const BATCH = 500;

    private const LOOKBACK_DAYS = 30;

    public function sendDue(): void
    {
        $latestCheckout = date('Y-m-d', strtotime('-1 day'));
        $earliestCheckout = date('Y-m-d', strtotime('-' . self::LOOKBACK_DAYS . ' days'));
        $orders = Db::table('order_main as o')
            ->where('o.order_type', 1)
            ->whereIn('o.order_status', [2, 3])
            ->where('o.property_id', '>', 0)
            ->whereNull('o.deleted_at')
            ->whereBetween('o.end_date', [$earliestCheckout, $latestCheckout])
            ->whereNotExists(static function ($q): void {
                $q->select(Db::raw(1))->from('goods_review as r')->whereColumn('r.order_id', 'o.id');
            })
            ->whereNotExists(static function ($q): void {
                $q->select(Db::raw(1))->from('notify_record as n')
                    ->where('n.event_key', 'review_request')->whereColumn('n.biz_id', 'o.id');
            })
            ->orderBy('o.id')
            ->limit(self::BATCH)
            ->get(['o.id', 'o.site_id', 'o.user_id', 'o.goods_name', 'o.order_no', 'o.use_date', 'o.end_date']);
        foreach ($orders as $order) {
            try {
                UserNotify::order((array) $order, 'review_request');
            } catch (\Throwable) {
                // 单条失败不影响其余;没写进去的下一轮会再扫到
            }
        }
    }
}
