<?php

declare(strict_types=1);

namespace App\Service\Booking;

use App\Constants\BookingConst;
use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

use function Hyperf\Support\make;

/**
 * PMS/Channel Manager 同步适配层(实现方案 §9.3):
 * 供应商无关——Outbox 表、日志表、重试退避、状态回写与手动重试入口;
 * 连接器经配置 `mtrip.booking.sync_connector`(类名)注册,实现 SyncConnectorInterface。
 * 未配置连接器一律 not_connected,不得显示 synced,不得制造演示同步数据。
 * 取得具体服务商协议后在适配层新增连接器,不改预订页面与生命周期核心。
 */
class BookingSyncService
{
    #[Inject]
    protected ConfigInterface $config;

    #[Inject]
    protected BookingNotificationService $notify;

    #[Inject]
    protected BookingEventService $events;

    /** 酒店是否已配置同步连接器(本期无连接器资料,恒为未连接) */
    public function isConnected(int $siteId, int $merchantId, int $goodsId): bool
    {
        // 后续接入:按酒店读取连接器配置;本期没有服务商资料,恒未连接
        return $this->connector() !== null;
    }

    /** 订单同步状态展示值 */
    public function statusOf(array $order): string
    {
        $connected = $this->isConnected((int) $order['site_id'], (int) $order['merchant_id'], (int) $order['goods_id']);
        if (! $connected) {
            return BookingConst::SYNC_NOT_CONNECTED;
        }
        return (string) ($order['pms_sync_status'] ?? BookingConst::SYNC_PENDING);
    }

    /**
     * 手动同步(Force Sync):未连接直接业务失败;
     * 已连接时入 Outbox 任务(同目标同幂等键不重复入队)并把订单同步状态置为待同步。
     */
    public function forceSync(array $order, string $target = 'pms'): array
    {
        if (! $this->isConnected((int) $order['site_id'], (int) $order['merchant_id'], (int) $order['goods_id'])) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'PMS/Channel Manager 未连接,无法同步');
        }
        $key = $target . ':' . (int) $order['id'] . ':' . (int) $order['version'];
        $taskId = Db::table('order_sync_task')->insertOrIgnore([
            'site_id' => (int) $order['site_id'],
            'merchant_id' => (int) $order['merchant_id'],
            'order_id' => (int) $order['id'],
            'order_no' => (string) $order['order_no'],
            'target' => $target,
            'action' => 'update',
            'status' => 0,
            'next_retry_at' => date('Y-m-d H:i:s'),
            'idempotency_key' => $key,
            'payload' => json_encode(['orderNo' => $order['order_no'], 'bookingStatus' => $order['booking_status']], JSON_UNESCAPED_UNICODE),
        ]);
        // 真实状态展示:入队即置待同步,页面不显示 synced 直到任务成功
        $statusColumn = $target === 'channel' ? 'channel_sync_status' : 'pms_sync_status';
        Db::table('order_main')->where('id', (int) $order['id'])->update([$statusColumn => BookingConst::SYNC_PENDING]);
        return ['taskId' => $taskId, 'status' => BookingConst::SYNC_PENDING];
    }

    /**
     * 处理到期 Outbox 任务(每分钟定时任务):
     * 成功→状态2+订单状态 synced+日志;失败→指数退避重试,达上限→状态3+订单状态 failed+商户通知+日志。
     * @return array{success:int,retried:int,failed:int}
     */
    public function processDueTasks(int $limit = 50): array
    {
        $result = ['success' => 0, 'retried' => 0, 'failed' => 0];
        $tasks = Db::table('order_sync_task')
            ->where('status', 0)->where('next_retry_at', '<=', date('Y-m-d H:i:s'))
            ->orderBy('next_retry_at')->orderBy('id')->limit($limit)->get();
        foreach ($tasks as $task) {
            $task = (array) $task;
            // CAS 抢占:并发下仅一个处理者能置为处理中
            $claimed = Db::table('order_sync_task')->where('id', $task['id'])->where('status', 0)
                ->update(['status' => 1]);
            if ($claimed !== 1) {
                continue;
            }
            try {
                $connector = $this->connector();
                if ($connector === null) {
                    throw new \RuntimeException('PMS/CM 连接器不可用');
                }
                $connector->push($task);
                $this->markSuccess($task, $connector->name());
                ++$result['success'];
            } catch (\Throwable $e) {
                $this->markFailure($task, mb_substr($e->getMessage(), 0, 500));
                if ((int) $task['retry_count'] + 1 >= (int) $task['max_retry']) {
                    ++$result['failed'];
                } else {
                    ++$result['retried'];
                }
            }
        }
        return $result;
    }

    /** 任务成功:状态回写 + 订单同步状态置 synced + 落日志 */
    private function markSuccess(array $task, string $connectorName): void
    {
        Db::table('order_sync_task')->where('id', $task['id'])->update([
            'status' => 2,
            'last_error' => '',
        ]);
        $this->updateOrderSyncStatus($task, BookingConst::SYNC_SYNCED);
        $this->writeLog($task, 1, 'connector=' . $connectorName, 'ok', '');
    }

    /** 任务失败:落日志;未达上限按 2^retry 分钟退避重试,达上限终态+订单置 failed+商户通知 */
    private function markFailure(array $task, string $error): void
    {
        $retryCount = (int) $task['retry_count'] + 1;
        $this->writeLog($task, 2, '', '', $error);
        if ($retryCount >= (int) $task['max_retry']) {
            Db::table('order_sync_task')->where('id', $task['id'])->update([
                'status' => 3,
                'retry_count' => $retryCount,
                'last_error' => $error,
            ]);
            $this->updateOrderSyncStatus($task, BookingConst::SYNC_FAILED);
            $this->notifyFailure($task, $error);
            return;
        }
        Db::table('order_sync_task')->where('id', $task['id'])->update([
            'status' => 0,
            'retry_count' => $retryCount,
            'last_error' => $error,
            'next_retry_at' => date('Y-m-d H:i:s', time() + (2 ** ($retryCount - 1)) * 60),
        ]);
    }

    /** 订单同步状态回写(按目标列) */
    private function updateOrderSyncStatus(array $task, string $status): void
    {
        $column = $task['target'] === 'channel' ? 'channel_sync_status' : 'pms_sync_status';
        Db::table('order_main')->where('id', (int) $task['order_id'])->update([$column => $status]);
    }

    /** 每次尝试落一条同步日志(脱敏摘要) */
    private function writeLog(array $task, int $status, string $requestSummary, string $responseSummary, string $error): void
    {
        Db::table('order_sync_log')->insert([
            'site_id' => (int) $task['site_id'],
            'task_id' => (int) $task['id'],
            'order_id' => (int) $task['order_id'],
            'order_no' => (string) $task['order_no'],
            'target' => (string) $task['target'],
            'action' => (string) $task['action'],
            'status' => $status,
            'request_summary' => mb_substr($requestSummary, 0, 1000),
            'response_summary' => mb_substr($responseSummary, 0, 1000),
            'error_message' => mb_substr($error, 0, 500),
        ]);
    }

    /** 达重试上限:商户通知(容错)+时间线事件 */
    private function notifyFailure(array $task, string $error): void
    {
        $targetText = $task['target'] === 'channel' ? 'Channel Manager' : 'PMS';
        $order = [
            'id' => (int) $task['order_id'],
            'merchant_id' => (int) $task['merchant_id'],
            'order_no' => (string) $task['order_no'],
        ];
        try {
            $this->notify->push($order, '同步失败', "订单 {$task['order_no']} 的 {$targetText} 同步已重试 {$task['max_retry']} 次仍失败,请在预订详情中查看并重试。");
        } catch (\Throwable) {
        }
        try {
            $this->events->log($order, 'sync_failed', BookingConst::OPERATOR_SYSTEM, 0, 'system', 2, [
                'target' => (string) $task['target'],
                'error' => $error,
            ], 'sync');
        } catch (\Throwable) {
        }
    }

    /** 解析配置的连接器实例;未配置/类不存在/未实现契约一律返回 null(=未连接) */
    private function connector(): ?SyncConnectorInterface
    {
        $class = $this->config->get('mtrip.booking.sync_connector', false);
        if (! is_string($class) || $class === '' || ! class_exists($class)) {
            return null;
        }
        $instance = make($class);
        return $instance instanceof SyncConnectorInterface ? $instance : null;
    }
}
