<?php

declare(strict_types=1);

namespace App\Service\Booking;

/**
 * PMS/Channel Manager 同步连接器契约(实现方案 §9.3):
 * 供应商无关适配接口——取得具体服务商协议后新增实现类并在
 * 配置 `mtrip.booking.sync_connector` 注册,不改预订页面与生命周期核心。
 */
interface SyncConnectorInterface
{
    /** 连接器名称(写入同步日志,便于排查) */
    public function name(): string;

    /**
     * 推送一条 Outbox 任务到外部系统;任何失败抛出异常,
     * 由 BookingSyncService 统一落日志、退避重试并在达上限后通知商户。
     * @param array $task order_sync_task 行(含 target/action/payload 等)
     */
    public function push(array $task): void;
}
