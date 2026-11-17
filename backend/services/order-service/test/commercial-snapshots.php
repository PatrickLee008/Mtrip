<?php

declare(strict_types=1);

require '/tmp/M12CommercialBootstrap.php';
require '/tmp/CommercialPaymentResultHandler.php';
require '/tmp/CommercialBookingLifecycleService.php';
require '/tmp/CommercialOrderController.php';

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Merchant\MerchantCommercialSettings;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\UserContext;
use App\Constants\BookingConst;

$handler = $container->get(App\Service\CommercialPaymentResultHandler::class);
$lifecycle = $container->get(App\Service\Booking\CommercialBookingLifecycleService::class);
// Renamed classes deliberately bypass stale resident scan caches; inject real collaborators explicitly.
(new ReflectionProperty($handler, 'events'))->setValue($handler, new App\Service\Booking\BookingEventService());
(new ReflectionProperty($lifecycle, 'events'))->setValue($lifecycle, new App\Service\Booking\BookingEventService());
(new ReflectionProperty($lifecycle, 'stockService'))->setValue($lifecycle, new App\Service\OrderStockService());
$merchantId = (int) Db::table('merchant_info')->orderBy('id')->value('id');
function snapshotOrder(array $extra = []): array {
    global $merchantId;
    $id = Db::table('order_main')->insertGetId(array_replace([
        'order_no' => 'COMM-' . bin2hex(random_bytes(8)), 'site_id' => 991, 'user_id' => 902, 'order_type' => 1,
        'merchant_id' => $merchantId, 'goods_name' => 'Synthetic snapshot hotel', 'sku_name' => 'Room', 'quantity' => 1,
        'unit_price' => 100000, 'total_amount' => 100000, 'pay_amount' => 100000,
        'contact_name' => 'Fixture', 'contact_phone' => '', 'guests' => '',
        'order_status' => 0, 'booking_status' => 1, 'payment_status' => 1, 'booking_channel' => 'mtrip',
        'use_date' => '2098-01-01', 'end_date' => '2098-01-02',
    ], $extra));
    return (array) Db::table('order_main')->where('id', $id)->first();
}
function paidSnapshot(array $order): string {
    global $handler;
    Db::transaction(function () use ($order, $handler) { $handler->markPaid($order, 3, 'synthetic-trade', 'SNAPCODE'); });
    return (string) Db::table('order_main')->where('id', $order['id'])->value('merchant_commercial_snapshot');
}
$order = snapshotOrder();
$frozen = paidSnapshot($order);
$snapshot = json_decode($frozen, true);
check(is_array($snapshot) && $snapshot['version'] === 4 && $snapshot['commission_rate'] === '9.00', 'first payment confirmation freezes effective terms, excluding future schedule');
check($snapshot['merchant_id'] === $merchantId && $snapshot['site_id'] === 991 && isset($snapshot['captured_at']), 'snapshot records merchant site and capture time');
check(! array_key_exists('reason', $snapshot) && ! array_key_exists('created_by_name', $snapshot), 'snapshot excludes administrator audit identity and reason');
check($snapshot['transaction_fee_rate'] === '2.00' && $snapshot['merchant_upfront_rate'] === '20.00' && $snapshot['no_show_fee_enabled'] === true, 'snapshot retains all operative commercial terms');
AdminContext::set(['admin_id' => 902, 'admin_name' => 'Snapshot tester', 'site_id' => 991, 'is_super' => true]);
MerchantCommercialSettings::save($merchantId, [
    'expectedVersion' => 4, 'commissionPlan' => 'standard', 'commissionRate' => '10', 'transactionFeeRate' => '3',
    'payAtHotelEnabled' => false, 'noShowFeeEnabled' => false, 'merchantUpfrontRate' => '0',
    'effectiveAt' => '2021-01-01T00:00:00Z', 'reason' => 'Later contract', 'requestId' => 'snapshot-later',
]);
$confirmed = (array) Db::table('order_main')->where('id', $order['id'])->first();
check(paidSnapshot($confirmed) === $frozen, 'already-confirmed payment retry preserves original snapshot');
$preexisting = snapshotOrder(['merchant_commercial_snapshot' => '{"version":99}']);
check(json_decode(paidSnapshot($preexisting), true)['version'] === 99, 'first confirmation preserves already set snapshot');
$legacy = snapshotOrder(['order_status' => 1, 'booking_status' => 2]);
paidSnapshot($legacy);
check(Db::table('order_main')->where('id', $legacy['id'])->value('merchant_commercial_snapshot') === null, 'already-confirmed legacy rows are never backfilled');
$late = snapshotOrder(['order_status' => 4, 'booking_status' => 5]);
Db::table('order_booking_event')->insert(['order_id' => $late['id'], 'site_id' => 991, 'merchant_id' => $merchantId, 'order_no' => $late['order_no'], 'event_type' => 'payment_expired', 'operator_type' => 0]);
Db::transaction(fn () => $handler->markPaidAfterExpiry($late, 5, 'synthetic-late', 'LATECODE'));
$lateSnapshot = json_decode(Db::table('order_main')->where('id', $late['id'])->value('merchant_commercial_snapshot'), true);
check($lateSnapshot['version'] === 5 && $lateSnapshot['pay_at_hotel_enabled'] === false, 'late recovery freezes terms effective at recovery confirmation');
$manual = snapshotOrder(['booking_channel' => 'phone']);
$manualResult = $lifecycle->confirm((int) $manual['id'], 902, 'Fixture');
check(json_decode($manualResult['merchant_commercial_snapshot'], true)['version'] === 5, 'manual hotel confirmation freezes same shared commercial terms');
check($lifecycle->confirm((int) $manual['id'], 902, 'Fixture')['merchant_commercial_snapshot'] === $manualResult['merchant_commercial_snapshot'], 'manual confirmation retry preserves snapshot');
$nullPlanMerchant = merchantFixture();
$baseline = snapshotOrder(['merchant_id' => $nullPlanMerchant]);
$baselineTerms = json_decode(paidSnapshot($baseline), true);
check($baselineTerms['version'] === 0 && $baselineTerms['commission_plan'] === null, 'legacy baseline snapshot preserves null commission plan');
$wrongSite = snapshotOrder(['site_id' => 992]);
rejects(40901, fn () => paidSnapshot($wrongSite), 'cross-site merchant snapshot rejected');
check((int) Db::table('order_main')->where('id', $wrongSite['id'])->value('booking_status') === 1, 'snapshot failure rolls back payment confirmation transition');
$ticket = snapshotOrder(['order_type' => 2]);
paidSnapshot($ticket);
check(Db::table('order_main')->where('id', $ticket['id'])->value('merchant_commercial_snapshot') === null, 'non-hotel payment confirmation has no hotel terms snapshot');
UserContext::set(['user_id' => 902, 'site_id' => 991]);
setRequest(['orderId' => $order['id']]);
$detail = $container->get(App\Controller\App\CommercialOrderController::class)->detail()['data'];
check(! array_key_exists('merchant_commercial_snapshot', $detail) && $detail['id'] === $order['id'], 'App detail does not expose internal commercial snapshot');
check((float) $detail['pay_amount'] === 100000.0, 'commercial snapshots leave original payment amount unchanged');
// Deterministic two-process/two-connection barrier: establish RR read view first,
// commit an effective revision on connection B, then confirm on connection A.
$raceOrder = snapshotOrder();
$writer = <<<'WRITER'
<?php
require '/tmp/M12CommercialBootstrap.php';
Mtrip\Shared\Context\AdminContext::set(['admin_id' => 902, 'admin_name' => 'Concurrent writer', 'site_id' => 991, 'is_super' => true]);
$result = Mtrip\Shared\Merchant\MerchantCommercialSettings::save((int) $argv[1], [
    'expectedVersion' => 5, 'commissionPlan' => 'standard', 'commissionRate' => '11', 'transactionFeeRate' => '3',
    'payAtHotelEnabled' => false, 'noShowFeeEnabled' => false, 'merchantUpfrontRate' => '0',
    'effectiveAt' => '2022-01-01T00:00:00Z', 'reason' => 'Committed between read-view and confirmation', 'requestId' => 'concurrent-confirm',
]);
echo json_encode(['version' => $result['current']['version']]);
WRITER;
file_put_contents('/tmp/commercial-concurrent-save.php', $writer);
Db::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
Db::beginTransaction();
try {
    check((int) Db::table('merchant_info')->where('id', $merchantId)->value('commercial_version') === 5, 'reader establishes pre-save repeatable-read snapshot');
    exec(escapeshellarg(PHP_BINARY) . ' /tmp/commercial-concurrent-save.php ' . $merchantId, $writerOutput, $writerCode);
    check($writerCode === 0 && json_decode(implode("\n", $writerOutput), true)['version'] === 6, 'independent writer commits new effective version before confirmation');
    check((int) Db::table('merchant_info')->where('id', $merchantId)->value('commercial_version') === 5, 'reader remains on old consistent view before real handler');
    $locked = (array) Db::table('order_main')->where('id', $raceOrder['id'])->lockForUpdate()->first();
    $handler->markPaid($locked, 3, 'concurrent-trade', 'RACECODE');
    $frozenCurrent = json_decode(Db::table('order_main')->where('id', $raceOrder['id'])->lockForUpdate()->value('merchant_commercial_snapshot'), true);
    check($frozenCurrent['version'] === 6 && $frozenCurrent['commission_rate'] === '11.00'
        && $frozenCurrent['effective_at'] === '2022-01-01 00:00:00', 'real confirmation ignores old read view and freezes newly committed effective terms');
    Db::commit();
} catch (Throwable $e) {
    Db::rollBack();
    throw $e;
} finally {
    unlink('/tmp/commercial-concurrent-save.php');
}
echo "Commercial order snapshot integration passed.\n";
