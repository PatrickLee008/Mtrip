<?php

declare(strict_types=1);

namespace Mtrip\Shared\Account;

/**
 * 账户注销的判定规则(Consumer App PRD 模块 19「业务规则」,纯函数,单测覆盖)。
 *
 * | 条件                                   | 结果                       |
 * | 存在进行中 / 待处理的预订               | 阻止                       |
 * | 钱包余额 > 0                            | 默认阻止                   |
 * | 客服批准在有余额时注销                  | 余额没收 → 允许            |
 * | 无进行中预订 + 余额 = 0                 | 允许                       |
 *
 * 客服批准记的是「批准时的余额」:之后余额又涨了(比如退款到账)就不能拿旧批准把新钱一起没收,
 * 必须重新批准 —— 被没收的钱用户再也拿不回来,口径只能从严。
 */
final class AccountDeletionPolicy
{
    /** App 端要求输入的确认词(区分大小写) */
    public const CONFIRM_WORD = 'DELETE';

    /** 注销后数据保留天数(到期后匿名化) */
    public const RETENTION_DAYS = 90;

    /** 客服批准没收余额后,用户须在多少天内完成注销(过期需重新批准) */
    public const APPROVAL_VALID_DAYS = 7;

    public const BLOCKER_BOOKING = 'ongoing_booking';
    public const BLOCKER_WALLET = 'wallet_balance';

    /** 确认词必须一字不差(区分大小写、不容忍首尾空格) */
    public static function confirmed(string $input): bool
    {
        return hash_equals(self::CONFIRM_WORD, $input);
    }

    /**
     * 订单是否算「进行中 / 待处理」:待支付、已确认、已入住;以及退款处理中的单
     * (取消后退款未结的钱还会回到钱包,此时注销等于把这笔钱一起作废)。
     *
     * booking_status:1待支付 2已确认 3已入住 4已退房 5已取消 6未入住;0 为旧数据,回落看 order_status
     * order_status:0待支付 1已支付 2已入住 3已完成 4已取消 5退款中 6已退款 7已过期
     * refund_status:1 申请中
     *
     * @param array{booking_status?:int|string, order_status?:int|string, refund_status?:int|string} $order
     */
    public static function isOngoingBooking(array $order): bool
    {
        $booking = (int) ($order['booking_status'] ?? 0);
        $legacy = (int) ($order['order_status'] ?? 0);
        if ($legacy === 5 || (int) ($order['refund_status'] ?? 0) === 1) {
            return true;
        }
        if ($booking > 0) {
            return in_array($booking, [1, 2, 3], true);
        }
        return in_array($legacy, [0, 1, 2], true);
    }

    /**
     * 注销判定
     *
     * @param int      $ongoingBookings     进行中 / 待处理预订数
     * @param int      $balanceCents        当前钱包余额(分,已先作废到期额度)
     * @param int|null $approvedForfeitCents 有效的客服批准所对应的余额(分);无批准传 null
     * @return array{allowed: bool, blockers: list<string>, forfeitCents: int}
     */
    public static function decide(int $ongoingBookings, int $balanceCents, ?int $approvedForfeitCents): array
    {
        $blockers = [];
        if ($ongoingBookings > 0) {
            $blockers[] = self::BLOCKER_BOOKING;
        }
        $balance = max(0, $balanceCents);
        $walletCleared = $balance === 0
            || ($approvedForfeitCents !== null && $balance <= $approvedForfeitCents);
        if (! $walletCleared) {
            $blockers[] = self::BLOCKER_WALLET;
        }
        return [
            'allowed' => $blockers === [],
            'blockers' => $blockers,
            'forfeitCents' => $blockers === [] ? $balance : 0,
        ];
    }
}
