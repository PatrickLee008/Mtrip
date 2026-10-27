<?php

declare(strict_types=1);

use Hyperf\Crontab\Crontab;

return [
    'enable' => true,
    'crontab' => [
        // Merchant App M4:预订 10 分钟支付超时自动取消并释放库存
        (new Crontab())->setName('booking-payment-expiry')->setRule('* * * * *')
            ->setCallback([\App\Service\Booking\BookingExpiryService::class, 'expireDue']),
        // Merchant App M4 §9.3:PMS/CM 同步 Outbox 到期任务处理(重试退避/失败通知)
        (new Crontab())->setName('booking-sync-outbox')->setRule('* * * * *')
            ->setCallback([\App\Service\Booking\BookingSyncService::class, 'processDueTasks']),
        // Consumer App PRD 模块 10:离店 1 天后未评价的预订发「邀请评价」站内通知(每单一次)
        (new Crontab())->setName('booking-review-request')->setRule('17 * * * *')
            ->setCallback([\App\Service\Booking\ReviewRequestService::class, 'sendDue']),
        // 方案 22 §9.1 遗留 5:KBZ 原路退款排队行按 pay_no 合并提交(窗口 env KBZ_REFUND_MERGE_SECONDS,默认 300 秒);
        // singleton:上一轮未结束不再启动;onOneServer:多实例(含 APP 孪生池)Redis 互斥只跑一份
        (new Crontab())->setName('kbz-refund-batch')->setRule('* * * * *')
            ->setSingleton(true)->setOnOneServer(true)->setMutexExpires(300)
            ->setCallback([\App\Service\Payment\RefundSettleService::class, 'processQueue']),
    ],
];
