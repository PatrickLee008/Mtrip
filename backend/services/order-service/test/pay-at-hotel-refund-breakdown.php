<?php

declare(strict_types=1);

require __DIR__ . '/../app/Service/Booking/PayAtHotelRefundBreakdown.php';

use App\Service\Booking\PayAtHotelRefundBreakdown;

$order = [
    'pay_at_hotel' => 1,
    'addon_amount' => 5000,
    'hotel_commission' => 20000,
    'hotel_deposit' => 40000,
    'hotel_transaction_fee' => 1000,
    'no_show_fee' => 20000,
];
$refunded = [];
foreach ([3000, 10000, 15000, 38000] as $amount) {
    $parts = PayAtHotelRefundBreakdown::of($order, $amount, $refunded);
    assert((int) round(array_sum($parts) * 100) === $amount * 100);
    foreach ($parts as $key => $value) {
        $refunded[$key] = round(($refunded[$key] ?? 0) + $value, 2);
    }
}
assert($refunded['refund_addon'] === 5000.0);
assert($refunded['refund_hotel_commission'] === 20000.0);
assert($refunded['refund_hotel_deposit'] === 40000.0);
assert($refunded['refund_transaction_fee'] === 1000.0);

$refunded = ['refund_addon' => 2000.0, 'refund_hotel_deposit' => 5000.0];
assert(PayAtHotelRefundBreakdown::noShowRefundable($order, $refunded) == 18000.0);
$parts = PayAtHotelRefundBreakdown::noShow($order, 18000, $refunded);
assert($parts['refund_addon'] == 3000.0);
assert($parts['refund_hotel_deposit'] == 15000.0);
assert($parts['refund_hotel_commission'] == 0.0);

$order['no_show_fee'] = 0;
assert(PayAtHotelRefundBreakdown::noShowRefundable($order, $refunded) == 38000.0);
$parts = PayAtHotelRefundBreakdown::noShow($order, 38000, $refunded);
assert($parts['refund_addon'] == 3000.0);
assert($parts['refund_hotel_deposit'] == 35000.0);

$order['no_show_fee'] = 10000;
$refunded = ['refund_addon' => 5000.0, 'refund_hotel_deposit' => 30000.0];
assert(PayAtHotelRefundBreakdown::noShowRefundable($order, $refunded) == 0.0);

echo "Pay at hotel refund breakdown: OK\n";
