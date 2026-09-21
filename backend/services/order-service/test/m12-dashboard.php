<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Merchant\StatsController;
use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Support\CryptoHelper;

$merchants = $properties = $coupons = $orders = [];
$roomTypes = $stocks = $syncLogs = [];
$group = null;

/** 住客名单列存的是 AES 密文,按同一把 mtrip.aes_key 加密才能被控制器解出人数 */
function dashboardGuests(array $names): string
{
    global $container;
    $key = (string) $container->get(ConfigInterface::class)->get('mtrip.aes_key', '');
    return CryptoHelper::encrypt(json_encode($names), $key);
}
function dashboardFor(int $merchant, int $type = 2, int $group = 0, int $store = 0): array
{
    global $container;
    MerchantContext::set([
        'site_id' => 991, 'merchant_id' => $merchant, 'account_type' => $type,
        'group_id' => $group, 'store_id' => $store, 'is_owner' => true,
    ]);
    setRequest([]);
    return $container->get(StatsController::class)->dashboard();
}
function dashboardForProperties(int $merchant, array $propertyIds, int $selected): array
{
    global $container;
    MerchantContext::set([
        'site_id' => 991, 'merchant_id' => $merchant, 'account_type' => 2, 'is_owner' => false,
        'property_ids' => $propertyIds, 'selected_property_id' => $selected,
    ]);
    setRequest([]);
    return $container->get(StatsController::class)->dashboard();
}
function dashboardCoupon(int $merchant, array $propertyIds, array $overrides = []): void
{
    global $coupons;
    $coupons[] = (int) Db::table('marketing_coupon')->insertGetId(array_replace([
        'site_id' => 991, 'merchant_id' => $merchant, 'coupon_name' => 'Dashboard isolated fixture',
        'status' => 1, 'valid_type' => 2, 'valid_days' => 7,
        'property_ids' => json_encode($propertyIds),
    ], $overrides));
}
try {
    $one = $merchants[] = merchantFixture();
    $two = $merchants[] = merchantFixture();
    $foreign = $merchants[] = merchantFixture(992);
    $propertyOne = $properties[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $one, 'store_name' => 'Dashboard Property One',
        'business_type' => 'hotel', 'status' => 1, 'operating_status' => 1,
    ]);
    $propertyOneB = $properties[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $one, 'store_name' => 'Dashboard Property One B',
        'business_type' => 'hotel', 'status' => 1, 'operating_status' => 1,
    ]);
    $propertyTwo = $properties[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $two, 'store_name' => 'Dashboard Property Two',
        'business_type' => 'hotel', 'status' => 1, 'operating_status' => 1,
    ]);
    $foreignProperty = $properties[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 992, 'merchant_id' => $foreign, 'store_name' => 'Dashboard Foreign Property',
        'business_type' => 'hotel', 'status' => 1, 'operating_status' => 1,
    ]);
    // Execute real controller SQL even without coupons: this reproduces missing-column error 1054.
    $empty = dashboardFor($one);
    check($empty['code'] === 0 && $empty['data']['kpi']['activePromotionCount'] === 0, 'Dashboard empty merchant returns success and zero promotions');
    check(count($empty['data']['trend']) === 7, 'Dashboard default trend has seven days');
    check(isset($empty['data']['propertyPerformance'], $empty['data']['todayOperations'], $empty['data']['alerts']), 'Dashboard complete response contract retained');
    foreach ([
        [991, $one, $propertyOne, 100.25, 1, 0], [991, $one, $propertyOneB, 49.75, 3, 0],
        [991, $one, $propertyOne, 20, 2, -1], [991, $one, $propertyOneB, 999, 4, 0],
        [991, $two, $propertyTwo, 700, 1, 0], [992, $foreign, $foreignProperty, 800, 1, 0],
    ] as [$site, $merchant, $property, $amount, $status, $offset]) {
        $orders[] = (int) Db::table('order_main')->insertGetId([
            'order_no' => 'DASH-' . bin2hex(random_bytes(8)), 'site_id' => $site, 'merchant_id' => $merchant,
            'order_type' => 1, 'property_id' => $property,
            'goods_name' => 'Dashboard test hotel', 'sku_name' => 'Test room', 'contact_name' => 'Fixture', 'contact_phone' => '',
            'pay_amount' => $amount, 'order_status' => $status, 'pay_time' => date('Y-m-d H:i:s', strtotime("{$offset} days")),
        ]);
    }
    $result = dashboardFor($one)['data'];
    $byDate = array_column($result['trend'], null, 'date');
    check($byDate[date('Y-m-d')]['bookingCount'] === 2 && $byDate[date('Y-m-d')]['salesAmount'] === 150.0, 'Dashboard daily trend aggregates paid orders without cancelled or foreign orders');
    check($byDate[date('Y-m-d', strtotime('-1 day'))]['bookingCount'] === 1 && $byDate[date('Y-m-d', strtotime('-1 day'))]['salesAmount'] === 20.0, 'Dashboard groups payments into separate days');
    check($result['kpi']['revenueToday'] === 150.0, 'Dashboard revenue KPI agrees with daily trend');
    $selected = dashboardForProperties($one, [$propertyOne, $propertyOneB], $propertyOne)['data'];
    check($selected['kpi']['revenueToday'] === 100.25 && $selected['kpi']['totalPropertyCount'] === 1,
        'E selected property narrows dashboard revenue and property count');
    check(count($selected['propertyPerformance']) === 1
        && $selected['propertyPerformance'][0]['propertyId'] === $propertyOne,
        'E selected property narrows property performance rows');
    dashboardCoupon($one, [$propertyOne]);
    dashboardCoupon($one, [$propertyOneB], ['valid_type' => 1, 'valid_start' => date('Y-m-d H:i:s', time()-3600), 'valid_end' => date('Y-m-d H:i:s', time()+3600)]);
    check(dashboardFor($one)['data']['kpi']['activePromotionCount'] === 2, 'Dashboard counts active fixed-date and relative-validity promotions');
    check(dashboardForProperties($one, [$propertyOne, $propertyOneB], $propertyOne)['data']['kpi']['activePromotionCount'] === 1,
        'F selected property counts only its active promotions');
    dashboardCoupon($one, [$propertyOne], ['status' => 0]);
    dashboardCoupon($one, [$propertyOne], ['status' => 2]);
    dashboardCoupon($one, [$propertyOne], ['status' => 3]);
    dashboardCoupon($one, [$propertyOne], ['deleted_at' => date('Y-m-d H:i:s')]);
    dashboardCoupon($one, [$propertyOne], ['valid_type' => 1, 'valid_start' => date('Y-m-d H:i:s', time()-7200), 'valid_end' => date('Y-m-d H:i:s', time()-3600)]);
    dashboardCoupon($one, [$propertyOne], ['valid_type' => 1, 'valid_start' => date('Y-m-d H:i:s', time()+3600), 'valid_end' => date('Y-m-d H:i:s', time()+7200)]);
    check(dashboardFor($one)['data']['kpi']['activePromotionCount'] === 2, 'Dashboard excludes draft paused ended deleted expired and future promotions');
    dashboardCoupon($two, [$propertyTwo]);
    dashboardCoupon($foreign, [$foreignProperty], ['site_id' => 992]);
    dashboardCoupon(0, []);
    check(dashboardFor($one)['data']['kpi']['activePromotionCount'] === 2, 'Dashboard excludes other merchants sites and platform coupons');
    check(dashboardFor($two)['data']['kpi']['activePromotionCount'] === 1, 'Dashboard second merchant has independent count');
    $group = (int) Db::table('merchant_group')->insertGetId(['site_id' => 991, 'group_name' => 'Dashboard isolated group', 'contact_name' => 'Fixture', 'contact_phone' => '', 'status' => 1]);
    Db::table('merchant_info')->whereIn('id', $merchants)->update(['group_id' => $group]);
    check(dashboardFor(0, 1, $group)['data']['kpi']['activePromotionCount'] === 3, 'Dashboard group aggregates only its site merchants');
    Db::table('merchant_blacklist')->insert(['site_id' => 991, 'merchant_id' => $two, 'reason' => 'Dashboard fixture', 'status' => 1]);
    check(dashboardFor(0, 1, $group)['data']['kpi']['activePromotionCount'] === 2, 'Dashboard group excludes blacklisted merchants');
    check(dashboardFor($one, 3, 0, $propertyOne)['data']['kpi']['activePromotionCount'] === 1, 'F property account counts promotions for its property');
    check(dashboardFor(0, 1, 0)['data']['kpi']['activePromotionCount'] === 0, 'Dashboard empty scope cannot expose platform coupons');

    // ---------- 2026-09-22 Dashboard & Earnings(Figma 1306:18423)新增口径 ----------
    $today = date('Y-m-d');
    $roomTypes[] = (int) Db::table('hotel_room_type')->insertGetId([
        'site_id' => 991, 'property_id' => $propertyOneB, 'room_name' => 'Dashboard fallback room',
        'base_stock' => 10, 'status' => 1, 'currency' => 'MMK',
    ]);

    // A. 有日库存的物业:每日 5/10
    foreach (range(0, 6) as $offset) {
        $stocks[] = (int) Db::table('goods_daily_stock')->insertGetId([
            'site_id' => 991, 'property_id' => $propertyOne, 'sku_type' => 1, 'sku_id' => 9001,
            'stock_date' => date('Y-m-d', strtotime("-{$offset} days")),
            'price' => 100, 'stock_total' => 10, 'stock_sold' => 5,
        ]);
    }

    $flowOrder = function (array $overrides) use ($one): int {
        return (int) Db::table('order_main')->insertGetId(array_replace([
            'order_no' => 'DASH-FLOW-' . bin2hex(random_bytes(6)), 'site_id' => 991, 'merchant_id' => $one,
            'order_type' => 1, 'property_id' => 0, 'goods_name' => 'Dashboard test hotel',
            'sku_name' => 'Test room', 'contact_name' => 'Fixture', 'contact_phone' => '',
            'quantity' => 1, 'guests' => '', 'order_status' => 2, 'booking_status' => 3,
            'payment_status' => 2, 'pay_method' => 1,
        ], $overrides));
    };

    // B. 无日库存的物业:基础库存 10 + 在住 2 间夜(today-3 / today-2)→ 7/20
    $orders[] = $flowOrder([
        'property_id' => $propertyOneB, 'quantity' => 2,
        'use_date' => date('Y-m-d', strtotime('-3 days')), 'end_date' => date('Y-m-d', strtotime('-1 day')),
    ]);
    // E. 今日到达:密文住客名单 3 条,尚未入住
    $orders[] = $flowOrder([
        'property_id' => $propertyOne, 'guests' => dashboardGuests(['Aung', 'Su', 'Min']),
        'use_date' => $today, 'end_date' => date('Y-m-d', strtotime('+1 day')), 'booking_status' => 1,
    ]);
    // F. 今日离店且已退房(guests 为空 → 回退间数 1)
    $orders[] = $flowOrder([
        'property_id' => $propertyOne, 'order_status' => 3, 'booking_status' => 4,
        'use_date' => date('Y-m-d', strtotime('-2 days')), 'end_date' => $today,
    ]);
    // G. 今日离店但未退房 → pending 计数
    $orders[] = $flowOrder([
        'property_id' => $propertyOne, 'booking_status' => 2,
        'use_date' => date('Y-m-d', strtotime('-1 day')), 'end_date' => $today,
    ]);
    // H. 第二种房型(落在区间外,只为让房型占比有两行)
    $orders[] = $flowOrder([
        'property_id' => $propertyOne, 'sku_name' => 'Deluxe King', 'room_type_id' => 9002,
        'use_date' => date('Y-m-d', strtotime('-10 days')), 'end_date' => date('Y-m-d', strtotime('-9 days')),
    ]);

    $earnings = dashboardFor($one)['data'];
    $trend = array_column($earnings['occupancyTrend'], 'occupancyRate', 'date');
    check(count($earnings['occupancyTrend']) === 7, 'G occupancy trend covers the seven-day range');
    check($trend[$today] === 25.0, 'G occupancy mixes daily stock (5/10) with base-stock fallback (0/10) per property');
    check($trend[date('Y-m-d', strtotime('-2 days'))] === 35.0, 'G base-stock property contributes occupied room nights (2/10) on in-house days');
    check(array_key_exists(date('Y-m-d', strtotime('-6 days')), $trend) && $trend[date('Y-m-d', strtotime('-6 days'))] === 25.0,
        'G fallback property contributes zero occupancy on days without stays');
    check($earnings['kpi']['occupancyRate'] === 27.9, 'G occupancy KPI is the range average (27.9%)');
    check(is_float($earnings['kpi']['occupancyWeekDelta']) || $earnings['kpi']['occupancyWeekDelta'] === null,
        'G occupancy week delta is numeric or null when the previous window has no inventory');

    $kpi = $earnings['kpi'];
    check($kpi['todayArrivalGuestCount'] === 3, 'G arrivals count decrypted guest-list entries');
    check($kpi['todayArrivalGroupCount'] === 1 && $kpi['todayArrivalRemainingCount'] === 1, 'G arrivals report one group that has not checked in yet');
    check($kpi['todayDepartureGuestCount'] === 2, 'G departures fall back to room quantity when the guest list is empty');
    check($kpi['todayDepartureGroupCount'] === 2 && $kpi['todayDeparturePendingCount'] === 1, 'G departures count only not-yet-checked-out bookings as pending');

    // 同步失败告警:只统计本商户范围内订单的失败记录
    $scopedOrder = (int) $orders[0];
    $foreignOrder = (int) Db::table('order_main')->where('site_id', 992)->value('id');
    foreach ([[$scopedOrder, 2], [$scopedOrder, 2], [$scopedOrder, 1], [$foreignOrder, 2]] as [$orderId, $status]) {
        $syncLogs[] = (int) Db::table('order_sync_log')->insertGetId([
            'site_id' => 991, 'order_id' => $orderId, 'order_no' => 'DASH-SYNC',
            'target' => 'pms', 'action' => 'push', 'status' => $status,
            'request_summary' => '{}', 'response_summary' => '{}', 'error_message' => 'fixture',
        ]);
    }
    check(dashboardFor($one)['data']['kpi']['syncErrorCount'] === 2,
        'G sync error count includes only failures and excludes successes and other sites');

    $performance = $earnings['roomTypePerformance'];
    check(count($performance) >= 2, 'G room type performance splits rows by room type');
    check(array_keys($performance[0]) === ['roomTypeId', 'roomName', 'bookingCount', 'percent'],
        'G room type performance row contract');
    check(in_array('Deluxe King', array_column($performance, 'roomName'), true), 'G room type performance carries the room name');
    $percentSum = array_sum(array_column($performance, 'percent'));
    check(abs($percentSum - 100) < 0.5, 'G room type shares sum to 100% (got ' . $percentSum . ')');
    $counts = array_column($performance, 'bookingCount');
    $sorted = $counts;
    rsort($sorted);
    check($counts === $sorted, 'G room type performance is ordered by booking count desc');

    $recent = $earnings['recentBookings'];
    check(count($recent) > 0, 'G recent bookings returns rows');
    check(array_keys($recent[0]) === [
        'orderId', 'orderNo', 'guest', 'propertyName', 'roomType', 'checkIn', 'checkOut',
        'totalAmount', 'paymentStatus', 'bookingStatus', 'orderStatus', 'payMethod',
    ], 'G recent bookings row contract');
    $recentIds = array_column($recent, 'orderId');
    $recentSorted = $recentIds;
    rsort($recentSorted);
    check($recentIds === $recentSorted, 'G recent bookings are newest first');
    $names = array_unique(array_column($recent, 'propertyName'));
    sort($names);
    check($names === ['Dashboard Property One', 'Dashboard Property One B'],
        'G recent bookings join the property name and stay inside the merchant scope');
    check($earnings['startDate'] !== '' && $earnings['endDate'] === $today, 'G dashboard echoes the applied date range');
} finally {
    if ($syncLogs) Db::table('order_sync_log')->whereIn('id', $syncLogs)->delete();
    if ($stocks) Db::table('goods_daily_stock')->whereIn('id', $stocks)->delete();
    if ($roomTypes) Db::table('hotel_room_type')->whereIn('id', $roomTypes)->delete();
    if ($coupons) Db::table('marketing_coupon')->whereIn('id', $coupons)->delete();
    if ($orders) Db::table('order_main')->whereIn('id', $orders)->delete();
    if ($properties) Db::table('merchant_store')->whereIn('id', $properties)->delete();
    if ($merchants) {
        Db::table('merchant_blacklist')->whereIn('merchant_id', $merchants)->delete();
        Db::table('merchant_info')->whereIn('id', $merchants)->delete();
    }
    if ($group) Db::table('merchant_group')->where('id', $group)->delete();
}
