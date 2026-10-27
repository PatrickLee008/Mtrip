<?php

declare(strict_types=1);

namespace Mtrip\Shared\Payment;

/**
 * 统一支付中心纯规则(方案 22 §4 / §5.2 / §6.1;无框架依赖,便于 tests/run.php 单测)
 *
 * 只放可离线验证的计算:状态码映射、单号、支付窗口、金额比较、退避表、站点回溯、退款校验。
 * 金额一律按「字符串十进制 → 分(int)」处理,不用浮点比较:"15000" 与 "15000.00" 相等。
 */
final class PaymentRules
{
    // ---------- pay_transaction.status ----------
    public const PAY_PENDING = 0;
    public const PAY_PAID = 1;
    public const PAY_FAILED = 2;
    public const PAY_CLOSED = 3;
    public const PAY_LATE = 5;

    // ---------- pay_refund.status ----------
    public const REFUND_PROCESSING = 0;
    public const REFUND_SUCCEEDED = 1;
    public const REFUND_FAILED = 2;

    // ---------- biz_notify_status(outbox) ----------
    public const NOTIFY_NONE = 0;
    public const NOTIFY_PENDING = 1;
    public const NOTIFY_CONFIRMED = 2;
    public const NOTIFY_EXHAUSTED = 3;

    /** 业务通知最多尝试次数(含首次);到达后 biz_notify_status=3 */
    public const NOTIFY_MAX_TRIES = 10;

    /** 第 n 次失败后距下次重试的分钟数(下标 n-1) */
    public const NOTIFY_BACKOFF_MINUTES = [1, 2, 5, 10, 30, 60, 120, 240, 480, 720];

    /** KBZ timeout_express 上限(分钟) */
    public const MAX_TIMEOUT_MINUTES = 120;

    /** KBZ 单笔支付最多退款次数(方案 §1) */
    public const MAX_REFUND_TIMES = 3;

    /** 站点树回溯最大深度(防脏数据导致的超长链) */
    public const MAX_SITE_DEPTH = 16;

    private const PAY_STATUS_NAMES = [
        self::PAY_PENDING => 'pending',
        self::PAY_PAID => 'paid',
        self::PAY_FAILED => 'failed',
        self::PAY_CLOSED => 'closed',
        self::PAY_LATE => 'late',
    ];

    private const REFUND_STATUS_NAMES = [
        self::REFUND_PROCESSING => 'processing',
        self::REFUND_SUCCEEDED => 'succeeded',
        self::REFUND_FAILED => 'failed',
    ];

    // ------------------------------------------------------------------ 状态

    public static function payStatusName(int $status): string
    {
        return self::PAY_STATUS_NAMES[$status] ?? 'unknown';
    }

    public static function refundStatusName(int $status): string
    {
        return self::REFUND_STATUS_NAMES[$status] ?? 'unknown';
    }

    /**
     * KBZ queryorder / notify 的 trade_status → 本地支付状态;未知值返回 null(调用方不动本地状态)
     *
     * WAIT_PAY / PAYING 仍是待支付;ORDER_EXPIRED / ORDER_CLOSED 统一归「过期/关闭」。
     */
    public static function mapTradeStatus(string $tradeStatus): ?int
    {
        return match (strtoupper(trim($tradeStatus))) {
            'PAY_SUCCESS' => self::PAY_PAID,
            'PAY_FAILED' => self::PAY_FAILED,
            'ORDER_EXPIRED', 'ORDER_CLOSED' => self::PAY_CLOSED,
            'WAIT_PAY', 'PAYING' => self::PAY_PENDING,
            default => null,
        };
    }

    /** KBZ refund_status → 本地退款状态;未知返回 null */
    public static function mapRefundStatus(string $refundStatus): ?int
    {
        return match (strtoupper(trim($refundStatus))) {
            'REFUND_SUCCESS', 'SUCCESS' => self::REFUND_SUCCEEDED,
            'REFUNDING', 'PROCESSING' => self::REFUND_PROCESSING,
            'REFUND_FAILED', 'FAILED', 'FAIL' => self::REFUND_FAILED,
            default => null,
        };
    }

    // ------------------------------------------------------------------ 时间(统一 UTC)

    /** 严格解析 'Y-m-d H:i:s'(UTC)为时间戳;格式不符返回 null */
    public static function parseUtc(?string $value): ?int
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        $dt = \DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, new \DateTimeZone('UTC'));
        if ($dt === false || $dt->format('Y-m-d H:i:s') !== $value) {
            return null;
        }
        return $dt->getTimestamp();
    }

    public static function formatUtc(int $timestamp): string
    {
        return gmdate('Y-m-d H:i:s', $timestamp);
    }

    // ------------------------------------------------------------------ 单号

    /** pay_no:P{yyMMddHHmmss}{6 位随机数字}(UTC),共 19 位,满足 KBZ merch_order_id 字母数字 ≤40 */
    public static function generatePayNo(?int $now = null): string
    {
        return 'P' . gmdate('ymdHis', $now ?? time()) . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    public static function isValidPayNo(string $payNo): bool
    {
        return preg_match('/^P\d{18}$/D', $payNo) === 1;
    }

    /** refund_no 即 KBZ refund_request_no:字母数字下划线,≤32 */
    public static function isValidRefundNo(string $refundNo): bool
    {
        return preg_match('/^[A-Za-z0-9_]{1,32}$/D', $refundNo) === 1;
    }

    // ------------------------------------------------------------------ 支付窗口

    /**
     * KBZ timeout_express 分钟数 = min(floor((业务过期 - now) / 60) - 1, 120)
     *
     * 保证 KBZ 的码先于业务订单过期(方案 §6.1)。返回值 < 1 表示订单即将过期,调用方应拒绝出码。
     */
    public static function timeoutMinutes(int $bizExpireAt, int $now, int $max = self::MAX_TIMEOUT_MINUTES): int
    {
        $remain = intdiv(max(0, $bizExpireAt - $now), 60) - 1;
        return min($remain, $max);
    }

    public static function timeoutExpress(int $minutes): string
    {
        if ($minutes < 1 || $minutes > self::MAX_TIMEOUT_MINUTES) {
            throw new \InvalidArgumentException('timeout_express 取值 1–120 分钟');
        }
        return $minutes . 'm';
    }

    // ------------------------------------------------------------------ 金额

    /**
     * 字符串十进制金额 → 分;非法(负数、非数字、超过 2 位有效小数)返回 null
     *
     * 尾随 0 不算有效小数:"15000.000" 合法 = 1500000 分;"1.005" 非法。
     */
    public static function toCents(mixed $amount): ?int
    {
        if (is_int($amount)) {
            return $amount >= 0 ? $amount * 100 : null;
        }
        if (is_float($amount)) {
            $amount = number_format($amount, 2, '.', '');
        }
        if (! is_string($amount)) {
            return null;
        }
        $amount = trim($amount);
        if (preg_match('/^(\d{1,13})(?:\.(\d+))?$/D', $amount, $m) !== 1) {
            return null;
        }
        $frac = rtrim($m[2] ?? '', '0');
        if (strlen($frac) > 2) {
            return null;
        }
        return (int) $m[1] * 100 + (int) str_pad($frac, 2, '0');
    }

    /** 分 → "15000.00" */
    public static function fromCents(int $cents): string
    {
        $sign = $cents < 0 ? '-' : '';
        $cents = abs($cents);
        return $sign . intdiv($cents, 100) . '.' . str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }

    /** 规范为两位小数字符串;非法返回 null */
    public static function normalizeAmount(mixed $amount): ?string
    {
        $cents = self::toCents($amount);
        return $cents === null ? null : self::fromCents($cents);
    }

    /** 金额相等(任一非法视为不等) */
    public static function amountEquals(mixed $a, mixed $b): bool
    {
        $x = self::toCents($a);
        $y = self::toCents($b);
        return $x !== null && $y !== null && $x === $y;
    }

    /** 绑定限额校验:min/max 为 0 表示不限 */
    public static function amountInRange(int $cents, int $minCents, int $maxCents): bool
    {
        if ($minCents > 0 && $cents < $minCents) {
            return false;
        }
        return ! ($maxCents > 0 && $cents > $maxCents);
    }

    // ------------------------------------------------------------------ outbox 退避

    /**
     * 第 $tries 次推送失败后的下次重试间隔(分钟);已达上限返回 null(应置 biz_notify_status=3)
     */
    public static function notifyBackoffMinutes(int $tries): ?int
    {
        if ($tries < 1) {
            return self::NOTIFY_BACKOFF_MINUTES[0];
        }
        if ($tries >= self::NOTIFY_MAX_TRIES) {
            return null;
        }
        return self::NOTIFY_BACKOFF_MINUTES[min($tries - 1, count(self::NOTIFY_BACKOFF_MINUTES) - 1)];
    }

    // ------------------------------------------------------------------ 站点回溯

    /**
     * 渠道绑定的站点候选顺序:本站点 → 上级 → … → 0(全局)
     *
     * @param array<int|string, int|string> $parentMap site_id => parent_id(缺失的站点视为挂在根下)
     * @return list<int>
     */
    public static function siteCandidates(int $siteId, array $parentMap): array
    {
        $result = [];
        $seen = [];
        $current = max(0, $siteId);
        for ($depth = 0; $current > 0 && $depth < self::MAX_SITE_DEPTH; ++$depth) {
            if (isset($seen[$current])) {
                break; // 环
            }
            $seen[$current] = true;
            $result[] = $current;
            $current = isset($parentMap[$current]) ? max(0, (int) $parentMap[$current]) : 0;
        }
        $result[] = 0;
        return $result;
    }

    // ------------------------------------------------------------------ 退款

    /**
     * 退款前置校验;通过返回 null,否则返回拒绝原因
     *
     * @param int $paidCents 原支付金额(分)
     * @param int $activeRefundedCents 已成功 + 处理中退款合计(分)
     * @param int $activeRefundCount 已成功 + 处理中退款次数
     * @param int $requestCents 本次退款金额(分)
     */
    public static function checkRefund(int $paidCents, int $activeRefundedCents, int $activeRefundCount, int $requestCents): ?string
    {
        if ($requestCents <= 0) {
            return '退款金额必须大于 0';
        }
        if ($activeRefundCount >= self::MAX_REFUND_TIMES) {
            return '该笔支付退款次数已达上限(' . self::MAX_REFUND_TIMES . ' 次)';
        }
        if ($activeRefundedCents + $requestCents > $paidCents) {
            return '累计退款金额不能超过原支付金额(可退 ' . self::fromCents(max(0, $paidCents - $activeRefundedCents)) . ')';
        }
        return null;
    }
}
