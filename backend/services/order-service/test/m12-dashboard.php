<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Merchant\StatsController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\MerchantContext;

$merchants = $coupons = $orders = [];
$group = null;
function dashboardFor(int $merchant, int $type = 2, int $group = 0): array
{
    global $container;
    MerchantContext::set(['site_id' => 991, 'merchant_id' => $merchant, 'account_type' => $type, 'group_id' => $group]);
    setRequest([]);
    return $container->get(StatsController::class)->dashboard();
}
function dashboardCoupon(int $merchant, array $overrides = []): void
{
    global $coupons;
    $coupons[] = (int) Db::table('marketing_coupon')->insertGetId(array_replace([
        'site_id' => 991, 'merchant_id' => $merchant, 'coupon_name' => 'Dashboard isolated fixture',
        'status' => 1, 'valid_type' => 2, 'valid_days' => 7,
    ], $overrides));
}
try {
    $one = $merchants[] = merchantFixture();
    $two = $merchants[] = merchantFixture();
    $foreign = $merchants[] = merchantFixture(992);
    // Execute real controller SQL even without coupons: this reproduces missing-column error 1054.
    $empty = dashboardFor($one);
    check($empty['code'] === 0 && $empty['data']['kpi']['activePromotionCount'] === 0, 'Dashboard empty merchant returns success and zero promotions');
    check(count($empty['data']['trend']) === 7, 'Dashboard default trend has seven days');
    check(isset($empty['data']['propertyPerformance'], $empty['data']['todayOperations'], $empty['data']['alerts']), 'Dashboard complete response contract retained');
    foreach ([[$one, 100.25, 1, 0], [$one, 49.75, 3, 0], [$one, 20, 2, -1], [$one, 999, 4, 0], [$two, 700, 1, 0]] as [$merchant, $amount, $status, $offset]) {
        $orders[] = (int) Db::table('order_main')->insertGetId([
            'order_no' => 'DASH-' . bin2hex(random_bytes(8)), 'site_id' => 991, 'merchant_id' => $merchant,
            'goods_name' => 'Dashboard test hotel', 'sku_name' => 'Test room', 'contact_name' => 'Fixture', 'contact_phone' => '',
            'pay_amount' => $amount, 'order_status' => $status, 'pay_time' => date('Y-m-d H:i:s', strtotime("{$offset} days")),
        ]);
    }
    $result = dashboardFor($one)['data'];
    $byDate = array_column($result['trend'], null, 'date');
    check($byDate[date('Y-m-d')]['bookingCount'] === 2 && $byDate[date('Y-m-d')]['salesAmount'] === 150.0, 'Dashboard daily trend aggregates paid orders without cancelled or foreign orders');
    check($byDate[date('Y-m-d', strtotime('-1 day'))]['bookingCount'] === 1 && $byDate[date('Y-m-d', strtotime('-1 day'))]['salesAmount'] === 20.0, 'Dashboard groups payments into separate days');
    check($result['kpi']['revenueToday'] === 150.0, 'Dashboard revenue KPI agrees with daily trend');
    dashboardCoupon($one);
    dashboardCoupon($one, ['valid_type' => 1, 'valid_start' => date('Y-m-d H:i:s', time()-3600), 'valid_end' => date('Y-m-d H:i:s', time()+3600)]);
    check(dashboardFor($one)['data']['kpi']['activePromotionCount'] === 2, 'Dashboard counts active fixed-date and relative-validity promotions');
    dashboardCoupon($one, ['status' => 0]);
    dashboardCoupon($one, ['status' => 2]);
    dashboardCoupon($one, ['status' => 3]);
    dashboardCoupon($one, ['deleted_at' => date('Y-m-d H:i:s')]);
    dashboardCoupon($one, ['valid_type' => 1, 'valid_start' => date('Y-m-d H:i:s', time()-7200), 'valid_end' => date('Y-m-d H:i:s', time()-3600)]);
    dashboardCoupon($one, ['valid_type' => 1, 'valid_start' => date('Y-m-d H:i:s', time()+3600), 'valid_end' => date('Y-m-d H:i:s', time()+7200)]);
    check(dashboardFor($one)['data']['kpi']['activePromotionCount'] === 2, 'Dashboard excludes draft paused ended deleted expired and future promotions');
    dashboardCoupon($two);
    dashboardCoupon($foreign, ['site_id' => 992]);
    dashboardCoupon(0);
    check(dashboardFor($one)['data']['kpi']['activePromotionCount'] === 2, 'Dashboard excludes other merchants sites and platform coupons');
    check(dashboardFor($two)['data']['kpi']['activePromotionCount'] === 1, 'Dashboard second merchant has independent count');
    $group = (int) Db::table('merchant_group')->insertGetId(['site_id' => 991, 'group_name' => 'Dashboard isolated group', 'contact_name' => 'Fixture', 'contact_phone' => '', 'status' => 1]);
    Db::table('merchant_info')->whereIn('id', $merchants)->update(['group_id' => $group]);
    check(dashboardFor(0, 1, $group)['data']['kpi']['activePromotionCount'] === 3, 'Dashboard group aggregates only its site merchants');
    Db::table('merchant_blacklist')->insert(['site_id' => 991, 'merchant_id' => $two, 'reason' => 'Dashboard fixture', 'status' => 1]);
    check(dashboardFor(0, 1, $group)['data']['kpi']['activePromotionCount'] === 2, 'Dashboard group excludes blacklisted merchants');
    check(dashboardFor($one, 3)['data']['kpi']['activePromotionCount'] === 0, 'Dashboard store cannot inherit merchant-wide promotions');
    check(dashboardFor(0, 1, 0)['data']['kpi']['activePromotionCount'] === 0, 'Dashboard empty scope cannot expose platform coupons');
} finally {
    if ($coupons) Db::table('marketing_coupon')->whereIn('id', $coupons)->delete();
    if ($orders) Db::table('order_main')->whereIn('id', $orders)->delete();
    if ($merchants) {
        Db::table('merchant_blacklist')->whereIn('merchant_id', $merchants)->delete();
        Db::table('merchant_info')->whereIn('id', $merchants)->delete();
    }
    if ($group) Db::table('merchant_group')->where('id', $group)->delete();
}
