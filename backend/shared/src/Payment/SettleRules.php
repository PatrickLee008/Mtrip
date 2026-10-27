<?php

declare(strict_types=1);

namespace Mtrip\Shared\Payment;

/**
 * 业务方(order-service)支付落账纯规则(方案 22 §6;无框架依赖,便于 tests/run.php 单测)
 *
 * - 支付窗口解析:站点配置 → 全局配置 → 默认 30 分钟,范围 1–1440;
 * - onPaid 分支判定:已处理 / 正常确认 / 超时取消后恢复 / 原路全额退款;
 * - 超时任务前置查单判定:落账 / 本轮不取消 / 照常取消;
 * - KBZ 原路退款:立即提交 / 排队合并判定、到期批次分组、次数超限退钱包判定、阻塞判定;迟到退款金额拆分。
 *   (迟到退款单用 order_refund.late_pay / pay_no 列标识,不再用 reason 前缀。)
 *
 * 订单状态取值与 order-service `BookingConst` 同值(此处不能引用业务服务的类,故镜像常量)。
 */
final class SettleRules
{
    public const DEFAULT_WINDOW_MINUTES = 30;
    public const MIN_WINDOW_MINUTES = 1;
    public const MAX_WINDOW_MINUTES = 1440;

    /** 超时任务前置查单的宽限:订单过期超过该秒数后,支付中心仍不可用 / 仍 pending 也照常取消 */
    public const EXPIRY_GRACE_SECONDS = 1800;

    // onPaid 分支
    public const ACTION_ALREADY = 'already';
    public const ACTION_CONFIRM = 'confirm';
    public const ACTION_RECOVER = 'recover';
    public const ACTION_REFUND = 'refund';

    // 超时前置查单动作
    public const EXPIRY_SETTLE = 'settle';
    public const EXPIRY_DEFER = 'defer';
    public const EXPIRY_CANCEL = 'cancel';

    // 镜像 BookingConst
    public const BOOKING_PENDING_PAYMENT = 1;
    public const BOOKING_CANCELLED = 5;
    public const PAY_PENDING = 1;
    public const PAY_PAID = 2;
    public const PAY_PARTIAL_REFUNDED = 3;
    public const PAY_REFUNDED = 4;
    public const PAY_FAILED = 5;
    public const PAY_METHOD_KBZ_MMQR = 5;

    // order_refund.channel_submit_status
    public const SUBMIT_NONE = 0;
    public const SUBMIT_QUEUED = 1;
    public const SUBMIT_SENT = 2;
    public const SUBMIT_WALLET = 3;

    /** 同一 pay_no 的排队退款合并窗口(秒);order-service 可用 env KBZ_REFUND_MERGE_SECONDS 覆盖 */
    public const REFUND_MERGE_WINDOW_SECONDS = 300;

    public const ROUTE_CHANNEL = 'channel';
    public const ROUTE_WALLET = 'wallet';

    // ------------------------------------------------------------------ 支付窗口

    /**
     * 配置值 → 有效分钟数;空串 / 非正整数视为未覆盖返回 null;超过上限按上限
     */
    public static function parseWindowMinutes(mixed $value): ?int
    {
        if (is_int($value)) {
            $value = (string) $value;
        }
        if (! is_string($value)) {
            return null;
        }
        $value = trim($value);
        if (preg_match('/^\d{1,9}$/D', $value) !== 1) {
            return null;
        }
        $minutes = (int) $value;
        if ($minutes < self::MIN_WINDOW_MINUTES) {
            return null;
        }
        return min($minutes, self::MAX_WINDOW_MINUTES);
    }

    /** 站点值优先,其次全局值,都无效用默认 30 */
    public static function windowMinutes(mixed $siteValue, mixed $globalValue, int $default = self::DEFAULT_WINDOW_MINUTES): int
    {
        return self::parseWindowMinutes($siteValue)
            ?? self::parseWindowMinutes($globalValue)
            ?? max(self::MIN_WINDOW_MINUTES, min($default, self::MAX_WINDOW_MINUTES));
    }

    // ------------------------------------------------------------------ onPaid 分支

    /**
     * 判定支付成功通知的处理分支(方案 22 §6.3)
     *
     * @param list<array{orderStatus:int, bookingStatus:int, paymentStatus:int, payMethod:int, payTradeNo:string, expiryCancelled:bool}> $bookings
     *        业务单下全部预订(独立单 1 条,Trip 多条);空数组 = 业务单不存在
     * @param bool $amountMatches 通知金额与币种是否等于业务单应付
     * @param int|null $tripPayStatus Trip 主单 pay_status(0 待付 1 已付 2 已取消);独立单传 null
     * @return array{action:string, reason:string}
     */
    public static function decidePaid(array $bookings, string $payNo, bool $amountMatches, ?int $tripPayStatus = null): array
    {
        if ($bookings === []) {
            return ['action' => self::ACTION_REFUND, 'reason' => 'target_missing'];
        }
        $allSettledByThis = true;
        $allPending = true;
        $allExpiryCancelled = true;
        $anyCancelled = false;
        foreach ($bookings as $b) {
            $paidStates = [self::PAY_PAID, self::PAY_PARTIAL_REFUNDED, self::PAY_REFUNDED];
            if (! (in_array((int) $b['paymentStatus'], $paidStates, true)
                && (int) $b['payMethod'] === self::PAY_METHOD_KBZ_MMQR
                && (string) $b['payTradeNo'] === $payNo)) {
                $allSettledByThis = false;
            }
            if (! ((int) $b['orderStatus'] === 0
                && (int) $b['bookingStatus'] === self::BOOKING_PENDING_PAYMENT
                && in_array((int) $b['paymentStatus'], [self::PAY_PENDING, self::PAY_FAILED], true))) {
                $allPending = false;
            }
            if (! ($b['expiryCancelled'] ?? false)) {
                $allExpiryCancelled = false;
            }
            if ((int) $b['bookingStatus'] === self::BOOKING_CANCELLED) {
                $anyCancelled = true;
            }
        }
        if ($allSettledByThis) {
            return ['action' => self::ACTION_ALREADY, 'reason' => 'already_settled'];
        }
        if (! $amountMatches) {
            return ['action' => self::ACTION_REFUND, 'reason' => 'amount_mismatch'];
        }
        if ($allPending && ($tripPayStatus === null || $tripPayStatus === 0)) {
            return ['action' => self::ACTION_CONFIRM, 'reason' => 'pending'];
        }
        if ($allExpiryCancelled && ($tripPayStatus === null || $tripPayStatus === 2)) {
            return ['action' => self::ACTION_RECOVER, 'reason' => 'expired'];
        }
        return ['action' => self::ACTION_REFUND, 'reason' => $anyCancelled ? 'cancelled' : 'other_state'];
    }

    // ------------------------------------------------------------------ 超时前置查单

    /**
     * 超时任务取消 MMQR 待支付订单前的判定
     *
     * @param string|null $payStatus 支付中心状态 pending/paid/failed/closed/late;null = 无流水(从未出码)
     * @param bool $centerUnavailable 支付中心调用失败(网络 / 非业务错误)
     * @param int $expiresAt 订单 payment_expires_at 时间戳
     */
    public static function expiryAction(?string $payStatus, bool $centerUnavailable, int $expiresAt, int $now, int $grace = self::EXPIRY_GRACE_SECONDS): string
    {
        $withinGrace = $now - $expiresAt < $grace;
        if ($centerUnavailable) {
            return $withinGrace ? self::EXPIRY_DEFER : self::EXPIRY_CANCEL;
        }
        return match ($payStatus) {
            'paid', 'late' => self::EXPIRY_SETTLE,
            'pending' => $withinGrace ? self::EXPIRY_DEFER : self::EXPIRY_CANCEL,
            default => self::EXPIRY_CANCEL,
        };
    }

    // ------------------------------------------------------------------ KBZ 原路退款:合并提交 + 超限退钱包

    /**
     * 审批通过(或迟到支付判退)后是否立即提交支付中心,否则排队等合并窗口
     *
     * - 迟到支付全额退款:始终立即提交(用户付了不该付的钱,不等);
     * - 独立单支付(bizType=order,一笔支付只对应一条预订,退款本就逐笔串行):立即提交;
     * - 行程支付(bizType=trip,一笔支付对应多条预订,可能短时间内逐条退款):排队,窗口内同一 pay_no 合并为一次渠道退款。
     */
    public static function submitImmediately(bool $latePay, bool $tripPayment): bool
    {
        return $latePay || ! $tripPayment;
    }

    /**
     * 排队行按 pay_no 分组,挑出到期的批次(纯函数,crontab 调用)
     *
     * 批次到期 = 组内任一行为迟到退款(补提交,不等)/ 排队时间缺失,或组内最早排队时间 ≤ now - window。
     * 未到期的组整组不动(新加入的行与旧行一起等最早那行到期,保证一次合并)。
     *
     * @param list<array{id:int|string, payNo:string, queuedAt:?int, latePay?:bool}> $rows
     * @return array<string, list<int>> pay_no => 行 id(升序)
     */
    public static function dueRefundBatches(array $rows, int $now, int $windowSeconds = self::REFUND_MERGE_WINDOW_SECONDS): array
    {
        $groups = [];
        $due = [];
        foreach ($rows as $r) {
            $payNo = (string) $r['payNo'];
            if (! PaymentRules::isValidPayNo($payNo)) {
                continue;
            }
            $groups[$payNo][] = (int) $r['id'];
            $queuedAt = $r['queuedAt'] ?? null;
            if (! empty($r['latePay']) || $queuedAt === null || $queuedAt <= $now - max(0, $windowSeconds)) {
                $due[$payNo] = true;
            }
        }
        $result = [];
        foreach ($groups as $payNo => $ids) {
            if (isset($due[$payNo])) {
                sort($ids);
                $result[(string) $payNo] = $ids;
            }
        }
        return $result;
    }

    /**
     * 提交前的去向判定:该支付已用渠道退款次数(成功 + 处理中)达上限 → 改退 mTrip 钱包,否则走渠道原路退
     *
     * @return string self::ROUTE_CHANNEL | self::ROUTE_WALLET
     */
    public static function refundRoute(int $usedCount, int $max = PaymentRules::MAX_REFUND_TIMES): string
    {
        return $usedCount >= $max ? self::ROUTE_WALLET : self::ROUTE_CHANNEL;
    }

    /**
     * 是否走 KBZ 原路退款(支付中心):迟到支付退款单,或 KBZ 支付订单且退款渠道为原路(refund_channel=2)
     */
    public static function isChannelRefund(bool $latePay, int $refundChannel, int $orderPayMethod): bool
    {
        return $latePay || ($refundChannel === 2 && $orderPayMethod === self::PAY_METHOD_KBZ_MMQR);
    }

    /**
     * 订单是否有阻塞新退款的进行中退款单:迟到支付退款单(late_pay=1)退的是未计入订单的钱,不阻塞
     *
     * @param list<array{status:int|string, late_pay?:int|string}> $refunds 该订单未删除的退款单
     */
    public static function hasBlockingRefund(array $refunds): bool
    {
        foreach ($refunds as $r) {
            if ((int) ($r['late_pay'] ?? 0) === 1) {
                continue;
            }
            if (in_array((int) $r['status'], [0, 1, 2], true)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 迟到支付退款金额拆到各预订(Trip 一笔支付对应多条 order_refund):按各预订应付,
     * 末条吸收舍入差,保证合计 = 实收金额(分)
     *
     * @param list<int> $bookingCents 各预订应付(分)
     * @return list<int>
     */
    public static function splitCents(int $totalCents, array $bookingCents): array
    {
        $n = count($bookingCents);
        if ($n === 0) {
            return [];
        }
        $result = [];
        $remain = $totalCents;
        foreach ($bookingCents as $i => $cents) {
            if ($i === $n - 1) {
                $result[] = max(0, $remain);
                break;
            }
            $part = max(0, min((int) $cents, $remain));
            $result[] = $part;
            $remain -= $part;
        }
        return $result;
    }
}
