<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Hyperf\DbConnection\Db;

/** Use official room prices for the commission floor, including after other room discounts. */
final class CouponProtection
{
    public static function evaluate(array $coupon, array $legs, int $orderType, string $today): array
    {
        $result = CouponEligibility::evaluate($coupon, $legs, $orderType, $today);
        $policy = $coupon['merchant_policy'] ?? null;
        $policy = is_string($policy) ? json_decode($policy, true) : $policy;
        if (! $result['eligible'] || $orderType !== 1 || ! is_array($policy)) {
            return $result;
        }
        $prices = Db::table('hotel_room_type')->whereIn('id', array_column($legs, 'roomTypeId'))->pluck('base_price', 'id');
        foreach ($result['eligibleLegs'] as $i) {
            $leg = $legs[$i];
            $price = (float) ($prices[(int) ($leg['roomTypeId'] ?? 0)] ?? 0);
            $official = $price * max(1, (int) ($leg['nights'] ?? 1)) * max(1, (int) ($leg['quantity'] ?? 1));
            $floor = round($official * (float) ($policy['protectedPercent'] ?? 100) / 100, 2);
            if ($price <= 0 || round((float) $leg['amount'] - $result['allocations'][$i], 2) < $floor) {
                $result['eligible'] = false;
                $result['reason'] = 'protected_minimum';
                $result['discount'] = 0.0;
                $result['allocations'] = array_fill(0, count($legs), 0.0);
                break;
            }
        }
        return $result;
    }
}
