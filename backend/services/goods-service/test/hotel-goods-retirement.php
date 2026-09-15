<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\AdminGoodsController;
use App\Controller\Admin\AdminSkuController;
use App\Controller\App\GoodsController as AppGoodsController;
use App\Controller\Merchant\GoodsController as MerchantGoodsController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Context\UserContext;

$database = 'mtrip_m12_s1_test';
$columnExists = static fn (string $table, string $column): bool => Db::table('information_schema.COLUMNS')
    ->where('TABLE_SCHEMA', $database)->where('TABLE_NAME', $table)->where('COLUMN_NAME', $column)->exists();

check(! $columnExists('hotel_room_type', 'goods_id'), 'G room type legacy goods column removed');
check(! $columnExists('hotel_room_type_revision', 'goods_id'), 'G room revision legacy goods column removed');
check(! $columnExists('ranking_listing', 'goods_id'), 'G ranking legacy goods column removed');
check(! $columnExists('ranking_listing', 'business_id'), 'G ranking duplicate business column removed');
check(Db::table('sys_menu')->whereIn('id', [1501, 150101, 150102])->count() === 0, 'G legacy hotel menus removed');

$requiredPerms = [
    'goods:ticket:add', 'goods:ticket:edit', 'goods:ticket:delete', 'goods:ticket:type',
    'goods:category:add', 'goods:category:edit', 'goods:category:delete',
    'goods:audit:audit', 'goods:audit:off',
];
check(Db::table('sys_menu')->whereIn('perm_key', $requiredPerms)->distinct()->count('perm_key') === count($requiredPerms),
    'G ticket write permissions match menu seed');

$merchantId = $propertyId = $roomTypeId = $ticketId = $ticketTypeId = $legacyHotelId = 0;
$key = 'g-retirement-' . bin2hex(random_bytes(4));
try {
    $merchantId = merchantFixture();
    $propertyId = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchantId, 'store_name' => $key . ' property',
        'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1, 'content_status' => 2,
        'content_approved_version' => 1,
        'publish_status' => 1, 'operating_status' => 1, 'display_enabled' => 1,
    ]);
    $roomTypeId = (int) Db::table('hotel_room_type')->insertGetId([
        'site_id' => 991, 'property_id' => $propertyId, 'room_name' => $key . ' room',
        'base_price' => 120, 'base_stock' => 5, 'status' => 1, 'publish_status' => 2, 'approved_version' => 1,
    ]);
    $ticketId = (int) Db::table('goods_info')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchantId, 'goods_name' => $key . ' ticket',
        'goods_type' => 2, 'status' => 3,
    ]);
    $ticketTypeId = (int) Db::table('ticket_type')->insertGetId([
        'site_id' => 991, 'goods_id' => $ticketId, 'ticket_name' => $key . ' admission',
        'base_price' => 20, 'base_stock' => 10, 'status' => 1,
    ]);
    // Direct SQL fixture proves every runtime list still excludes a legacy row if one appears after migration.
    $legacyHotelId = (int) Db::table('goods_info')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchantId, 'goods_name' => $key . ' legacy hotel',
        'goods_type' => 1, 'status' => 3,
    ]);

    AdminContext::set(['admin_id' => 99120, 'site_id' => 991, 'is_super' => false]);
    MerchantContext::set([
        'admin_id' => 99121, 'site_id' => 991, 'account_type' => 2,
        'merchant_id' => $merchantId, 'is_owner' => true,
    ]);
    UserContext::set(['user_id' => 99101, 'site_id' => 991]);

    setRequest(['goodsName' => $key]);
    $adminList = $container->get(AdminGoodsController::class)->index()['data'];
    check($adminList['total'] === 1 && (int) $adminList['list'][0]['id'] === $ticketId,
        'G admin goods list returns tickets only');

    setRequest(['goodsName' => $key]);
    $merchantList = $container->get(MerchantGoodsController::class)->index()['data'];
    check($merchantList['total'] === 1 && (int) $merchantList['list'][0]['id'] === $ticketId,
        'G merchant goods list returns tickets only');

    setRequest(['propertyId' => $propertyId]);
    $rooms = $container->get(AdminSkuController::class)->roomList()['data'];
    check(count($rooms) === 1 && (int) $rooms[0]['id'] === $roomTypeId && ! array_key_exists('goods_id', $rooms[0]),
        'G room selector uses propertyId without legacy key');
    setRequest(['goodsId' => $legacyHotelId]);
    rejects(40001, fn () => $container->get(AdminSkuController::class)->roomList(), 'G room selector rejects goodsId');

    setRequest(['goodsType' => 1, 'keyword' => $key]);
    rejects(40001, fn () => $container->get(AppGoodsController::class)->list(), 'G public goods list rejects hotel type');
    setRequest(['id' => $legacyHotelId]);
    rejects(40401, fn () => $container->get(AppGoodsController::class)->detail(), 'G public goods detail hides hotel rows');
    setRequest(['skuType' => 1, 'skuId' => $roomTypeId]);
    rejects(40001, fn () => $container->get(AppGoodsController::class)->calendar(), 'G public goods calendar rejects room type');

    setRequest(['goodsType' => 2, 'keyword' => $key]);
    $appList = $container->get(AppGoodsController::class)->list()['data'];
    check($appList['total'] === 1 && (int) $appList['list'][0]['id'] === $ticketId,
        'G public ticket list remains available');
    setRequest(['id' => $ticketId]);
    $detail = $container->get(AppGoodsController::class)->detail()['data'];
    check((int) $detail['id'] === $ticketId && (int) $detail['skus'][0]['id'] === $ticketTypeId,
        'G public ticket detail and ticket type remain available');
    setRequest(['skuType' => 2, 'skuId' => $ticketTypeId, 'days' => 1]);
    $calendar = $container->get(AppGoodsController::class)->calendar()['data'];
    check($calendar['skuType'] === 2 && $calendar['skuId'] === $ticketTypeId && count($calendar['calendar']) === 1,
        'G public ticket calendar remains available');

    AdminContext::set(['admin_id' => 99120, 'site_id' => 992, 'is_super' => false]);
    setRequest(['propertyId' => $propertyId]);
    rejects(40302, fn () => $container->get(AdminSkuController::class)->roomList(), 'G property room selector enforces site scope');
} finally {
    if ($ticketTypeId > 0) Db::table('ticket_type')->where('id', $ticketTypeId)->delete();
    if ($roomTypeId > 0) Db::table('hotel_room_type')->where('id', $roomTypeId)->delete();
    if ($ticketId > 0 || $legacyHotelId > 0) Db::table('goods_info')->whereIn('id', array_filter([$ticketId, $legacyHotelId]))->delete();
    if ($propertyId > 0) Db::table('merchant_store')->where('id', $propertyId)->delete();
    if ($merchantId > 0) Db::table('merchant_info')->where('id', $merchantId)->delete();
    MerchantContext::set([]);
}
