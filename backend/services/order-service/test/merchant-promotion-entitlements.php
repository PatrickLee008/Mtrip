<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\PricingService;
use Hyperf\DbConnection\Db;

$pricing = $container->get(PricingService::class);
$coupon = Db::table('marketing_coupon')->where('coupon_name', 'Entitlement changed')->first();
$receive = Db::table('marketing_coupon_receive')->where('coupon_id', $coupon->id)->first();
$room = Db::table('hotel_room_type')->where('room_name', 'Promotion room')->first();
$legs = [['propertyId' => (int) $room->property_id, 'roomTypeId' => (int) $room->id,
    'quantity' => 1, 'nights' => 1, 'amount' => 100000]];
$result = $pricing->resolveCouponForLegs(991, 99102, (int) $receive->id, 1, $legs, false);
check($result[1] === 15000.0, 'order prices original 15% claim after merchant edits to 5% and archives');
check(json_decode($result[2], true)['couponVersionId'] === (int) $receive->coupon_version_id, 'order snapshot references original claim version');
$legs[0]['amount'] = 20000;
rejects(40901, fn () => $pricing->resolveCouponForLegs(991, 99102, (int) $receive->id, 1, $legs, false), 'other room discounts cannot erode commission floor from official price');
Db::table('marketing_coupon_receive')->where('id', $receive->id)->update(['status' => 1]);
rejects(40901, fn () => $pricing->resolveCouponForLegs(991, 99102, (int) $receive->id, 1, $legs, false), 'used entitlement cannot be redeemed again');
Db::table('marketing_coupon_receive')->where('id', $receive->id)->update(['status' => 0, 'valid_end' => '2020-01-01 00:00:00']);
rejects(40901, fn () => $pricing->resolveCouponForLegs(991, 99102, (int) $receive->id, 1, $legs, false), 'expired entitlement cannot be redeemed');
echo "PROMOTION ENTITLEMENT PRICING PASSED\n";
