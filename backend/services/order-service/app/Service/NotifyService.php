<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;

/**
 * 站内通知服务:预订生命周期事件写 notify_record(In-App)。
 * 多渠道(Push/SMS/Email)与模板本地化后续接第三方时在此扩展分发。
 */
class NotifyService
{
    /** 写一条订单类站内通知(须容错,不阻断主流程时由调用方决定是否包 try) */
    public function pushOrder(int $siteId, int $userId, string $eventKey, string $title, string $content, int $orderId): void
    {
        Db::table('notify_record')->insert([
            'site_id' => $siteId,
            'user_id' => $userId,
            'event_key' => $eventKey,
            'title' => mb_substr($title, 0, 200),
            'content' => mb_substr($content, 0, 1000),
            'biz_type' => 1,
            'biz_id' => $orderId,
            'is_read' => 0,
        ]);
    }
}
