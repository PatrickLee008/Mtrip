<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\PricingService;
use Hyperf\DbConnection\Db;

$pricing = new PricingService();
$merchants = $properties = $rooms = $goods = $tickets = $coupons = $receives = [];

function couponFixture(array $scope): array
{
    global $coupons, $receives;
    $couponId = $coupons[] = (int) Db::table('marketing_coupon')->insertGetId(array_replace([
        'site_id' => 991, 'merchant_id' => 0, 'coupon_name' => 'F coupon scope fixture',
        'coupon_type' => 1, 'discount_value' => 10, 'min_amount' => 0, 'max_discount' => 0,
        'goods_scope' => 3, 'status' => 1, 'valid_type' => 2, 'valid_days' => 7,
    ], $scope));
    $receiveId = $receives[] = (int) Db::table('marketing_coupon_receive')->insertGetId([
        'site_id' => 991, 'coupon_id' => $couponId, 'user_id' => 99101,
        'coupon_code' => 'F-' . bin2hex(random_bytes(5)), 'status' => 0,
        'valid_start' => date('Y-m-d H:i:s', time() - 3600),
        'valid_end' => date('Y-m-d H:i:s', time() + 3600),
    ]);
    return [$couponId, $receiveId];
}

try {
    $merchant = $merchants[] = merchantFixture();
    for ($i = 0; $i < 2; $i++) {
        $property = $properties[] = (int) Db::table('merchant_store')->insertGetId([
            'site_id' => 991, 'merchant_id' => $merchant, 'store_name' => 'Coupon Property ' . $i,
            'business_type' => 'hotel', 'status' => 1,
        ]);
        $rooms[] = (int) Db::table('hotel_room_type')->insertGetId([
            'site_id' => 991, 'property_id' => $property,
            'room_name' => 'Coupon Room ' . $i, 'base_price' => 100, 'status' => 1, 'publish_status' => 2,
        ]);
    }
    [$hotelCoupon, $hotelReceive] = couponFixture([
        'property_ids' => json_encode([$properties[0]]), 'room_type_ids' => json_encode([$rooms[0]]),
    ]);
    check($pricing->resolveCoupon(991, 99101, $hotelReceive, 1, $properties[0], $rooms[0], 0, 0, 100)[1] === 10.0,
        'F hotel coupon matches property and room type keys');
    rejects(40901, fn () => $pricing->resolveCoupon(991, 99101, $hotelReceive, 1, $properties[1], $rooms[1], 0, 0, 100),
        'F hotel coupon rejects another property');
    rejects(40901, fn () => $pricing->resolveCoupon(991, 99101, $hotelReceive, 1, $properties[0], $rooms[1], 0, 0, 100),
        'F hotel coupon rejects another room type');

    for ($i = 0; $i < 2; $i++) {
        $ticketGoods = $goods[] = (int) Db::table('goods_info')->insertGetId([
            'site_id' => 991, 'merchant_id' => $merchant, 'goods_name' => 'Coupon Ticket ' . $i,
            'goods_type' => 2, 'status' => 3,
        ]);
        $tickets[] = (int) Db::table('ticket_type')->insertGetId([
            'site_id' => 991, 'goods_id' => $ticketGoods, 'ticket_name' => 'Coupon Admission ' . $i,
            'base_price' => 50, 'status' => 1,
        ]);
    }
    [$ticketCoupon, $ticketReceive] = couponFixture([
        'goods_ids' => json_encode([$goods[0]]), 'sku_ids' => json_encode([$tickets[0]]),
    ]);
    check($pricing->resolveCoupon(991, 99101, $ticketReceive, 2, 0, 0, $goods[0], $tickets[0], 50)[1] === 10.0,
        'F ticket coupon keeps goods and SKU matching');
    rejects(40901, fn () => $pricing->resolveCoupon(991, 99101, $ticketReceive, 2, 0, 0, $goods[1], $tickets[1], 50),
        'F ticket coupon rejects another goods and SKU pair');
    echo "M12 COUPON SCOPE INTEGRATION PASSED\n";
} finally {
    if ($receives) Db::table('marketing_coupon_receive')->whereIn('id', $receives)->delete();
    if ($coupons) Db::table('marketing_coupon')->whereIn('id', $coupons)->delete();
    if ($tickets) Db::table('ticket_type')->whereIn('id', $tickets)->delete();
    if ($goods) Db::table('goods_info')->whereIn('id', $goods)->delete();
    if ($rooms) Db::table('hotel_room_type')->whereIn('id', $rooms)->delete();
    if ($properties) Db::table('merchant_store')->whereIn('id', $properties)->delete();
    if ($merchants) Db::table('merchant_info')->whereIn('id', $merchants)->delete();
}
