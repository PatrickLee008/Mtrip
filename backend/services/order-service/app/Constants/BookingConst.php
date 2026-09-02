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

    /** 待支付时长:创建后 10 分钟(实现方案 §2.3,统一旧代码 15 分钟口径) */
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

    /** No-show 截止默认规则:入住日当地时间 23:59:59(可按酒店配置覆盖) */
    public static function noShowDeadline(string $useDate): string
    {
        return $useDate . ' 23:59:59';
    }
}
