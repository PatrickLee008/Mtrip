<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Merchant\NotificationController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\MerchantContext;

$merchants = $properties = $orders = $notifications = [];
try {
    $merchantId = $merchants[] = merchantFixture();
    foreach (['Allowed property', 'Blocked property'] as $name) {
        $properties[] = (int) Db::table('merchant_store')->insertGetId([
            'site_id' => 991,
            'merchant_id' => $merchantId,
            'store_name' => $name,
            'business_type' => 'hotel',
            'status' => 1,
            'operating_status' => 1,
        ]);
    }
    $propertyColumn = Db::selectOne("SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_notify' AND COLUMN_NAME='property_id'");
    check((int) ($propertyColumn->cnt ?? 0) === 1, 'booking notifications have property scope column');

    foreach ([[$properties[0], 'Allowed booking'], [$properties[1], 'Blocked booking'], [null, 'Merchant-wide notice']] as [$propertyId, $title]) {
        $notifications[] = (int) Db::table('merchant_notify')->insertGetId([
            'site_id' => 991,
            'merchant_id' => $merchantId,
            'property_id' => $propertyId,
            'category' => $propertyId === null ? 'system' : 'booking',
            'title' => $title,
            'message' => $title,
            'deep_link_type' => 'none',
            'deep_link_value' => '',
            'channels' => 'inapp',
            'send_type' => 1,
            'send_at' => gmdate('Y-m-d H:i:s'),
            'status' => 1,
        ]);
    }
    MerchantContext::set([
        'admin_id' => 991001,
        'site_id' => 991,
        'merchant_id' => $merchantId,
        'account_type' => 2,
        'is_owner' => false,
        'property_ids' => [$properties[0]],
        'selected_property_id' => 0,
    ]);
    setRequest(['page' => 1, 'pageSize' => 20]);
    $result = $container->get(NotificationController::class)->index();
    $titles = array_column($result['data']['list'], 'title');
    check(in_array('Allowed booking', $titles, true), 'employee sees booking notifications for authorized property');
    check(in_array('Merchant-wide notice', $titles, true), 'employee keeps merchant-wide notifications');
    check(! in_array('Blocked booking', $titles, true), 'employee cannot see booking notifications for unauthorized property');

    MerchantContext::set(array_replace(MerchantContext::get(), [
        'account_type' => 3,
        'store_id' => $properties[0],
        'property_ids' => [$properties[0]],
    ]));
    setRequest(['page' => 1, 'pageSize' => 20]);
    $propertyTitles = array_column($container->get(NotificationController::class)->index()['data']['list'], 'title');
    check(in_array('Allowed booking', $propertyTitles, true) && ! in_array('Blocked booking', $propertyTitles, true),
        'property account receives only its booking notifications');
} finally {
    MerchantContext::set([]);
    if ($notifications !== []) {
        Db::table('merchant_notify_read')->whereIn('notify_id', $notifications)->delete();
        Db::table('merchant_notify_delivery')->whereIn('notify_id', $notifications)->delete();
        Db::table('merchant_notify')->whereIn('id', $notifications)->delete();
    }
    if ($orders !== []) Db::table('order_main')->whereIn('id', $orders)->delete();
    if ($properties !== []) Db::table('merchant_store')->whereIn('id', $properties)->delete();
    if ($merchants !== []) Db::table('merchant_info')->whereIn('id', $merchants)->delete();
}

echo "Booking notification scope contract passed\n";
