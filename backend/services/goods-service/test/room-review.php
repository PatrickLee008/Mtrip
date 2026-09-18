<?php

declare(strict_types=1);

require __DIR__ . '/RoomReviewBootstrap.php';

use App\Controller\Merchant\AvailabilityController;
use App\Controller\Merchant\GoodsController;
use App\Service\RoomReviewService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;

$merchantId = $propertyId = $roomId = $ticketGoodsId = 0;
$service = new RoomReviewService();
$payload = [
    'room_name' => 'Room review draft', 'room_code' => 'CODEX-RR', 'description' => 'draft',
    'bed_type' => '1 King Bed', 'bed_count' => 1, 'area' => '38', 'max_adults' => 2,
    'max_children' => 1, 'max_guests' => 3, 'floor_name' => '4-8', 'room_view' => 'Ocean View',
    'smoking' => 0, 'breakfast' => 1, 'meal_plan' => 'Breakfast Included',
    'cancellation_policy' => 'Flexible', 'currency' => 'THB', 'checkin_notes' => 'ID required',
    'base_price' => 1000, 'weekend_price' => 1200, 'extra_bed_price' => 300,
    'base_stock' => 8, 'launch_stock' => 4, 'images' => ['/uploads/rooms/test.jpg'],
    'video_url' => '', 'facilities' => ['WiFi'], 'status' => 1, 'sort' => 0,
];

try {
    Db::connection('system')->table('sys_site')->updateOrInsert(['id' => 991], ['site_name' => 'Room test', 'currency' => 'THB']);
    $suffix = bin2hex(random_bytes(6));
    $merchantId = (int) Db::table('merchant_info')->insertGetId([
        'site_id' => 991, 'merchant_name' => 'Room review merchant', 'credit_code' => 'RR-' . $suffix,
        'legal_person' => 'Tester', 'contact_name' => 'Tester', 'contact_phone' => 'test', 'status' => 3,
    ]);
    $propertyId = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchantId, 'store_name' => 'Room review hotel',
        'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
    ]);
    $property = (array) Db::table('merchant_store')->where('id', $propertyId)->first();
    Db::table('hotel_room_media')->insert(['site_id' => 991, 'property_id' => $propertyId, 'uploaded_by' => 99101, 'kind' => 'image', 'url' => '/uploads/rooms/test.jpg', 'mime' => 'image/jpeg', 'size_bytes' => 1024]);
    $hotelGoodsBefore = Db::table('goods_info')->where('goods_type', 1)->count();
    MerchantContext::set(['admin_id' => 99101, 'admin_name' => 'Merchant tester', 'site_id' => 991, 'merchant_id' => $merchantId, 'account_type' => 2, 'is_owner' => true]);
    $created = $service->save($property, 0, $payload, true);
    $roomId = $created['id'];
    $room = (array) Db::table('hotel_room_type')->where('id', $roomId)->first();
    check((int) $room['status'] === 2 && (int) $room['publish_status'] === 1 && (int) $room['approved_version'] === 0, 'new submitted room remains non-sale placeholder');

    AdminContext::set(['admin_id' => 99001, 'admin_name' => 'Reviewer', 'site_id' => 0, 'is_super' => true]);
    $service->audit($created['revisionId'], 2, 'Improve photos');
    check((int) Db::table('hotel_room_type_revision')->where('id', $created['revisionId'])->value('status') === 3, 'reviewer can reject with immutable reason');

    MerchantContext::set(['admin_id' => 99101, 'site_id' => 991, 'merchant_id' => $merchantId, 'account_type' => 2, 'is_owner' => true]);
    $payload['room_name'] = 'Room review approved';
    $resubmitted = $service->save($property, $roomId, $payload, true);
    check($resubmitted['version'] === 2, 'rejected room resubmits as a new version');
    AdminContext::set(['admin_id' => 99001, 'site_id' => 0, 'is_super' => true]);
    $service->audit($resubmitted['revisionId'], 1, 'Approved');
    $approved = (array) Db::table('hotel_room_type')->where('id', $roomId)->first();
    check($approved['room_name'] === 'Room review approved' && (int) $approved['publish_status'] === 2 && (int) $approved['approved_version'] === 2, 'approval publishes version atomically');

    MerchantContext::set(['admin_id' => 99101, 'admin_name' => 'Merchant tester', 'site_id' => 991, 'merchant_id' => $merchantId, 'account_type' => 2, 'is_owner' => true]);
    AdminContext::set(['admin_id' => 99101, 'site_id' => 991, 'is_super' => false,
        'permissions' => ['mch:availability:edit', 'mch:availability:bulk-update']]);
    $stockDate = date('Y-m-d', strtotime('+2 days'));
    setRequest(['propertyId' => $propertyId, 'roomTypeId' => $roomId, 'stockDate' => $stockDate, 'price' => 1350, 'stockTotal' => 7]);
    $container->get(AvailabilityController::class)->saveDay();
    $stock = (array) Db::table('goods_daily_stock')->where('sku_type', 1)->where('sku_id', $roomId)->where('stock_date', $stockDate)->first();
    check((int) $stock['property_id'] === $propertyId && (int) $stock['goods_id'] === 0,
        'availability writes property-scoped stock without hotel goods key');
    $stockLog = (array) Db::table('goods_stock_log')->where('sku_type', 1)->where('sku_id', $roomId)->where('stock_date', $stockDate)->first();
    check((int) $stockLog['property_id'] === $propertyId && (int) $stockLog['goods_id'] === 0,
        'availability log keeps the same property scope');
    setRequest(['propertyId' => $propertyId + 1000000, 'roomTypeId' => $roomId, 'stockDate' => $stockDate, 'price' => 1400, 'stockTotal' => 7]);
    rejects(40401, fn () => $container->get(AvailabilityController::class)->saveDay(), 'availability rejects a mismatched property and room');
    setRequest(['startDate' => $stockDate, 'endDate' => $stockDate, 'roomIds' => [], 'stockTotal' => 8]);
    rejects(40001, fn () => $container->get(AvailabilityController::class)->batchSet(), 'availability batch requires explicit room selection');
    setRequest(['startDate' => $stockDate, 'endDate' => $stockDate, 'roomIds' => [$roomId, $roomId + 1000000], 'stockTotal' => 8]);
    rejects(40302, fn () => $container->get(AvailabilityController::class)->batchSet(), 'availability batch rejects a partially invalid room selection');

    MerchantContext::set(['admin_id' => 99101, 'site_id' => 991, 'merchant_id' => $merchantId, 'account_type' => 2, 'is_owner' => true]);
    $payload['room_name'] = 'Room review pending update';
    $pending = $service->save($property, $roomId, $payload, true);
    check(Db::table('hotel_room_type')->where('id', $roomId)->value('room_name') === 'Room review approved', 'pending update never overwrites live room');
    MerchantContext::set(['admin_id' => 99102, 'site_id' => 991, 'merchant_id' => $merchantId, 'account_type' => 3, 'store_id' => $propertyId + 1000000, 'is_owner' => true]);
    rejects(40302, fn () => $service->withdraw($pending['revisionId']), 'property account cannot withdraw another property revision');
    AdminContext::set(['admin_id' => 99001, 'site_id' => 0, 'is_super' => true]);
    $service->audit($pending['revisionId'], 2, 'Keep current copy');
    check(Db::table('hotel_room_type')->where('id', $roomId)->value('room_name') === 'Room review approved', 'rejection preserves previous approved room');
    MerchantContext::set(['admin_id' => 99102, 'site_id' => 991, 'merchant_id' => $merchantId, 'account_type' => 3, 'store_id' => $propertyId, 'is_owner' => true]);
    $withdrawn = $service->save($property, $roomId, array_replace($payload, ['room_name' => 'Withdrawn update']), true);
    $service->withdraw($withdrawn['revisionId']);
    check((int) Db::table('hotel_room_type_revision')->where('id', $withdrawn['revisionId'])->value('status') === 4,
        'property account can withdraw its own property revision');
    check((int) Db::table('hotel_room_type')->where('id', $roomId)->value('property_id') === $propertyId,
        'room belongs directly to property');
    check(Db::table('goods_info')->where('goods_type', 1)->count() === $hotelGoodsBefore,
        'room lifecycle creates no hotel goods row');

    MerchantContext::set(['admin_id' => 99101, 'site_id' => 991, 'merchant_id' => $merchantId,
        'account_type' => 2, 'is_owner' => true]);
    AdminContext::set(['admin_id' => 99101, 'site_id' => 991, 'is_super' => false, 'permissions' => ['mch:goods:add']]);
    setRequest(['goodsType' => 1, 'goodsName' => 'Forbidden Hotel Goods']);
    rejects(40001, fn () => $container->get(GoodsController::class)->create(), 'hotel goods creation is rejected');
    setRequest(['goodsType' => 2, 'goodsName' => 'Ticket Goods Regression']);
    $ticketResult = $container->get(GoodsController::class)->create();
    $ticketGoodsId = (int) $ticketResult['data']['id'];
    check((int) Db::table('goods_info')->where('id', $ticketGoodsId)->value('goods_type') === 2,
        'ticket goods creation remains available');
} finally {
    Db::table('hotel_room_media')->where('property_id', $propertyId)->delete();
    if ($roomId > 0) Db::table('goods_stock_log')->where('sku_type', 1)->where('sku_id', $roomId)->delete();
    if ($roomId > 0) Db::table('goods_daily_stock')->where('sku_type', 1)->where('sku_id', $roomId)->delete();
    if ($roomId > 0) Db::table('hotel_room_type_revision')->where('room_id', $roomId)->delete();
    if ($roomId > 0) Db::table('hotel_room_type')->where('id', $roomId)->delete();
    if ($propertyId > 0) Db::table('merchant_store')->where('id', $propertyId)->delete();
    if ($ticketGoodsId > 0) Db::table('goods_info')->where('id', $ticketGoodsId)->delete();
    if ($merchantId > 0) Db::table('merchant_info')->where('id', $merchantId)->delete();
}
