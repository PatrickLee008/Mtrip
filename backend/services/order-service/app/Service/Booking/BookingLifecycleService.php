<?php

declare(strict_types=1);

namespace App\Service\Booking;

use App\Constants\BookingConst;
use App\Service\OrderStockService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * 预订生命周期服务(实现方案-Merchant-M4 §5/§7.1):
 * 唯一状态变更入口——状态矩阵前置校验 + 事务行锁 + version 乐观锁 + 旧字段双写 + 时间线。
 * 页面/控制器不得直接改状态;支付结果经 PaymentResultHandler 复用本服务。
 */
class BookingLifecycleService
{
    #[Inject]
    protected BookingEventService $events;

    #[Inject]
    protected OrderStockService $stockService;

    #[Inject]
    protected BookingNotificationService $notify;

    /**
     * 下单时组装预订字段(须在下单事务内调用):
     * 预订/支付状态、10 分钟支付截止、特殊请求与政策快照(政策此后不再随规则修改变化)。
     */
    public function buildCreateFields(int $orderType, int $goodsId, int $skuId, string $remark): array
    {
        $fields = [
            'booking_status' => BookingConst::STATUS_PENDING_PAYMENT,
            'payment_status' => BookingConst::PAY_PENDING,
            'booking_channel' => BookingConst::CHANNEL_MTRIP,
            'payment_expires_at' => date('Y-m-d H:i:s', time() + BookingConst::PAYMENT_WINDOW_MINUTES * 60),
            'special_requests' => mb_substr($remark, 0, 1000),
        ];
        if ($orderType === 1) {
            $policy = $this->currentRefundPolicy($goodsId, $skuId);
            $fields['cancellation_policy_snapshot'] = $policy !== null
                ? json_encode($policy + ['snapshotAt' => date('Y-m-d H:i:s')], JSON_UNESCAPED_UNICODE)
                : null;
            // No-show 政策:平台默认首晚房费,酒店级政策接入后按酒店配置覆盖
            $fields['no_show_policy_snapshot'] = json_encode(['feeType' => 'first_night', 'source' => 'default'], JSON_UNESCAPED_UNICODE);
        }
        return $fields;
    }

    /** 下单时冻结的取消政策(房型级优先于商品级;无规则=免费取消) */
    public function currentRefundPolicy(int $goodsId, int $skuId): ?array
    {
        $rule = Db::table('goods_refund_rule')
            ->where('goods_id', $goodsId)->whereNull('deleted_at')
            ->where(static function ($q) use ($skuId) {
                $q->where(static function ($q2) use ($skuId) {
                    $q2->where('sku_type', 1)->where('sku_id', $skuId);
                })->orWhere('sku_type', 0);
            })
            ->orderByDesc('sku_type')->first();
        if (! $rule) {
            return null;
        }
        $rule = (array) $rule;
        return [
            'ruleType' => (int) $rule['rule_type'],
            'rules' => $rule['rules'] ?? [],
            'remark' => (string) ($rule['remark'] ?? ''),
            'source' => 'goods_refund_rule',
        ];
    }

    /**
     * 人工确认预订:仅外部渠道/到店付订单(非 mTrip 在线单);
     * mTrip 在线订单必须由支付结果自动确认。
     */
    public function confirm(int $orderId, int $operatorId, string $operatorName): array
    {
        return Db::transaction(function () use ($orderId, $operatorId, $operatorName) {
            $order = $this->lockOrder($orderId);
            // 渠道校验优先于幂等返回:任何状态的 mTrip 在线单都不允许人工确认入口
            if ((string) $order['booking_channel'] === BookingConst::CHANNEL_MTRIP) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, 'mTrip 在线预订须由支付确认,不允许人工确认');
            }
            if ((int) $order['booking_status'] === BookingConst::STATUS_CONFIRMED) {
                return $order; // 幂等:已确认直接返回
            }
            if ((int) $order['booking_status'] !== BookingConst::STATUS_PENDING_PAYMENT) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待支付预订可确认');
            }
            $this->transition($order, [
                'booking_status' => BookingConst::STATUS_CONFIRMED,
                'order_status' => 1,
                'confirmed_at' => date('Y-m-d H:i:s'),
                'cancel_reason' => '',
            ]);
            // 到店付/外部渠道占用库存同样锁定转已售
            $this->stockService->deduct($order);
            $order = $this->lockOrder($orderId);
            $this->events->log($order, 'confirmed', BookingConst::OPERATOR_MERCHANT, $operatorId, $operatorName, 1, [
                'channel' => (string) $order['booking_channel'],
            ]);
            return $order;
        });
    }

    /** 入住(可带房号);幂等重复调用不重复通知(§9.1) */
    public function checkIn(int $orderId, int $operatorId, string $operatorName, string $roomNo = ''): array
    {
        [$order, $changed] = Db::transaction(function () use ($orderId, $operatorId, $operatorName, $roomNo) {
            $order = $this->lockOrder($orderId);
            if ((int) $order['booking_status'] === BookingConst::STATUS_CHECKED_IN) {
                return [$order, false]; // 幂等:已入住直接返回,不再通知
            }
            if ((int) $order['booking_status'] !== BookingConst::STATUS_CONFIRMED) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已确认预订可办理入住');
            }
            $this->transition($order, array_merge([
                'booking_status' => BookingConst::STATUS_CHECKED_IN,
                'order_status' => 2,
                'checked_in_at' => date('Y-m-d H:i:s'),
            ], $roomNo !== '' ? ['assigned_room_no' => mb_substr($roomNo, 0, 50)] : []));
            $order = $this->lockOrder($orderId);
            $this->events->log($order, 'checked_in', BookingConst::OPERATOR_MERCHANT, $operatorId, $operatorName, 1, [
                'roomNo' => (string) $order['assigned_room_no'],
            ]);
            return [$order, true];
        });
        if ($changed) {
            $roomText = (string) $order['assigned_room_no'];
            $this->notifyQuietly($order, '住客已入住', "预订「{$order['goods_name']}」(订单 {$order['order_no']})已办理入住" . ($roomText !== '' ? ",房号:{$roomText}" : '') . '。');
        }
        return $order;
    }

    /** 退房;幂等重复调用不重复通知(§9.1) */
    public function checkOut(int $orderId, int $operatorId, string $operatorName): array
    {
        [$order, $changed] = Db::transaction(function () use ($orderId, $operatorId, $operatorName) {
            $order = $this->lockOrder($orderId);
            if ((int) $order['booking_status'] === BookingConst::STATUS_CHECKED_OUT) {
                return [$order, false]; // 幂等:已退房直接返回,不再通知
            }
            if ((int) $order['booking_status'] !== BookingConst::STATUS_CHECKED_IN) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已入住预订可办理退房');
            }
            $this->transition($order, [
                'booking_status' => BookingConst::STATUS_CHECKED_OUT,
                'order_status' => 3,
                'checked_out_at' => date('Y-m-d H:i:s'),
            ]);
            $order = $this->lockOrder($orderId);
            $this->events->log($order, 'checked_out', BookingConst::OPERATOR_MERCHANT, $operatorId, $operatorName);
            return [$order, true];
        });
        if ($changed) {
            $this->notifyQuietly($order, '住客已退房', "预订「{$order['goods_name']}」(订单 {$order['order_no']})已办理退房。");
        }
        return $order;
    }

    /**
     * 取消预订:待支付释放锁定库存;已支付回补已售库存(退款另行按政策处理)。
     * 允许来源:待支付/已确认。
     */
    public function cancel(int $orderId, int $operatorId, string $operatorName, string $reason, int $operatorType = BookingConst::OPERATOR_MERCHANT): array
    {
        $order = Db::transaction(function () use ($orderId, $operatorId, $operatorName, $reason, $operatorType) {
            $order = $this->lockOrder($orderId);
            if ((int) $order['booking_status'] === BookingConst::STATUS_CANCELLED) {
                return $order; // 幂等:已取消直接返回
            }
            if (! in_array((int) $order['booking_status'], [BookingConst::STATUS_PENDING_PAYMENT, BookingConst::STATUS_CONFIRMED], true)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前预订状态不可取消');
            }
            $paid = (int) $order['payment_status'] === BookingConst::PAY_PAID;
            $this->transition($order, [
                'booking_status' => BookingConst::STATUS_CANCELLED,
                'order_status' => 4,
                'cancel_reason' => mb_substr($reason !== '' ? $reason : '商户取消', 0, 500),
                'cancel_time' => date('Y-m-d H:i:s'),
            ]);
            // 库存联动:已支付回补已售,未支付释放锁定
            $paid ? $this->stockService->refundRestore($order) : $this->stockService->release($order);
            $order = $this->lockOrder($orderId);
            $this->events->log($order, 'cancelled', $operatorType, $operatorId, $operatorName, 1, [
                'reason' => (string) $order['cancel_reason'],
                'paid' => $paid,
            ]);
            return $order;
        });
        $this->notifyQuietly($order, '预订已取消', "预订「{$order['goods_name']}」(订单 {$order['order_no']})已取消,原因:{$order['cancel_reason']}。");
        return $order;
    }

    /**
     * 标记 No-show:仅已确认且已过入住截止时间(默认入住日当地 23:59)。
     * 费用按政策快照(默认首晚房费);豁免需独立权限并在调用方校验,原因入时间线。
     */
    public function markNoShow(int $orderId, int $operatorId, string $operatorName, bool $waiveFee = false, string $waiveReason = ''): array
    {
        $order = Db::transaction(function () use ($orderId, $operatorId, $operatorName, $waiveFee, $waiveReason) {
            $order = $this->lockOrder($orderId);
            if ((int) $order['booking_status'] === BookingConst::STATUS_NO_SHOW) {
                return $order; // 幂等
            }
            if ((int) $order['booking_status'] !== BookingConst::STATUS_CONFIRMED) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已确认预订可标记 No-show');
            }
            $deadline = BookingConst::noShowDeadline((string) $order['use_date']);
            if (strtotime($deadline) >= time()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, "未到入住截止时间({$deadline}),不能标记 No-show");
            }
            $fee = $waiveFee ? 0.0 : $this->noShowFee($order);
            $this->transition($order, [
                'booking_status' => BookingConst::STATUS_NO_SHOW,
                'no_show_at' => date('Y-m-d H:i:s'),
                'no_show_fee' => $fee,
                'no_show_waived' => $waiveFee ? 1 : 0,
            ]);
            $order = $this->lockOrder($orderId);
            $this->events->log($order, 'no_show', BookingConst::OPERATOR_MERCHANT, $operatorId, $operatorName, 1, [
                'fee' => $fee,
                'waived' => $waiveFee,
                'waiveReason' => $waiveFee ? mb_substr($waiveReason, 0, 500) : '',
            ]);
            return $order;
        });
        $this->notifyQuietly($order, '预订标记为 No-show', "预订「{$order['goods_name']}」(订单 {$order['order_no']})住客未到店,已标记 No-show。");
        return $order;
    }

    /** 补充/更新房号(已确认或已入住均可) */
    public function assignRoom(int $orderId, int $operatorId, string $operatorName, string $roomNo): array
    {
        return Db::transaction(function () use ($orderId, $operatorId, $operatorName, $roomNo) {
            $order = $this->lockOrder($orderId);
            if (! in_array((int) $order['booking_status'], [BookingConst::STATUS_CONFIRMED, BookingConst::STATUS_CHECKED_IN], true)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前预订状态不可分配房号');
            }
            $this->transition($order, ['assigned_room_no' => mb_substr($roomNo, 0, 50)]);
            $order = $this->lockOrder($orderId);
            $this->events->log($order, 'room_assigned', BookingConst::OPERATOR_MERCHANT, $operatorId, $operatorName, 1, [
                'roomNo' => $roomNo,
            ]);
            return $order;
        });
    }

    /**
     * 按状态矩阵派生可执行动作(前端只展示,权限由前端 v-perm + 后端 #[Permission] 双重把关)
     * @return string[]
     */
    public function availableActions(array $order): array
    {
        $actions = [];
        $status = (int) ($order['booking_status'] ?? 0);
        $channel = (string) ($order['booking_channel'] ?? '');
        $now = time();
        switch ($status) {
            case BookingConst::STATUS_PENDING_PAYMENT:
                if ($channel !== BookingConst::CHANNEL_MTRIP) {
                    $actions[] = 'confirm';
                }
                $actions[] = 'cancel';
                break;
            case BookingConst::STATUS_CONFIRMED:
                $actions = ['check-in', 'cancel', 'refund', 'message'];
                if ($order['use_date'] !== null && strtotime(BookingConst::noShowDeadline((string) $order['use_date'])) < $now) {
                    $actions[] = 'no-show';
                }
                break;
            case BookingConst::STATUS_CHECKED_IN:
                $actions = ['check-out', 'room', 'message'];
                break;
            case BookingConst::STATUS_CHECKED_OUT:
                $actions = ['voucher', 'refund', 'message'];
                break;
            case BookingConst::STATUS_CANCELLED:
            case BookingConst::STATUS_NO_SHOW:
                $actions = ['voucher'];
                break;
        }
        if ($status > 0) {
            $actions[] = 'note';
            $actions[] = 'voucher';
        }
        return array_values(array_unique($actions));
    }

    /** No-show 费用:按政策快照,默认首晚房费(单价×数量) */
    private function noShowFee(array $order): float
    {
        return round((float) $order['unit_price'] * (int) $order['quantity'], 2);
    }

    /** 事务内行锁取订单(不存在即 404,不泄露其他商户订单是否存在) */
    public function lockOrder(int $orderId): array
    {
        $order = Db::table('order_main')->where('id', $orderId)->whereNull('deleted_at')->lockForUpdate()->first();
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '预订不存在');
        }
        return (array) $order;
    }

    /** 状态变更+双写+乐观锁(须在事务内;$fields 含目标 booking_status 等) */
    private function transition(array $order, array $fields): void
    {
        $fields['version'] = Db::raw('version + 1');
        $affected = Db::table('order_main')
            ->where('id', (int) $order['id'])
            ->where('version', (int) $order['version'])
            ->update($fields);
        if ($affected !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '预订已被其他操作更新,请刷新后重试');
        }
    }

    /** 通知容错:失败不回滚/不阻断生命周期主流程 */
    private function notifyQuietly(array $order, string $title, string $message): void
    {
        try {
            $this->notify->push($order, $title, $message);
        } catch (\Throwable) {
        }
    }
}
