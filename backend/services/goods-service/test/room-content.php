<?php

declare(strict_types=1);

require __DIR__ . '/RoomReviewBootstrap.php';

use App\Service\RoomReviewService;
use App\Service\RoomContentService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Support\RoomDefaults;

Db::connection('system')->table('sys_site')->updateOrInsert(['id' => 992], ['site_name' => 'Room content test', 'currency' => 'MMK']);
$merchant = Db::table('merchant_info')->insertGetId(['site_id' => 992, 'merchant_name' => 'Room test', 'credit_code' => 'CONTENT', 'legal_person' => 'test', 'contact_name' => 'test', 'contact_phone' => 'test', 'status' => 3]);
$propertyId = Db::table('merchant_store')->insertGetId(['site_id' => 992, 'merchant_id' => $merchant, 'store_name' => 'Hotel', 'business_type' => 'hotel', 'kyc_status' => 1]);
$property = (array) Db::table('merchant_store')->where('id', $propertyId)->first();
MerchantContext::set(['admin_id' => 99201, 'site_id' => 992, 'merchant_id' => $merchant, 'account_type' => 2, 'is_owner' => true, 'selected_property_id' => $propertyId]);
AdminContext::set(['admin_id' => 99202, 'site_id' => 0, 'is_super' => true]);
foreach (['image', 'panorama', 'floorplan', 'closeup', 'vr_cover'] as $kind) Db::table('hotel_room_media')->insert(['site_id' => 992, 'property_id' => $propertyId, 'uploaded_by' => 99201, 'kind' => $kind, 'url' => '/uploads/rooms/test-' . $kind . '.jpg', 'mime' => 'image/jpeg', 'size_bytes' => 1024]);
$payload = ['room_name' => 'Suite', 'room_code' => '', 'bed_type' => 'King', 'bed_count' => 1, 'area' => '40', 'area_unit' => 'sqft', 'max_adults' => 2, 'max_children' => 1, 'max_guests' => 3, 'base_price' => 1000, 'weekend_price' => 1200, 'base_stock' => 8, 'launch_stock' => 3, 'currency' => 'MMK', 'status' => 1,
    'images' => ['/uploads/rooms/test-image.jpg'], 'bedding' => [['id' => 'king', 'type' => 'King', 'quantity' => 1], ['id' => 'single', 'type' => 'Single', 'quantity' => 2]],
    'panorama' => ['enabled' => true, 'url' => '/uploads/rooms/test-panorama.jpg'], 'vr_tour' => ['enabled' => false, 'url' => 'https://example.com/tour', 'cover' => '/uploads/rooms/test-vr_cover.jpg'],
    'floor_plan' => ['enabled' => true, 'image' => '/uploads/rooms/test-floorplan.jpg', 'hotspots' => [['id' => 'a', 'x' => .25, 'y' => .75, 'title' => 'Bed', 'description' => '', 'image' => '/uploads/rooms/test-closeup.jpg']]],
    'refund_policy' => ['ruleType' => 3, 'rules' => [], 'remark' => 'Non-refundable']];
$service = new RoomReviewService();
foreach ([['currency' => 'THB'], ['max_guests' => 1], ['launch_stock' => 9], ['base_stock' => -1], ['area' => '-3'], ['bedding' => [['type' => 'King', 'quantity' => 0]]], ['images' => array_fill(0, 11, '/uploads/rooms/test-image.jpg')], ['images' => ['/uploads/rooms/foreign.jpg']], ['vr_tour' => ['enabled' => true]], ['refund_policy' => ['ruleType' => 2, 'rules' => [['hours_before' => 24, 'refund_rate' => 100]]]]] as $invalid) {
    rejects(40001, fn () => $service->save($property, 0, array_replace($payload, $invalid), true), 'invalid ' . array_key_first($invalid));
}
$created = $service->save($property, 0, $payload, true);
$id = $created['id'];
check((int) Db::table('hotel_room_type')->where('id', $id)->value('approved_version') === 0, 'submitted media stays unpublished');
$service->audit($created['revisionId'], 1, 'ok');
$room = (array) Db::table('hotel_room_type')->where('id', $id)->first();
check($room['currency'] === 'MMK' && (int) $room['bed_count'] === 3, 'site MMK and multiple bedding published');
check((int) Db::table('goods_refund_rule')->where('sku_id', $id)->value('rule_type') === 3, 'approval updates executable refund rule');
check(RoomDefaults::stock($room) === 3 && RoomDefaults::price($room, '2026-09-18') === 1200.0 && RoomDefaults::price($room, '2026-09-20') === 1000.0, 'default quota and Friday/Saturday pricing');
Db::table('goods_daily_stock')->insert(['site_id' => 992, 'property_id' => $propertyId, 'sku_type' => 1, 'sku_id' => $id, 'stock_date' => '2026-09-18', 'stock_total' => 7, 'price' => 900]);
$update = $service->save($property, $id, array_replace($payload, ['room_name' => 'New name', 'launch_stock' => 1]), true);
Db::table('hotel_room_type')->where('id', $id)->update(['status' => 2, 'status_version' => 1]);
$service->audit($update['revisionId'], 1, 'ok');
check((int) Db::table('hotel_room_type')->where('id', $id)->value('status') === 2, 'content approval preserves emergency stop');
check((int) Db::table('goods_daily_stock')->where('sku_id', $id)->value('stock_total') === 7, 'profile approval preserves daily override');
$copy = $service->copy($property, (array) Db::table('hotel_room_type')->where('id', $id)->first());
check((int) Db::table('hotel_room_type')->where('id', $copy['id'])->value('base_stock') === 0, 'copy resets quantities');
$order = ['order_no' => 'ROOM-CONTENT', 'site_id' => 992, 'property_id' => $propertyId, 'room_type_id' => $id, 'sku_id' => 0, 'order_type' => 1, 'goods_name' => 'Hotel', 'sku_name' => 'Suite', 'booking_status' => 1, 'contact_name' => 'Tester', 'contact_phone' => 'test', 'use_date' => '2026-09-18'];
$orderId = Db::table('order_main')->insertGetId($order);
foreach ([1, 2, 3] as $status) {
    Db::table('order_main')->where('id', $orderId)->update(['booking_status' => $status]);
    rejects(40901, fn () => $service->remove($property, $room), 'active booking ' . $status . ' prevents deletion');
}
Db::table('order_main')->where('id', $orderId)->update(['booking_status' => 4]);
$delete = $service->remove($property, $room);
Db::table('order_main')->where('id', $orderId)->update(['booking_status' => 2]);
rejects(40901, fn () => $service->audit($delete['revisionId'], 1, 'ok'), 'delete approval rechecks newly active bookings');
Db::table('order_main')->where('id', $orderId)->update(['booking_status' => 4]);
$service->audit($delete['revisionId'], 1, 'ok');
check(Db::table('hotel_room_type')->where('id', $id)->value('deleted_at') !== null, 'completed orders allow reviewed soft delete');
check(Db::table('order_main')->where('id', $orderId)->exists(), 'historical order remains');
echo "Room content regressions passed\n";
