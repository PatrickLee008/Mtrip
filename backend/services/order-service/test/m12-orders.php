<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\App\OrderController;
use App\Controller\App\TripController;
use App\Controller\Merchant\BookingController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Context\UserContext;

UserContext::set(['user_id' => 99101, 'site_id' => 991]);
Db::statement('SET SESSION innodb_lock_wait_timeout=5');
function invokeOrder(string $class, string $method, array $input): array
{
    global $container;
    setRequest($input);
    return $container->get($class)->{$method}();
}
function startWorker(string $mode, array $payload): mixed
{
    $process = proc_open([PHP_BINARY, '-d', 'display_errors=1', __FILE__, $mode, json_encode($payload)], [0 => ['pipe', 'r'], 1 => STDOUT, 2 => STDERR], $pipes);
    fclose($pipes[0]);
    return $process;
}
if (($argv[1] ?? '') === '--trip') {
    invokeOrder(TripController::class, 'create', json_decode($argv[2], true));
    exit(0);
}
if (($argv[1] ?? '') === '--blocked-create') {
    rejects(40901, fn () => invokeOrder(OrderController::class, 'create', json_decode($argv[2], true)), 'T21 concurrent suspension prevents creation');
    exit(0);
}
$ids = [];
$goodsIds = [];
$propertyIds = [];
$roomIds = [];
try {
    $a = $ids[] = merchantFixture();
    $b = $ids[] = merchantFixture();
    $input = [];
    foreach ([$a, $b] as $merchantId) {
        $propertyId = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
            'site_id' => 991, 'merchant_id' => $merchantId, 'store_name' => 'M12 Property',
            'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1, 'content_status' => 2,
            'publish_status' => 1, 'operating_status' => 1,
        ]);
        $roomTypeId = $roomIds[] = (int) Db::table('hotel_room_type')->insertGetId([
            'site_id' => 991, 'property_id' => $propertyId, 'room_name' => 'M12 Room',
            'base_price' => 100, 'base_stock' => 50, 'status' => 1, 'publish_status' => 2,
        ]);
        $input[] = ['propertyId' => $propertyId, 'roomTypeId' => $roomTypeId, 'quantity' => 1,
            'useDate' => gmdate('Y-m-d'), 'endDate' => gmdate('Y-m-d', time() + 86400),
            'contactName' => 'Fixture', 'contactPhone' => '10000000000'];
    }
    $order = invokeOrder(OrderController::class, 'create', $input[0]);
    check($order['code'] === 0 && $order['data']['priceDetail']['payAmount'] == 100, 'T17 single hotel creation and price');
    $unpaidId = $order['data']['orderId'];
    $paid = invokeOrder(OrderController::class, 'create', $input[0]);
    invokeOrder(OrderController::class, 'pay', ['orderId' => $paid['data']['orderId']]);
    $paidRow = (array) Db::table('order_main')->where('id', $paid['data']['orderId'])->first();
    check((int) $paidRow['property_id'] === $propertyIds[0] && (int) $paidRow['room_type_id'] === $roomIds[0]
        && (int) $paidRow['goods_id'] === 0 && (int) $paidRow['sku_id'] === 0,
        'E hotel order writes property/room keys and clears legacy keys');
    $entry = (array) Db::table('finance_account_entry')->where('order_id', $paid['data']['orderId'])->first();
    check((int) $entry['property_id'] === $propertyIds[0] && (int) $entry['room_type_id'] === $roomIds[0],
        'E hotel settlement entry keeps property/room attribution');
    check(Db::table('goods_stock_log')->where('order_id', $paid['data']['orderId'])
        ->where('property_id', $propertyIds[0])->where('goods_id', 0)->exists(),
        'E hotel stock log keeps property attribution and clears goods key');
    $trip = invokeOrder(TripController::class, 'create', ['items' => $input]);
    check($trip['code'] === 0 && $trip['data']['payAmount'] == 200, 'T19 normal two-hotel Trip');
    $paidTrip = invokeOrder(TripController::class, 'create', ['items' => $input]);
    invokeOrder(TripController::class, 'pay', ['tripId' => $paidTrip['data']['tripId']]);
    check(Db::table('order_main')->where('trip_id', $paidTrip['data']['tripId'])->where('order_status', 1)->count() === 2, 'normal Trip payment confirms both bookings');
    check(Db::table('order_main')->where('trip_id', $paidTrip['data']['tripId'])->where('goods_id', 0)
        ->where('sku_id', 0)->where('property_id', '>', 0)->where('room_type_id', '>', 0)->count() === 2,
        'E Trip hotel legs use property/room keys only');

    $legacyGoods = $goodsIds[] = (int) Db::table('goods_info')->insertGetId([
        'site_id' => 991, 'merchant_id' => $a, 'goods_name' => 'M12 Legacy Hotel', 'goods_type' => 1, 'status' => 3,
    ]);
    $legacyRoom = $roomIds[] = (int) Db::table('hotel_room_type')->insertGetId([
        'site_id' => 991, 'property_id' => $propertyIds[0],
        'room_name' => 'M12 Legacy Room', 'base_price' => 80, 'base_stock' => 10, 'status' => 1, 'publish_status' => 2,
    ]);
    rejects(40901, fn () => invokeOrder(OrderController::class, 'create', array_replace($input[0], [
        'propertyId' => 0, 'roomTypeId' => 0, 'goodsId' => $legacyGoods, 'skuId' => $legacyRoom,
    ])), 'G hotel ordering rejects legacy goodsId/skuId input');
    foreach (['suspended', 'blacklisted'] as $state) {
        Db::table('merchant_info')->where('id', $a)->update(['status' => 4]);
        if ($state === 'blacklisted') Db::table('merchant_blacklist')->insert(['site_id' => 991, 'merchant_id' => $a, 'reason' => 'M12 test', 'status' => 1]);
        $before = [Db::table('order_main')->count(), Db::table('order_trip')->count(), Db::table('goods_daily_stock')->sum('stock_locked'), Db::table('goods_stock_log')->count()];
        rejects(40901, fn () => invokeOrder(OrderController::class, 'create', $input[0]), 'T18 single blocked ' . $state);
        rejects(40901, fn () => invokeOrder(TripController::class, 'create', ['items' => array_reverse($input)]), 'T19 whole Trip blocked ' . $state);
        rejects(40901, fn () => invokeOrder(OrderController::class, 'pay', ['orderId' => $unpaidId]), 'T23 unpaid single payment blocked ' . $state);
        rejects(40901, fn () => invokeOrder(TripController::class, 'pay', ['tripId' => $trip['data']['tripId']]), 'T23 unpaid Trip payment blocked ' . $state);
        check($before == [Db::table('order_main')->count(), Db::table('order_trip')->count(), Db::table('goods_daily_stock')->sum('stock_locked'), Db::table('goods_stock_log')->count()], 'T18/T19/T23 no partial writes ' . $state);
        check((int) Db::table('order_main')->where('id', $paid['data']['orderId'])->value('order_status') === 1, 'T22 confirmed booking unchanged ' . $state);
        Db::table('merchant_blacklist')->where('merchant_id', $a)->delete();
    }
    MerchantContext::set(['admin_id' => 901, 'site_id' => 991, 'account_type' => 2, 'merchant_id' => $a, 'is_owner' => true]);
    AdminContext::set(['admin_id' => 901, 'site_id' => 991, 'permissions' => ['mch:order:verify']]);
    $detail = invokeOrder(App\Controller\Merchant\OrderController::class, 'detail', ['id' => $paid['data']['orderId']]);
    check($detail['code'] === 0, 'T22 suspended merchant reads confirmed order');
    invokeOrder(App\Controller\Merchant\OrderController::class, 'verify', ['id' => $paid['data']['orderId']]);
    check((int) Db::table('order_main')->where('id', $paid['data']['orderId'])->value('order_status') === 2, 'T22 suspended merchant fulfills confirmed order');
    $otherPropertyOrderId = (int) Db::table('order_main')->where('trip_id', $paidTrip['data']['tripId'])
        ->where('property_id', $propertyIds[1])->value('id');
    MerchantContext::set(['site_id' => 991, 'account_type' => 3, 'merchant_id' => $a, 'store_id' => $propertyIds[0]]);
    check(invokeOrder(App\Controller\Merchant\OrderController::class, 'detail', ['id' => $paid['data']['orderId']])['code'] === 0,
        'E property account can access its hotel order');
    rejects(40302, fn () => invokeOrder(App\Controller\Merchant\OrderController::class, 'detail', ['id' => $otherPropertyOrderId]),
        'E property account cannot access another property order');
    check(invokeOrder(App\Controller\Merchant\OrderController::class, 'index', [])['data']['total'] > 0,
        'E property account list includes its attributed hotel orders');
    MerchantContext::set([
        'admin_id' => 902, 'site_id' => 991, 'account_type' => 2, 'merchant_id' => $a,
        'is_owner' => false, 'property_ids' => [$propertyIds[0], $propertyIds[1]],
        'selected_property_id' => $propertyIds[0],
        'permissions' => ['mch:order:list', 'mch:order:detail'],
    ]);
    AdminContext::set(['admin_id' => 902, 'site_id' => 991, 'permissions' => ['mch:order:list', 'mch:order:detail']]);
    $selectedBookings = invokeOrder(BookingController::class, 'index', [])['data'];
    check($selectedBookings['total'] > 0
        && count(array_unique(array_column($selectedBookings['list'], 'property_id'))) === 1
        && (int) $selectedBookings['list'][0]['property_id'] === $propertyIds[0],
        'E employee selected-property booking list is isolated');
    rejects(40401, fn () => invokeOrder(BookingController::class, 'detail', ['id' => $otherPropertyOrderId]),
        'E employee selected-property booking detail hides another property');
    MerchantContext::set([]);
    Db::table('merchant_info')->where('id', $a)->update(['status' => 3]);
    $workers = [startWorker('--trip', ['items' => $input]), startWorker('--trip', ['items' => array_reverse($input)])];
    foreach ($workers as $worker) check(proc_close($worker) === 0, 'T20 opposite-order Trip processes complete');
    Db::beginTransaction();
    Db::table('merchant_info')->where('id', $a)->lockForUpdate()->first();
    $worker = startWorker('--blocked-create', $input[0]);
    usleep(200000);
    Db::table('merchant_info')->where('id', $a)->update(['status' => 4]);
    Db::commit();
    check(proc_close($worker) === 0, 'T21 suspension wins merchant row lock');
    // 既有门票数值2保留；同时覆盖有商户与独立供应商两条归属路径。
    foreach ([$b, 0] as $merchantId) {
        $ticketId = $goodsIds[] = (int) Db::table('goods_info')->insertGetId(['site_id' => 991, 'merchant_id' => $merchantId, 'supplier_id' => 991, 'goods_type' => 2, 'goods_name' => 'M12 Ticket', 'status' => 3]);
        $skuId = (int) Db::table('ticket_type')->insertGetId(['site_id' => 991, 'goods_id' => $ticketId, 'ticket_name' => 'M12 Admission', 'base_price' => 25, 'base_stock' => 20, 'status' => 1]);
        $ticket = invokeOrder(OrderController::class, 'create', [
            'goodsId' => $ticketId, 'skuId' => $skuId, 'quantity' => 1,
            'useDate' => gmdate('Y-m-d'), 'contactName' => 'Fixture', 'contactPhone' => '10000000000',
        ]);
        invokeOrder(OrderController::class, 'pay', ['orderId' => $ticket['data']['orderId']]);
        $ticketRow = (array) Db::table('order_main')->where('id', $ticket['data']['orderId'])->first();
        check((int) $ticketRow['order_type'] === 2 && $ticket['data']['priceDetail']['payAmount'] == 25
            && (int) $ticketRow['goods_id'] === $ticketId && (int) $ticketRow['sku_id'] === $skuId
            && (int) $ticketRow['property_id'] === 0 && (int) $ticketRow['room_type_id'] === 0,
            'T33 ticket price/type/payment and goods keys unchanged');
    }
    echo "M12 ORDER INTEGRATION PASSED\n";
} finally {
    if (Db::transactionLevel() > 0) Db::rollBack();
    $orderIds = Db::table('order_main')->where(function ($query) use ($goodsIds, $propertyIds) {
        $query->whereIn('goods_id', $goodsIds)->orWhereIn('property_id', $propertyIds);
    })->pluck('id')->all();
    $tripIds = Db::table('order_main')->whereIn('id', $orderIds)->where('trip_id', '>', 0)->pluck('trip_id')->all();
    foreach (['order_verify_log', 'finance_account_entry'] as $table) Db::table($table)->whereIn('order_id', $orderIds)->delete();
    Db::table('goods_stock_log')->whereIn('order_id', $orderIds)->delete();
    Db::table('goods_daily_stock')->whereIn('property_id', $propertyIds)->delete();
    Db::table('goods_daily_stock')->whereIn('goods_id', $goodsIds)->delete();
    Db::table('order_main')->whereIn('id', $orderIds)->delete();
    Db::table('hotel_room_type')->whereIn('id', $roomIds)->delete();
    Db::table('ticket_type')->whereIn('goods_id', $goodsIds)->delete();
    Db::table('order_trip')->whereIn('id', $tripIds)->delete();
    Db::table('goods_info')->whereIn('id', $goodsIds)->delete();
    Db::table('merchant_store')->whereIn('id', $propertyIds)->delete();
    Db::table('merchant_blacklist')->whereIn('merchant_id', $ids)->delete();
    Db::table('merchant_info')->whereIn('id', $ids)->delete();
    Db::table('notify_record')->where('user_id', 99101)->delete();
}
