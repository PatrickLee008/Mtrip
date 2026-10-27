<?php

declare(strict_types=1);

use Hyperf\Crontab\Crontab;

/*
 * 统一支付中心定时任务(方案 22 阶段 4)
 * singleton:同进程内上一轮未结束不再启动;onOneServer:多实例时 Redis 互斥只跑一份。
 * 各任务内部仍以条件更新 / 行锁保证幂等,互斥只是减少重复调用 KBZ。
 */
return [
    'enable' => true,
    'crontab' => [
        // pending 流水主动查单收敛(通知丢失补单 / 过期关单)
        (new Crontab())->setName('pay-reconcile')->setRule('* * * * *')
            ->setSingleton(true)->setOnOneServer(true)->setMutexExpires(300)
            ->setCallback([\App\Service\PayReconcileService::class, 'run']),
        // 业务通知 outbox 到期推送(支付 + 退款)
        (new Crontab())->setName('pay-biz-notify')->setRule('* * * * *')
            ->setSingleton(true)->setOnOneServer(true)->setMutexExpires(300)
            ->setCallback([\App\Service\BizNotifyService::class, 'processDue']),
        // 处理中退款状态收敛
        (new Crontab())->setName('refund-sync')->setRule('* * * * *')
            ->setSingleton(true)->setOnOneServer(true)->setMutexExpires(300)
            ->setCallback([\App\Service\RefundService::class, 'syncProcessing']),
    ],
];