<?php

declare(strict_types=1);

namespace App\Service\Booking;

use App\Constants\BookingConst;
use App\Service\OrderStockService;
use App\Service\ReferralService;
use Hyperf\Context\Context;
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
    private const SITE_TIMEZONE_CACHE_KEY = 'booking.lifecycle.site_timezones';

    #[Inject]
    protected BookingEventService $events;

    #[Inject]
    protected OrderStockService $stockService;

    #[Inject]
    protected BookingNotificationService $notify;

    #[Inject]
    protected BookingRefundService $refunds;

    #[Inject]
    protected ReferralService $referralService;

    /**
     * 下单时组装预订字段(须在下单事务内调用):
     * 预订/支付状态、10 分钟支付截止、特殊请求与政策快照(政策此后不再随规则修改变化)。
     */
    public function buildCreateFields(int $orderType, int $propertyId, int $roomTypeId, string $remark): array
    {
        $fields = [
            'booking_status' => BookingConst::STATUS_PENDING_PAYMENT,
            'payment_status' => BookingConst::PAY_PENDING,
            'booking_channel' => BookingConst::CHANNEL_MTRIP,
            'payment_expires_at' => date('Y-m-d H:i:s', time() + BookingConst::PAYMENT_WINDOW_MINUTES * 60),
            'special_requests' => mb_substr($remark, 0, 1000),
        ];
        if ($orderType === 1) {
            $policy = $this->currentRefundPolicy($propertyId, $roomTypeId);
            $fields['cancellation_policy_snapshot'] = $policy !== null
                ? json_encode($policy + ['snapshotAt' => date('Y-m-d H:i:s')], JSON_UNESCAPED_UNICODE)
                : null;
            $fields['no_show_policy_snapshot'] = json_encode($this->currentNoShowPolicy($propertyId), JSON_UNESCAPED_UNICODE);
        }
        return $fields;
    }

    /** 下单时冻结的取消政策(房型级优先于商品级;无规则=免费取消) */
    public function currentRefundPolicy(int $propertyId, int $roomTypeId): ?array
    {
        $rule = Db::table('goods_refund_rule')
            ->where('property_id', $propertyId)->whereNull('deleted_at')
            ->where(static function ($q) use ($roomTypeId) {
                $q->where(static function ($q2) use ($roomTypeId) {
                    $q2->where('sku_type', 1)->where('sku_id', $roomTypeId);
                })->orWhere('sku_type', 0);
            })
            ->orderByDesc('sku_type')->first();
        if (! $rule) {
            return null;
        }
        $rule = (array) $rule;
        return [
            'ruleType' => (int) $rule['rule_type'],
            'rules' => is_string($rule['rules'] ?? null) ? (json_decode($rule['rules'], true) ?: []) : ($rule['rules'] ?? []),
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

    /**
     * 入住(可带房号);幂等重复调用不重复通知(§9.1)
     *
     * 推荐返利在这里发放(PRD 模块14「入住完成后奖励」):商户后台点入住 / 商户核销 / 平台手工核销
     * 三个入口都汇到本方法,放这里一处即可覆盖。**不要挪回支付成功**——
     * 支付即发会让「订金付了就退」的单也拿到奖励。
     */
    public function checkIn(
        int $orderId,
        int $operatorId,
        string $operatorName,
        string $roomNo = '',
        int $operatorType = BookingConst::OPERATOR_MERCHANT,
    ): array
    {
        [$order, $changed] = Db::transaction(function () use ($orderId, $operatorId, $operatorName, $roomNo, $operatorType) {
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
            $this->events->log($order, 'checked_in', $operatorType, $operatorId, $operatorName, 1, [
                'roomNo' => (string) $order['assigned_room_no'],
            ]);
            // 推荐返利:被推荐人首个「已入住」酒店订单达成 → 奖励入推荐人+新人钱包(PRD 模块14)。
            // 在本事务内发放,reward_status 0→1 + lockForUpdate 保证仅首单一次;幂等重复入住走上面的提前返回,到不了这里。
            if ((int) $order['order_type'] === 1) {
                $this->referralService->grantOnFirstBooking(
                    (int) $order['site_id'],
                    (int) $order['user_id'],
                    (int) $order['id'],
                );
            }
            return [$order, true];
        });
        if ($changed) {
            $roomText = (string) $order['assigned_room_no'];
            $this->notifyQuietly($order, '住客已入住', "预订「{$order['goods_name']}」(订单 {$order['order_no']})已办理入住" . ($roomText !== '' ? ",房号:{$roomText}" : '') . '。');
        }
        return $order;
    }

    /** 后台撤销酒店核销:已入住恢复为已确认,并保留不可覆盖的时间线。 */
    public function revertCheckIn(int $orderId, int $operatorId, string $operatorName, string $reason): array
    {
        return Db::transaction(function () use ($orderId, $operatorId, $operatorName, $reason) {
            $order = $this->lockOrder($orderId);
            if ((int) $order['booking_status'] === BookingConst::STATUS_CONFIRMED) {
                return $order;
            }
            if ((int) $order['booking_status'] !== BookingConst::STATUS_CHECKED_IN) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已入住预订可撤销入住');
            }
            $this->transition($order, [
                'booking_status' => BookingConst::STATUS_CONFIRMED,
                'order_status' => 1,
                'checked_in_at' => null,
                'assigned_room_no' => '',
            ]);
            $order = $this->lockOrder($orderId);
            $this->events->log($order, 'check_in_reverted', BookingConst::OPERATOR_PLATFORM, $operatorId, $operatorName, 1, [
                'reason' => mb_substr($reason, 0, 500),
            ]);
            return $order;
        });
    }

    /** 到店付款线下收款确认:仅显式 Pay at Hotel 预订,不伪造第三方支付流水。 */
    public function markPaidAtHotel(int $orderId, int $operatorId, string $operatorName): array
    {
        return Db::transaction(function () use ($orderId, $operatorId, $operatorName) {
            $order = $this->lockOrder($orderId);
            if ((int) $order['pay_method'] !== BookingConst::PAY_METHOD_PAY_AT_HOTEL) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅到店付款预订可标记为已支付');
            }
            if ((int) $order['payment_status'] === BookingConst::PAY_PAID) {
                return $order;
            }
            if (! in_array((int) $order['booking_status'], [BookingConst::STATUS_CONFIRMED, BookingConst::STATUS_CHECKED_IN], true)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前预订状态不可确认到店收款');
            }
            if (! in_array((int) $order['payment_status'], [BookingConst::PAY_PENDING, BookingConst::PAY_FAILED], true)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前支付状态不可标记为已支付');
            }
            $this->transition($order, [
                'payment_status' => BookingConst::PAY_PAID,
                'pay_time' => date('Y-m-d H:i:s'),
            ]);
            $order = $this->lockOrder($orderId);
            $this->events->log($order, 'payment_collected_at_hotel', BookingConst::OPERATOR_MERCHANT, $operatorId, $operatorName, 1, [
                'payMethod' => BookingConst::PAY_METHOD_PAY_AT_HOTEL,
            ], 'payment');
            return $order;
        });
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
        $closedSiblings = [];
        $order = Db::transaction(function () use ($orderId, $operatorId, $operatorName, $reason, $operatorType, &$closedSiblings) {
            $trip = $this->lockTripFor($orderId);
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
            if (! $paid) {
                $closedSiblings = $this->closePendingTrip($trip, $order, '同行程预订已取消,整单关闭', $operatorType, $operatorId, $operatorName);
            }
            return $order;
        });
        $this->notifyQuietly($order, '预订已取消', "预订「{$order['goods_name']}」(订单 {$order['order_no']})已取消,原因:{$order['cancel_reason']}。");
        foreach ($closedSiblings as $sibling) {
            $this->notifyQuietly($sibling, '预订已取消', "预订「{$sibling['goods_name']}」(订单 {$sibling['order_no']})已取消,原因:{$sibling['cancel_reason']}。");
        }
        return $order;
    }

    /**
     * 锁定预订所属的 Trip 行(独立单返回 null;须在事务内、**先于**锁 order_main 调用)。
     * 加锁顺序 order_trip → order_main 与 TripController::pay 一致,避免取消/超时与整单支付交叉死锁。
     * trip_id 下单后不再变更,所以先无锁读出再加锁是安全的。
     */
    public function lockTripFor(int $orderId): ?array
    {
        $tripId = (int) Db::table('order_main')->where('id', $orderId)->value('trip_id');
        if ($tripId <= 0) {
            return null;
        }
        $trip = Db::table('order_trip')->where('id', $tripId)->whereNull('deleted_at')->lockForUpdate()->first();
        return $trip ? (array) $trip : null;
    }

    /**
     * Trip 内一笔**待支付**预订被取消/超时后关闭整单(须在事务内,且已用 lockTripFor 锁住 Trip)。
     * 券按整单净额分摊到各预订,少一笔整单就付不了(TripController::pay 要求全部待支付),
     * 所以同 Trip 其余待支付预订一并取消并释放锁定库存,Trip 置 2 已取消。
     * 已支付的 Trip 不处理 —— 支付后各预订独立取消(PRD 模块 1.1)。返回被连带取消的预订,供调用方通知。
     */
    public function closePendingTrip(?array $trip, array $order, string $reason, int $operatorType, int $operatorId, string $operatorName): array
    {
        if ($trip === null || (int) $trip['pay_status'] !== 0) {
            return [];
        }
        $siblings = Db::table('order_main')->where('trip_id', (int) $trip['id'])->where('id', '<>', (int) $order['id'])
            ->whereNull('deleted_at')->orderBy('id')->lockForUpdate()->get()
            ->map(static fn ($row) => (array) $row)->all();
        $closed = [];
        foreach ($siblings as $sibling) {
            if ((int) $sibling['booking_status'] !== BookingConst::STATUS_PENDING_PAYMENT
                || (int) $sibling['payment_status'] !== BookingConst::PAY_PENDING) {
                continue;
            }
            $this->transition($sibling, [
                'booking_status' => BookingConst::STATUS_CANCELLED,
                'order_status' => 4,
                'cancel_reason' => $reason,
                'cancel_time' => date('Y-m-d H:i:s'),
            ]);
            $this->stockService->release($sibling);
            $sibling['booking_status'] = BookingConst::STATUS_CANCELLED;
            $sibling['cancel_reason'] = $reason;
            $this->events->log($sibling, 'cancelled', $operatorType, $operatorId, $operatorName, 1, [
                'reason' => $reason,
                'paid' => false,
                'tripNo' => (string) $trip['trip_no'],
                'triggerOrderNo' => (string) $order['order_no'],
            ]);
            $closed[] = $sibling;
        }
        Db::table('order_trip')->where('id', (int) $trip['id'])->update(['pay_status' => 2]);
        return $closed;
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
            $deadline = $this->noShowDeadline($order);
            if ($deadline->getTimestamp() >= time()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, "未到入住截止时间({$deadline->format('Y-m-d H:i:s P')}),不能标记 No-show");
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
                $actions = ['check-in', 'cancel', 'message'];
                if ($this->canRefund($order)) {
                    $actions[] = 'refund';
                }
                if ($this->canMarkPaidAtHotel($order)) {
                    $actions[] = 'mark-paid';
                }
                if ($order['use_date'] !== null && $this->noShowDeadline($order)->getTimestamp() < $now) {
                    $actions[] = 'no-show';
                }
                break;
            case BookingConst::STATUS_CHECKED_IN:
                $actions = ['check-out', 'room', 'message'];
                if ($this->canMarkPaidAtHotel($order)) {
                    $actions[] = 'mark-paid';
                }
                break;
            case BookingConst::STATUS_CHECKED_OUT:
                $actions = ['voucher', 'message'];
                if ($this->canRefund($order)) {
                    $actions[] = 'refund';
                }
                break;
            case BookingConst::STATUS_CANCELLED:
                if ($this->canRefund($order)) {
                    $actions[] = 'refund';
                }
                $actions[] = 'voucher';
                break;
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

    private function canMarkPaidAtHotel(array $order): bool
    {
        return (int) ($order['pay_method'] ?? 0) === BookingConst::PAY_METHOD_PAY_AT_HOTEL
            && in_array((int) ($order['payment_status'] ?? 0), [BookingConst::PAY_PENDING, BookingConst::PAY_FAILED], true);
    }

    private function canRefund(array $order): bool
    {
        return in_array((int) ($order['payment_status'] ?? 0), [BookingConst::PAY_PAID, BookingConst::PAY_PARTIAL_REFUNDED], true)
            && $this->refunds->quote($order)['remainingRefundable'] > 0;
    }

    /** 返回带时区的 No-show 截止时间;新订单读快照,旧订单回退到站点时区。 */
    public function noShowDeadline(array $order): \DateTimeImmutable
    {
        $policy = $this->jsonPolicy($order['no_show_policy_snapshot'] ?? null);
        $timezone = (string) ($policy['timezone'] ?? '');
        if ($timezone === '') {
            $timezone = $this->siteTimezone((int) ($order['site_id'] ?? 0));
        }
        return BookingConst::noShowDeadline(
            (string) ($order['use_date'] ?? ''),
            $timezone,
            (string) ($policy['deadlineTime'] ?? '23:59:59')
        );
    }

    public function noShowDeadlineIso(array $order): ?string
    {
        return ($order['use_date'] ?? null) !== null ? $this->noShowDeadline($order)->format(DATE_ATOM) : null;
    }

    private function currentNoShowPolicy(int $propertyId): array
    {
        $siteId = (int) Db::table('merchant_store')->where('id', $propertyId)->value('site_id');
        return [
            'feeType' => 'first_night',
            'deadlineTime' => '23:59:59',
            'timezone' => $this->siteTimezone($siteId),
            'source' => 'default',
        ];
    }

    private function siteTimezone(int $siteId): string
    {
        $cache = (array) Context::get(self::SITE_TIMEZONE_CACHE_KEY, []);
        if (array_key_exists($siteId, $cache)) {
            return (string) $cache[$siteId];
        }
        $timezone = (string) Db::connection('system')->table('sys_site')
            ->where('id', $siteId)->whereNull('deleted_at')->value('timezone');
        try {
            new \DateTimeZone($timezone);
        } catch (\Throwable) {
            $timezone = 'UTC';
        }
        $cache[$siteId] = $timezone;
        Context::set(self::SITE_TIMEZONE_CACHE_KEY, $cache);
        return $timezone;
    }

    private function jsonPolicy(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (! is_string($value) || $value === '') {
            return [];
        }
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
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
