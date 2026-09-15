<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\CouponController;
use App\Service\CouponView;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;

AdminContext::set(['admin_id' => 99120, 'admin_name' => 'F Coupon Tester', 'site_id' => 0, 'is_super' => true]);
$controller = $container->get(CouponController::class);
$merchants = $properties = $rooms = $goods = $tickets = $coupons = [];

function addCoupon(CouponController $controller, array $scope): int
{
    setRequest(array_replace([
        'siteId' => 991, 'couponName' => 'F property coupon', 'couponType' => 1,
        'discountValue' => 10, 'minAmount' => 0, 'maxDiscount' => 0,
        'goodsScope' => 3, 'totalCount' => 10, 'perUserLimit' => 1,
        'validType' => 2, 'validDays' => 7,
    ], $scope));
    return (int) $controller->add()['data']['id'];
}

try {
    foreach ([991, 992] as $siteId) {
        $merchant = $merchants[] = merchantFixture($siteId);
        $property = $properties[] = (int) Db::table('merchant_store')->insertGetId([
            'site_id' => $siteId, 'merchant_id' => $merchant, 'store_name' => "Coupon Property {$siteId}",
            'business_type' => 'hotel', 'status' => 1,
        ]);
        $rooms[] = (int) Db::table('hotel_room_type')->insertGetId([
            'site_id' => $siteId, 'property_id' => $property,
            'room_name' => "Coupon Room {$siteId}", 'base_price' => 100, 'status' => 1,
        ]);
        $ticketGoods = $goods[] = (int) Db::table('goods_info')->insertGetId([
            'site_id' => $siteId, 'merchant_id' => $merchant, 'goods_name' => "Coupon Ticket {$siteId}",
            'goods_type' => 2, 'status' => 3,
        ]);
        $tickets[] = (int) Db::table('ticket_type')->insertGetId([
            'site_id' => $siteId, 'goods_id' => $ticketGoods, 'ticket_name' => "Coupon Admission {$siteId}",
            'base_price' => 50, 'status' => 1,
        ]);
    }

    $hotelCoupon = $coupons[] = addCoupon($controller, [
        'propertyIds' => [$properties[0]], 'roomTypeIds' => [$rooms[0]],
    ]);
    $hotel = (array) Db::table('marketing_coupon')->where('id', $hotelCoupon)->first();
    check(json_decode($hotel['property_ids'], true) === [$properties[0]]
        && json_decode($hotel['room_type_ids'], true) === [$rooms[0]]
        && $hotel['goods_ids'] === null && $hotel['sku_ids'] === null,
        'F admin hotel coupon stores property and room type keys only');
    rejects(40302, fn () => addCoupon($controller, ['propertyIds' => [$properties[1]]]),
        'F admin hotel coupon rejects a property from another site');
    rejects(40001, fn () => addCoupon($controller, ['propertyIds' => [$properties[0]], 'roomTypeIds' => [$rooms[1]]]),
        'F admin hotel coupon rejects a room outside selected properties');

    $ticketCoupon = $coupons[] = addCoupon($controller, [
        'goodsIds' => [$goods[0]], 'skuIds' => [$tickets[0]],
    ]);
    $ticket = (array) Db::table('marketing_coupon')->where('id', $ticketCoupon)->first();
    check(json_decode($ticket['goods_ids'], true) === [$goods[0]]
        && json_decode($ticket['sku_ids'], true) === [$tickets[0]]
        && $ticket['property_ids'] === null && $ticket['room_type_ids'] === null,
        'F admin ticket coupon keeps goods and ticket type keys');
    rejects(40302, fn () => addCoupon($controller, ['goodsIds' => [$goods[1]]]),
        'F admin ticket coupon rejects goods from another site');
    rejects(40001, fn () => addCoupon($controller, ['goodsIds' => [$goods[0]], 'skuIds' => [$tickets[1]]]),
        'F admin ticket coupon rejects a ticket type outside selected goods');

    $view = (new CouponView())->attachApplicableOne((new CouponView())->template($hotel));
    check($view['applicable_hotels'][0]['property_id'] === $properties[0]
        && $view['applicable_rooms'][0]['room_type_id'] === $rooms[0]
        && $view['applicable_goods'] === [],
        'F consumer coupon view names hotel property and room scope');
    echo "PROPERTY COUPON SCOPE INTEGRATION PASSED\n";
} finally {
    if ($coupons) Db::table('marketing_coupon')->whereIn('id', $coupons)->delete();
    if ($tickets) Db::table('ticket_type')->whereIn('id', $tickets)->delete();
    if ($goods) Db::table('goods_info')->whereIn('id', $goods)->delete();
    if ($rooms) Db::table('hotel_room_type')->whereIn('id', $rooms)->delete();
    if ($properties) Db::table('merchant_store')->whereIn('id', $properties)->delete();
    if ($merchants) Db::table('merchant_info')->whereIn('id', $merchants)->delete();
}
