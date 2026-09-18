<?php

declare(strict_types=1);
require __DIR__ . '/RoomReviewBootstrap.php';

use App\Service\Booking\BookingLifecycleService;
use App\Service\Booking\BookingRefundService;
use App\Service\OrderStockService;
use Hyperf\DbConnection\Db;

$room = (array) Db::table('hotel_room_type')->where('site_id', 992)->whereNull('deleted_at')->first();
$id = (int) $room['id']; $propertyId = (int) $room['property_id'];
$room['base_stock'] = 8; $room['launch_stock'] = 3; $room['base_price'] = 1000; $room['weekend_price'] = 1200;
$stock = new OrderStockService();
Db::transaction(function () use ($stock, $id, $propertyId, $room) {
    [$price] = $stock->lock(992, $propertyId, 0, 1, $id, $room, ['2026-09-18'], 2);
    check($price === 2400.0, 'order uses weekend price for missing day');
    $day = (array) Db::table('goods_daily_stock')->where('sku_id', $id)->where('stock_date', '2026-09-18')->first();
    check((int) $day['stock_total'] === 3 && (int) $day['stock_locked'] === 2, 'order locks default sellable quota');
    rejects(40901, fn () => $stock->lock(992, $propertyId, 0, 1, $id, $room, ['2026-09-18'], 2), 'cannot sell physical rooms beyond configured quota');
});
Db::table('goods_daily_stock')->where('sku_id', $id)->where('stock_date', '2026-09-18')->update(['stock_total' => 8, 'price' => 888]);
Db::transaction(function () use ($stock, $id, $propertyId, $room) {
    [$price] = $stock->lock(992, $propertyId, 0, 1, $id, $room, ['2026-09-18'], 1);
    check($price === 888.0, 'order preserves explicit price override');
});
$ruleId = Db::table('goods_refund_rule')->insertGetId(['site_id' => 992, 'property_id' => $propertyId, 'sku_type' => 1, 'sku_id' => $id, 'rule_type' => 2, 'rules' => json_encode([['hours_before' => 48, 'refund_rate' => 100], ['hours_before' => 0, 'refund_rate' => 25]])]);
$lifecycle = new BookingLifecycleService(); $refund = new BookingRefundService();
$fields = $lifecycle->buildCreateFields(1, $propertyId, $id, '');
$order = ['id' => 9900001, 'pay_amount' => 1000, 'use_date' => date('Y-m-d', strtotime('+10 days')), 'cancellation_policy_snapshot' => $fields['cancellation_policy_snapshot']];
check(is_array(json_decode($order['cancellation_policy_snapshot'], true)['rules']), 'new order snapshot stores structured refund tiers');
check($refund->quote($order)['refundable'] === 1000.0, 'refund executes approved tier');
Db::table('goods_refund_rule')->where('id', $ruleId)->update(['rule_type' => 3]);
check($refund->quote($order)['refundable'] === 1000.0, 'policy change does not alter existing order snapshot');
$newOrder = array_replace($order, ['cancellation_policy_snapshot' => $lifecycle->buildCreateFields(1, $propertyId, $id, '')['cancellation_policy_snapshot']]);
check($refund->quote($newOrder)['refundable'] === 0.0, 'new order receives new non-refundable policy');
$legacy = json_decode($order['cancellation_policy_snapshot'], true); $legacy['rules'] = json_encode($legacy['rules']);
$order['cancellation_policy_snapshot'] = json_encode($legacy);
check($refund->quote($order)['refundable'] === 1000.0, 'legacy string tier snapshot still executes without rewriting order');
echo "Room order contract passed\n";
