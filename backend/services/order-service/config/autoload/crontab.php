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
    ],
];
