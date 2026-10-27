<?php

declare(strict_types=1);

namespace App\Constants;

/**
 * 酒店预订状态常量(实现方案-Merchant-M4 §5)
 * 预订状态与支付状态分离;保留 order_status 双写兼容既有 C 端/管理后台/财务。
 */
class BookingConst
{
    /** 预订状态 booking_status */
    public const STATUS_PENDING_PAYMENT = 1;
    public const STATUS_CONFIRMED = 2;
    public const STATUS_CHECKED_IN = 3;
    public const STATUS_CHECKED_OUT = 4;
    public const STATUS_CANCELLED = 5;
    public const STATUS_NO_SHOW = 6;

    /** 支付状态 payment_status */
    public const PAY_PENDING = 1;
    public const PAY_PAID = 2;
    public const PAY_PARTIAL_REFUNDED = 3;
    public const PAY_REFUNDED = 4;
    public const PAY_FAILED = 5;

    /** 支付方式 pay_method:1Stripe 2PayPal 3mTrip钱包 4到店付款 5KBZPay MMQR */
    public const PAY_METHOD_PAY_AT_HOTEL = 4;
    /** KBZPay MMQR 扫码支付(方案 22 阶段 5:经 payment-service 统一支付中心出码 / 落账 / 原路退款) */
    public const PAY_METHOD_KBZ_MMQR = 5;

    /** 支付中心业务类型 */
    public const PAY_BIZ_ORDER = 'order';
    public const PAY_BIZ_TRIP = 'trip';

    /** 系统超时取消的原因文案(BookingExpiryService 写入;迟到支付恢复判定另以时间线 operator=系统 为准) */
    public const EXPIRY_CANCEL_REASON = '支付超时,系统自动取消';

    /** 资金流水渠道 finance_flow.pay_channel:1Stripe 2PayPal 5KBZPay MMQR(与 pay_method 同值) */
    public const FLOW_PAY_CHANNEL_KBZ_MMQR = 5;

    /** 预订渠道 */
    public const CHANNEL_MTRIP = 'mtrip';
    public const CHANNEL_WALKIN = 'walkin';
    public const CHANNEL_PHONE = 'phone';
    public const CHANNEL_OTA = 'ota';

    /** PMS/渠道同步状态 */
    public const SYNC_NOT_CONNECTED = 'not_connected';
    public const SYNC_PENDING = 'pending';
    public const SYNC_SYNCED = 'synced';
    public const SYNC_FAILED = 'failed';

    /**
     * 历史常量,已不参与计算:支付窗口改为可配置(App\Service\Payment\PaymentWindow,
     * sys_site_config → sys_config → 默认 30 分钟,方案 22 §6.1)。保留仅为兼容旧引用。
     */
    public const PAYMENT_WINDOW_MINUTES = 10;

    /**
     * booking_status → 旧 order_status 双写映射(退款流 5/6 由退款服务另行维护)
     * No-show(6) 不改动 order_status(仍为已支付 1,费用按政策另行处理)
     */
    public const LEGACY_ORDER_STATUS = [
        self::STATUS_PENDING_PAYMENT => 0,
        self::STATUS_CONFIRMED => 1,
        self::STATUS_CHECKED_IN => 2,
        self::STATUS_CHECKED_OUT => 3,
        self::STATUS_CANCELLED => 4,
    ];

    /** 操作方类型(时间线) */
    public const OPERATOR_SYSTEM = 0;
    public const OPERATOR_GUEST = 1;
    public const OPERATOR_MERCHANT = 2;
    public const OPERATOR_PLATFORM = 3;

    /** No-show 截止默认规则:入住日当地时间 23:59:59。 */
    public static function noShowDeadline(string $useDate, string $timezone = 'UTC', string $deadlineTime = '23:59:59'): \DateTimeImmutable
    {
        try {
            $zone = new \DateTimeZone($timezone);
        } catch (\Throwable) {
            $zone = new \DateTimeZone('UTC');
        }
        if (preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/D', $deadlineTime) !== 1) {
            $deadlineTime = '23:59:59';
        }
        if (strlen($deadlineTime) === 5) {
            $deadlineTime .= ':00';
        }
        return new \DateTimeImmutable($useDate . ' ' . $deadlineTime, $zone);
    }
}
