<?php

declare(strict_types=1);

require __DIR__ . '/RoomReviewBootstrap.php';

use App\Service\RoomReviewService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;

$merchantId = $goodsId = $roomId = 0;
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
    $suffix = bin2hex(random_bytes(6));
    $merchantId = (int) Db::table('merchant_info')->insertGetId([
        'site_id' => 991, 'merchant_name' => 'Room review merchant', 'credit_code' => 'RR-' . $suffix,
        'legal_person' => 'Tester', 'contact_name' => 'Tester', 'contact_phone' => 'test', 'status' => 3,
    ]);
    $goodsId = (int) Db::table('goods_info')->insertGetId(['site_id' => 991, 'merchant_id' => $merchantId, 'goods_name' => 'Room review hotel', 'goods_type' => 1, 'status' => 3]);
    $goods = (array) Db::table('goods_info')->where('id', $goodsId)->first();
    MerchantContext::set(['admin_id' => 99101, 'admin_name' => 'Merchant tester', 'site_id' => 991, 'merchant_id' => $merchantId, 'account_type' => 2, 'is_owner' => true]);
    $created = $service->save($goods, 0, $payload, true);
    $roomId = $created['id'];
    $room = (array) Db::table('hotel_room_type')->where('id', $roomId)->first();
    check((int) $room['status'] === 2 && (int) $room['publish_status'] === 1 && (int) $room['approved_version'] === 0, 'new submitted room remains non-sale placeholder');

    AdminContext::set(['admin_id' => 99001, 'admin_name' => 'Reviewer', 'site_id' => 0, 'is_super' => true]);
    $service->audit($created['revisionId'], 2, 'Improve photos');
    check((int) Db::table('hotel_room_type_revision')->where('id', $created['revisionId'])->value('status') === 3, 'reviewer can reject with immutable reason');

    MerchantContext::set(['admin_id' => 99101, 'site_id' => 991, 'merchant_id' => $merchantId, 'account_type' => 2, 'is_owner' => true]);
    $payload['room_name'] = 'Room review approved';
    $resubmitted = $service->save($goods, $roomId, $payload, true);
    check($resubmitted['version'] === 2, 'rejected room resubmits as a new version');
    AdminContext::set(['admin_id' => 99001, 'site_id' => 0, 'is_super' => true]);
    $service->audit($resubmitted['revisionId'], 1, 'Approved');
    $approved = (array) Db::table('hotel_room_type')->where('id', $roomId)->first();
    check($approved['room_name'] === 'Room review approved' && (int) $approved['publish_status'] === 2 && (int) $approved['approved_version'] === 2, 'approval publishes version atomically');

    MerchantContext::set(['admin_id' => 99101, 'site_id' => 991, 'merchant_id' => $merchantId, 'account_type' => 2, 'is_owner' => true]);
    $payload['room_name'] = 'Room review pending update';
    $pending = $service->save($goods, $roomId, $payload, true);
    check(Db::table('hotel_room_type')->where('id', $roomId)->value('room_name') === 'Room review approved', 'pending update never overwrites live room');
    AdminContext::set(['admin_id' => 99001, 'site_id' => 0, 'is_super' => true]);
    $service->audit($pending['revisionId'], 2, 'Keep current copy');
    check(Db::table('hotel_room_type')->where('id', $roomId)->value('room_name') === 'Room review approved', 'rejection preserves previous approved room');
} finally {
    if ($roomId > 0) Db::table('hotel_room_type_revision')->where('room_id', $roomId)->delete();
    if ($roomId > 0) Db::table('hotel_room_type')->where('id', $roomId)->delete();
    if ($goodsId > 0) Db::table('goods_info')->where('id', $goodsId)->delete();
    if ($merchantId > 0) Db::table('merchant_info')->where('id', $merchantId)->delete();
}
