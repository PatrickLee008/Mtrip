<?php

declare(strict_types=1);

/**
 * 取消 / 全额退款返还优惠券(PricingService::releaseCoupon 及其三个调用点)。
 * 只在隔离库运行:scripts/test-coupon-release.sh 克隆表结构后注入本文件。
 */

require __DIR__ . '/M12Bootstrap.php';

use App\Constants\BookingConst;
use App\Controller\Admin\AdminRefundController;
use App\Service\Booking\BookingLifecycleService;
use App\Service\Booking\BookingRefundService;
use App\Service\PricingService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;

$failures = [];
function contract(bool $condition, string $name, string $detail = ''): void
{
    global $failures;
    if ($condition) {
        echo "PASS: {$name}\n";
        return;
    }
    $failures[] = $name;
    echo "FAIL: {$name}" . ($detail !== '' ? " :: {$detail}" : '') . "\n";
}

const SITE = 991;
const USER = 99101;

$merchantId = merchantFixture();
$propertyId = (int) Db::table('merchant_store')->insertGetId([
    'site_id' => SITE, 'merchant_id' => $merchantId, 'store_name' => 'Coupon release property',
    'business_type' => 'hotel', 'status' => 1, 'operating_status' => 1,
]);
$roomTypeId = (int) Db::table('hotel_room_type')->insertGetId([
    'site_id' => SITE, 'property_id' => $propertyId, 'room_name' => 'Coupon release room',
    'base_price' => 1000, 'base_stock' => 10, 'launch_stock' => 10, 'status' => 1, 'publish_status' => 2,
]);
Db::table('user_info')->insert(['id' => USER, 'site_id' => SITE, 'nickname' => 'coupon-release', 'balance' => 0]);
$couponId = (int) Db::table('marketing_coupon')->insertGetId([
    'site_id' => SITE, 'coupon_name' => 'Coupon release fixture', 'used_count' => 0,
]);

/** 已核销的领券记录:owner = 独立单的订单 ID 或 Trip ID */
function receive(int $couponId, string $validEnd = '2099-12-31 23:59:59'): int
{
    Db::table('marketing_coupon')->where('id', $couponId)->increment('used_count');
    return (int) Db::table('marketing_coupon_receive')->insertGetId([
        'site_id' => SITE, 'coupon_id' => $couponId, 'user_id' => USER,
        'coupon_code' => 'CR' . bin2hex(random_bytes(6)), 'status' => 1,
        'valid_end' => $validEnd, 'used_time' => date('Y-m-d H:i:s'),
    ]);
}

/** 已支付、已确认的酒店预订 */
function paidOrder(int $receiveId, int $tripId = 0, float $pay = 1000): int
{
    global $merchantId, $propertyId, $roomTypeId;
    return (int) Db::table('order_main')->insertGetId([
        'order_no' => 'CR' . bin2hex(random_bytes(8)), 'site_id' => SITE, 'user_id' => USER, 'order_type' => 1,
        'trip_id' => $tripId, 'merchant_id' => $merchantId, 'property_id' => $propertyId, 'room_type_id' => $roomTypeId,
        'goods_name' => 'Coupon release hotel', 'sku_name' => 'Coupon release room', 'quantity' => 1,
        'unit_price' => $pay, 'original_price' => $pay, 'total_amount' => $pay + 100, 'pay_amount' => $pay,
        'coupon_id' => $receiveId, 'coupon_discount' => 100, 'alloc_coupon_discount' => 100,
        'contact_name' => 'QA', 'contact_phone' => '', 'order_status' => 1,
        'booking_status' => BookingConst::STATUS_CONFIRMED, 'payment_status' => BookingConst::PAY_PAID, 'pay_method' => 3,
        'use_date' => date('Y-m-d', strtotime('+30 days')), 'end_date' => date('Y-m-d', strtotime('+31 days')),
    ]);
}

function bindOwner(int $receiveId, int $ownerId): void
{
    Db::table('marketing_coupon_receive')->where('id', $receiveId)->update(['order_id' => $ownerId]);
}

function rec(int $id): array
{
    return (array) Db::table('marketing_coupon_receive')->where('id', $id)->first(['status', 'order_id', 'used_time']);
}

function usedCount(int $couponId): int
{
    return (int) Db::table('marketing_coupon')->where('id', $couponId)->value('used_count');
}

$lifecycle = $container->get(BookingLifecycleService::class);
$refunds = $container->get(BookingRefundService::class);
$pricing = $container->get(PricingService::class);

// 1) 独立单:商户取消已支付预订 → 券回到未使用,模板已用数 -1
$r1 = receive($couponId);
$o1 = paidOrder($r1);
bindOwner($r1, $o1);
$before = usedCount($couponId);
$lifecycle->cancel($o1, 991001, 'Fixture', 'merchant cancel', BookingConst::OPERATOR_MERCHANT);
$s = rec($r1);
contract((int) $s['status'] === 0 && (int) $s['order_id'] === 0 && $s['used_time'] === null,
    'paid booking cancel returns coupon to unused', json_encode($s));
contract(usedCount($couponId) === $before - 1, 'coupon used_count decremented on return');

// 2) 幂等:重复返还不动数据
$again = $pricing->releaseCoupon((array) Db::table('order_main')->where('id', $o1)->first());
contract($again === false && usedCount($couponId) === $before - 1, 'repeated release is a no-op');

// 3) Trip 两笔共用一张券:取消第一笔不返还,两笔都取消才返还
$tripId = (int) Db::table('order_trip')->insertGetId([
    'trip_no' => 'TR' . bin2hex(random_bytes(6)), 'site_id' => SITE, 'user_id' => USER, 'pay_status' => 1,
]);
$r3 = receive($couponId);
bindOwner($r3, $tripId);
$t1 = paidOrder($r3, $tripId);
$t2 = paidOrder($r3, $tripId);
$lifecycle->cancel($t1, 991001, 'Fixture', 'cancel first leg', BookingConst::OPERATOR_MERCHANT);
contract((int) rec($r3)['status'] === 1, 'trip coupon kept while another booking still uses it');
$lifecycle->cancel($t2, 991001, 'Fixture', 'cancel last leg', BookingConst::OPERATOR_MERCHANT);
contract((int) rec($r3)['status'] === 0, 'trip coupon returned after last booking cancelled');

// 4) 商户退款:部分退款不返还,全额退款返还
$r4 = receive($couponId);
$o4 = paidOrder($r4);
bindOwner($r4, $o4);
$refunds->apply((array) Db::table('order_main')->where('id', $o4)->first(), 991001, 'Fixture', 300.0, 'partial');
contract((int) rec($r4)['status'] === 1, 'partial merchant refund keeps coupon used');
$r5 = receive($couponId);
$o5 = paidOrder($r5);
bindOwner($r5, $o5);
$refunds->apply((array) Db::table('order_main')->where('id', $o5)->first(), 991001, 'Fixture', null, 'full');
contract((int) rec($r5)['status'] === 0 && (int) Db::table('order_main')->where('id', $o5)->value('order_status') === 6,
    'full merchant refund closes order and returns coupon');

// 5) 用户申请退款 → 平台确认到账(全额)→ 返还;券已过期则置为已过期
AdminContext::set(['admin_id' => 991001, 'admin_name' => 'Fixture', 'site_id' => SITE, 'permissions' => ['order:refund:audit']]);
$r6 = receive($couponId, '2020-01-01 00:00:00');
$o6 = paidOrder($r6);
bindOwner($r6, $o6);
Db::table('order_main')->where('id', $o6)->update(['order_status' => 5, 'refund_status' => 1]);
$refundId = (int) Db::table('order_refund')->insertGetId([
    'refund_no' => 'RF' . bin2hex(random_bytes(6)), 'site_id' => SITE, 'order_id' => $o6,
    'order_no' => (string) Db::table('order_main')->where('id', $o6)->value('order_no'),
    'user_id' => USER, 'merchant_id' => $merchantId, 'property_id' => $propertyId, 'room_type_id' => $roomTypeId,
    'refund_type' => 1, 'apply_amount' => 1000, 'refund_amount' => 1000, 'refund_channel' => 1, 'status' => 2,
]);
setRequest(['id' => $refundId]);
$container->get(AdminRefundController::class)->confirm();
contract((int) rec($r6)['status'] === 2 && (int) Db::table('order_main')->where('id', $o6)->value('order_status') === 6,
    'admin full refund confirm returns expired coupon as expired', json_encode(rec($r6)));
AdminContext::set([]);

if ($failures !== []) {
    echo 'FAILED: ' . count($failures) . "\n";
    exit(1);
}
echo "ALL PASS\n";
