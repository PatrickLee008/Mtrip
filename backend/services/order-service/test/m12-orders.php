<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\App\OrderController;
use App\Controller\App\TripController;
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
try {
    $a = $ids[] = merchantFixture();
    $b = $ids[] = merchantFixture();
    $input = [];
    foreach ([$a, $b] as $merchantId) {
        $goodsId = $goodsIds[] = (int) Db::table('goods_info')->insertGetId(['site_id' => 991, 'merchant_id' => $merchantId, 'goods_name' => 'M12 Hotel', 'goods_type' => 1, 'status' => 3]);
        $skuId = (int) Db::table('hotel_room_type')->insertGetId(['site_id' => 991, 'goods_id' => $goodsId, 'room_name' => 'M12 Room', 'base_price' => 100, 'base_stock' => 50, 'status' => 1]);
        $input[] = ['goodsId' => $goodsId, 'skuId' => $skuId, 'quantity' => 1, 'useDate' => gmdate('Y-m-d'), 'endDate' => gmdate('Y-m-d', time() + 86400), 'contactName' => 'Fixture', 'contactPhone' => '10000000000'];
    }
    $order = invokeOrder(OrderController::class, 'create', $input[0]);
    check($order['code'] === 0 && $order['data']['priceDetail']['payAmount'] == 100, 'T17 single hotel creation and price');
    $unpaidId = $order['data']['orderId'];
    $paid = invokeOrder(OrderController::class, 'create', $input[0]);
    invokeOrder(OrderController::class, 'pay', ['orderId' => $paid['data']['orderId']]);
    $trip = invokeOrder(TripController::class, 'create', ['items' => $input]);
    check($trip['code'] === 0 && $trip['data']['payAmount'] == 200, 'T19 normal two-hotel Trip');
    $paidTrip = invokeOrder(TripController::class, 'create', ['items' => $input]);
    invokeOrder(TripController::class, 'pay', ['tripId' => $paidTrip['data']['tripId']]);
    check(Db::table('order_main')->where('trip_id', $paidTrip['data']['tripId'])->where('order_status', 1)->count() === 2, 'normal Trip payment confirms both bookings');
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
    MerchantContext::set(['site_id' => 991, 'account_type' => 3, 'merchant_id' => $a, 'store_id' => 1]);
    rejects(40302, fn () => invokeOrder(App\Controller\Merchant\OrderController::class, 'detail', ['id' => $paid['data']['orderId']]), 'T28 no store attribution means no store detail access');
    check(invokeOrder(App\Controller\Merchant\OrderController::class, 'index', [])['data']['total'] === 0, 'T28 no unscoped store order list');
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
        $ticket = invokeOrder(OrderController::class, 'create', array_replace($input[0], ['goodsId' => $ticketId, 'skuId' => $skuId]));
        invokeOrder(OrderController::class, 'pay', ['orderId' => $ticket['data']['orderId']]);
        check((int) Db::table('order_main')->where('id', $ticket['data']['orderId'])->value('order_type') === 2 && $ticket['data']['priceDetail']['payAmount'] == 25, 'T33 ticket price/type/payment unchanged');
    }
    echo "M12 ORDER INTEGRATION PASSED\n";
} finally {
    if (Db::transactionLevel() > 0) Db::rollBack();
    $orderIds = Db::table('order_main')->whereIn('goods_id', $goodsIds)->pluck('id')->all();
    $tripIds = Db::table('order_main')->whereIn('goods_id', $goodsIds)->where('trip_id', '>', 0)->pluck('trip_id')->all();
    foreach (['order_verify_log', 'finance_account_entry'] as $table) Db::table($table)->whereIn('order_id', $orderIds)->delete();
    foreach (['goods_daily_stock', 'goods_stock_log', 'hotel_room_type', 'ticket_type', 'order_main'] as $table) Db::table($table)->whereIn('goods_id', $goodsIds)->delete();
    Db::table('order_trip')->whereIn('id', $tripIds)->delete();
    Db::table('goods_info')->whereIn('id', $goodsIds)->delete();
    Db::table('merchant_blacklist')->whereIn('merchant_id', $ids)->delete();
    Db::table('merchant_info')->whereIn('id', $ids)->delete();
    Db::table('notify_record')->where('user_id', 99101)->delete();
}
