<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Merchant\EarningsController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\MerchantContext;

$merchantIds = $propertyIds = $orderIds = $entryIds = $settleIds = [];

function earningsCall(string $method, array $input = []): array
{
    global $container;
    setRequest($input);
    return $container->get(EarningsController::class)->{$method}();
}

try {
    $merchantId = $merchantIds[] = merchantFixture(991);
    foreach (['A', 'B'] as $name) {
        $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
            'site_id' => 991, 'merchant_id' => $merchantId, 'store_name' => "Earnings Property {$name}",
            'business_type' => 'hotel', 'status' => 1,
        ]);
    }

    foreach ([[$propertyIds[0], 100], [$propertyIds[1], 250]] as [$propertyId, $amount]) {
        $orderId = $orderIds[] = (int) Db::table('order_main')->insertGetId([
            'order_no' => 'EARN-' . bin2hex(random_bytes(8)), 'site_id' => 991, 'merchant_id' => $merchantId,
            'order_type' => 1, 'property_id' => $propertyId, 'goods_name' => 'Earnings Hotel',
            'sku_name' => 'Earnings Room', 'contact_name' => 'Fixture', 'contact_phone' => '',
            'total_amount' => $amount, 'pay_amount' => $amount, 'order_status' => 1,
        ]);
        $entryIds[] = (int) Db::table('finance_account_entry')->insertGetId([
            'site_id' => 991, 'order_id' => $orderId, 'order_no' => 'EARN-ENTRY-' . $orderId,
            'merchant_id' => $merchantId, 'property_id' => $propertyId,
            'order_amount' => $amount, 'merchant_settlement' => $amount,
        ]);
        $settleIds[] = (int) Db::table('finance_merchant_settle')->insertGetId([
            'settle_no' => 'EARN-SETTLE-' . bin2hex(random_bytes(6)), 'site_id' => 991,
            'merchant_id' => $merchantId, 'property_id' => $propertyId,
            'settle_cycle' => date('Y-m'), 'order_count' => 1, 'order_amount' => $amount,
            'settle_amount' => $amount, 'status' => 0,
        ]);
    }
    $legacySettleId = $settleIds[] = (int) Db::table('finance_merchant_settle')->insertGetId([
        'settle_no' => 'EARN-LEGACY-' . bin2hex(random_bytes(6)), 'site_id' => 991,
        'merchant_id' => $merchantId, 'property_id' => 0,
        'settle_cycle' => date('Y-m', strtotime('-1 month')), 'order_count' => 2,
        'order_amount' => 999, 'settle_amount' => 999, 'status' => 0,
    ]);

    MerchantContext::set([
        'admin_id' => 99101, 'site_id' => 991, 'account_type' => 2, 'merchant_id' => $merchantId,
        'is_owner' => false, 'property_ids' => $propertyIds, 'selected_property_id' => $propertyIds[0],
    ]);
    $overview = earningsCall('overview')['data'];
    check($overview['bookingVolume'] === 1 && $overview['grossRevenue'] === 100.0,
        'E selected property narrows earnings entries');
    $settles = earningsCall('settleList')['data'];
    check($settles['total'] === 1 && (int) $settles['list'][0]['property_id'] === $propertyIds[0],
        'E selected property narrows settlement list');
    $detail = earningsCall('settleDetail', ['id' => $settleIds[0]])['data'];
    check(count($detail['entries']) === 1 && (int) $detail['entries'][0]['property_id'] === $propertyIds[0],
        'E settlement detail contains only the same property entries');
    rejects(40302, fn () => earningsCall('settleDetail', ['id' => $settleIds[1]]),
        'E selected property cannot read another property settlement');
    rejects(40302, fn () => earningsCall('settleDetail', ['id' => $legacySettleId]),
        'E selected property cannot read an unattributed legacy settlement');

    MerchantContext::set([
        'admin_id' => 99101, 'site_id' => 991, 'account_type' => 2, 'merchant_id' => $merchantId,
        'is_owner' => true, 'property_ids' => $propertyIds, 'selected_property_id' => 0,
    ]);
    check(earningsCall('settleList')['data']['total'] === 2,
        'E all-properties earnings aggregates attributed properties and hides legacy merchant totals');
} finally {
    if ($settleIds) Db::table('finance_merchant_settle')->whereIn('id', $settleIds)->delete();
    if ($entryIds) Db::table('finance_account_entry')->whereIn('id', $entryIds)->delete();
    if ($orderIds) Db::table('order_main')->whereIn('id', $orderIds)->delete();
    if ($propertyIds) Db::table('merchant_store')->whereIn('id', $propertyIds)->delete();
    if ($merchantIds) Db::table('merchant_info')->whereIn('id', $merchantIds)->delete();
}

echo "Property earnings integration complete\n";
