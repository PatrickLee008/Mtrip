<?php

declare(strict_types=1);

namespace App\Service\Booking;

class PayAtHotelRefundBreakdown
{
    public static function noShowRefundable(array $order, array $refunded): float
    {
        $addon = max(0, (int) round(((float) ($order['addon_amount'] ?? 0) - (float) ($refunded['refund_addon'] ?? 0)) * 100));
        $deposit = max(0, (int) round(((float) $order['hotel_deposit']
            - (float) ($refunded['refund_hotel_deposit'] ?? 0)
            - (float) ($order['no_show_fee'] ?? 0)) * 100));
        return ($addon + $deposit) / 100;
    }

    public static function noShow(array $order, float $refundAmount, array $refunded): array
    {
        $remaining = max(0, (int) round($refundAmount * 100));
        $addon = min($remaining, max(0, (int) round(((float) ($order['addon_amount'] ?? 0) - (float) ($refunded['refund_addon'] ?? 0)) * 100)));
        $remaining -= $addon;
        $deposit = min($remaining, max(0, (int) round(((float) $order['hotel_deposit'] - (float) ($refunded['refund_hotel_deposit'] ?? 0) - (float) ($order['no_show_fee'] ?? 0)) * 100)));
        return [
            'refund_addon' => $addon / 100,
            'refund_hotel_deposit' => $deposit / 100,
            'refund_hotel_commission' => 0.0,
            'refund_transaction_fee' => 0.0,
        ];
    }

    public static function of(array $order, float $refundAmount, array $refunded = []): array
    {
        if ((int) ($order['pay_at_hotel'] ?? 0) !== 1) {
            return [];
        }
        $remaining = max(0, (int) round($refundAmount * 100));
        $addonAvailable = max(0, (int) round(((float) ($order['addon_amount'] ?? 0) - (float) ($refunded['refund_addon'] ?? 0)) * 100));
        $addon = min($remaining, $addonAvailable);
        $remaining -= $addon;
        $components = [
            'refund_hotel_commission' => max(0, (int) round(((float) $order['hotel_commission'] - (float) ($refunded['refund_hotel_commission'] ?? 0)) * 100)),
            'refund_hotel_deposit' => max(0, (int) round(((float) $order['hotel_deposit'] - (float) ($refunded['refund_hotel_deposit'] ?? 0)) * 100)),
            'refund_transaction_fee' => max(0, (int) round(((float) $order['hotel_transaction_fee'] - (float) ($refunded['refund_transaction_fee'] ?? 0)) * 100)),
        ];
        $base = array_sum($components);
        $result = ['refund_addon' => $addon / 100];
        $left = $remaining;
        foreach ($components as $key => $cents) {
            $part = $base > 0 ? min($cents, (int) floor($remaining * $cents / $base)) : 0;
            $result[$key] = $part / 100;
            $left -= $part;
        }
        foreach ($components as $key => $cents) {
            if ($left <= 0) break;
            $room = $cents - (int) round($result[$key] * 100);
            $extra = min($left, $room);
            $result[$key] += $extra / 100;
            $left -= $extra;
        }
        return $result;
    }
}
