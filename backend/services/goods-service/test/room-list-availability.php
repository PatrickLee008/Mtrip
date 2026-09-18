<?php

declare(strict_types=1);

require __DIR__ . '/RoomReviewBootstrap.php';

use App\Controller\Merchant\RoomController;
use App\Service\RoomReviewService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;

/**
 * 客房管理列表的可用性字段回归。
 *
 * 背景(goods_daily_stock 是按日期存的):只订明天/后天的订单**不会**改「今日可售」,
 * 而商户在客房管理里只看得到今日 —— 于是"下了单但数字没动"被当成 bug 报回来
 * (见 docs/plans/20)。列表因此额外下发未来窗口 `upcoming_days / upcoming_stock_left /
 * upcoming_stock_date / upcoming_sold`,本用例把这两条口径钉住:
 *   1. 无日库存记录 → 今日与窗口都按房型默认可售配额(launch_stock 优先)兜底;
 *   2. 只有非今日订单 → 今日数字不变,但窗口最低值/最低日期/已订间夜必须变;
 *   3. 商户主动关房的日期不计入窗口最低值。
 */
$merchantId = $propertyId = $roomId = 0;

try {
    $siteId = 992;
    Db::connection('system')->table('sys_site')->updateOrInsert(['id' => $siteId], ['site_name' => 'Room list test', 'currency' => 'THB']);
    $suffix = bin2hex(random_bytes(6));
    $merchantId = (int) Db::table('merchant_info')->insertGetId([
        'site_id' => $siteId, 'merchant_name' => 'Room list merchant', 'credit_code' => 'RL-' . $suffix,
        'legal_person' => 'Tester', 'contact_name' => 'Tester', 'contact_phone' => 'test', 'status' => 3,
    ]);
    $propertyId = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => $siteId, 'merchant_id' => $merchantId, 'store_name' => 'Room list hotel',
        'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
    ]);
    $property = (array) Db::table('merchant_store')->where('id', $propertyId)->first();
    $cover = '/uploads/rooms/list-availability.jpg';
    Db::table('hotel_room_media')->insert([
        'site_id' => $siteId, 'property_id' => $propertyId, 'uploaded_by' => 99201,
        'kind' => 'image', 'url' => $cover, 'mime' => 'image/jpeg', 'size_bytes' => 1024,
    ]);

    MerchantContext::set(['admin_id' => 99201, 'admin_name' => 'Merchant tester', 'site_id' => $siteId, 'merchant_id' => $merchantId, 'account_type' => 2, 'is_owner' => true]);
    $service = new RoomReviewService();
    $created = $service->save($property, 0, [
        'room_name' => 'Room list availability', 'room_code' => 'CODEX-RLA', 'description' => 'list availability',
        'bed_type' => '1 King Bed', 'bed_count' => 1, 'area' => '36', 'max_adults' => 2,
        'max_children' => 1, 'max_guests' => 3, 'floor_name' => '3-6', 'room_view' => 'Garden View',
        'smoking' => 0, 'breakfast' => 1, 'meal_plan' => 'Breakfast Included',
        'cancellation_policy' => 'Flexible', 'currency' => 'THB', 'checkin_notes' => 'ID required',
        'base_price' => 1000, 'weekend_price' => 1200, 'extra_bed_price' => 300,
        'base_stock' => 8, 'launch_stock' => 4, 'images' => [$cover],
        'video_url' => '', 'facilities' => ['WiFi'], 'status' => 1, 'sort' => 0,
    ], true);
    $roomId = (int) $created['id'];
    AdminContext::set(['admin_id' => 99201, 'admin_name' => 'Reviewer', 'site_id' => 0, 'is_super' => true]);
    $service->audit($created['revisionId'], 1, 'Approved');
    check((int) Db::table('hotel_room_type')->where('id', $roomId)->value('approved_version') === 1, 'room approved before list assertions');

    MerchantContext::set(['admin_id' => 99201, 'admin_name' => 'Merchant tester', 'site_id' => $siteId, 'merchant_id' => $merchantId, 'account_type' => 2, 'is_owner' => true]);
    $row = static function () use ($container, $propertyId): array {
        setRequest(['propertyId' => $propertyId]);
        $list = $container->get(RoomController::class)->index()['data']['list'];
        return (array) ($list[0] ?? []);
    };

    $baseline = $row();
    check((int) ($baseline['today_stock_total'] ?? -1) === 4, 'today total falls back to launch quota without a daily row');
    check((int) ($baseline['today_stock_left'] ?? -1) === 4, 'today left falls back to launch quota');
    check((int) ($baseline['upcoming_days'] ?? 0) === 7, 'upcoming window is 7 days');
    check((int) ($baseline['upcoming_stock_left'] ?? -1) === 4, 'upcoming left mirrors the default quota before any booking');
    check((int) ($baseline['upcoming_sold'] ?? -1) === 0, 'upcoming occupied is 0 before any booking');

    // 复刻 OrderStockService::lock() 对「明天」的占用:无日库存记录先补建,再累加锁定
    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    Db::table('goods_daily_stock')->insertOrIgnore([
        'site_id' => $siteId, 'property_id' => $propertyId, 'goods_id' => 0, 'sku_type' => 1, 'sku_id' => $roomId,
        'stock_date' => $tomorrow, 'price' => 1000, 'stock_total' => 4, 'stock_locked' => 0,
    ]);
    Db::table('goods_daily_stock')->where('sku_type', 1)->where('sku_id', $roomId)->where('stock_date', $tomorrow)->increment('stock_locked', 1);

    $booked = $row();
    check((int) ($booked['today_stock_left'] ?? -1) === 4, 'a tomorrow-only booking leaves today untouched (按日期存库的既有口径)');
    check((int) ($booked['upcoming_stock_left'] ?? -1) === 3, 'upcoming left exposes the tomorrow-only booking');
    check((string) ($booked['upcoming_stock_date'] ?? '') === $tomorrow, 'upcoming lowest date points at the booked night');
    check((int) ($booked['upcoming_sold'] ?? -1) === 1, 'upcoming occupied counts sold + locked room nights');

    // 商户主动关房:不计入窗口最低值(最低值顺延到下一个未关房日期)
    $dayAfterTomorrow = date('Y-m-d', strtotime('+2 days'));
    Db::table('goods_daily_stock')->where('sku_type', 1)->where('sku_id', $roomId)->where('stock_date', $tomorrow)->update(['is_closed' => 1]);
    $closed = $row();
    check((int) ($closed['upcoming_stock_left'] ?? -1) === 4, 'closed days are excluded from the upcoming window');
    check((string) ($closed['upcoming_stock_date'] ?? '') === $dayAfterTomorrow, 'upcoming lowest date skips the closed day');
    check((int) ($closed['upcoming_sold'] ?? -1) === 1, 'closed day occupancy is still reported');
} finally {
    Db::table('hotel_room_media')->where('property_id', $propertyId)->delete();
    if ($roomId > 0) Db::table('goods_daily_stock')->where('sku_type', 1)->where('sku_id', $roomId)->delete();
    if ($roomId > 0) Db::table('hotel_room_type_revision')->where('room_id', $roomId)->delete();
    if ($roomId > 0) Db::table('hotel_room_type')->where('id', $roomId)->delete();
    if ($propertyId > 0) Db::table('merchant_store')->where('id', $propertyId)->delete();
    if ($merchantId > 0) Db::table('merchant_info')->where('id', $merchantId)->delete();
}
