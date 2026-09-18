<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Constants\BookingConst;
use App\Controller\Admin\AdminOrderController;
use App\Controller\Admin\AdminVerifyController;
use App\Controller\App\OrderController as AppOrderController;
use App\Controller\Merchant\BookingController;
use App\Controller\Merchant\OrderController as MerchantOrderController;
use App\Service\Booking\BookingLifecycleService;
use App\Service\Booking\BookingNotificationService;
use App\Service\Booking\BookingRefundService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;

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

function invokeBookingController(string $class, string $method, array $input): array
{
    global $container;
    setRequest($input);
    return $container->get($class)->{$method}();
}

$merchantIds = $propertyIds = $roomIds = $orderIds = $refundIds = $notificationIds = [];
try {
    Db::connection('system')->table('sys_site')->updateOrInsert(
        ['id' => 991],
        ['site_name' => 'Booking remediation site', 'timezone' => 'Asia/Yangon']
    );
    $merchantId = $merchantIds[] = merchantFixture();
    $propertyId = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991,
        'merchant_id' => $merchantId,
        'store_name' => 'Booking remediation property',
        'business_type' => 'hotel',
        'status' => 1,
        'operating_status' => 1,
    ]);
    $roomTypeId = $roomIds[] = (int) Db::table('hotel_room_type')->insertGetId([
        'site_id' => 991,
        'property_id' => $propertyId,
        'room_name' => 'Booking remediation room',
        'base_price' => 1000,
        'base_stock' => 10,
        'launch_stock' => 10,
        'status' => 1,
        'publish_status' => 2,
    ]);
    $otherPropertyId = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991,
        'merchant_id' => $merchantId,
        'store_name' => 'Booking remediation property B',
        'business_type' => 'hotel',
        'status' => 1,
        'operating_status' => 1,
    ]);
    $otherRoomTypeId = $roomIds[] = (int) Db::table('hotel_room_type')->insertGetId([
        'site_id' => 991,
        'property_id' => $otherPropertyId,
        'room_name' => 'Booking remediation room B',
        'base_price' => 800,
        'base_stock' => 5,
        'launch_stock' => 5,
        'status' => 1,
        'publish_status' => 2,
    ]);
    $lifecycle = $container->get(BookingLifecycleService::class);
    $createFields = $lifecycle->buildCreateFields(1, $propertyId, $roomTypeId, '');
    $noShowSnapshot = json_decode((string) $createFields['no_show_policy_snapshot'], true);
    contract($noShowSnapshot === [
        'feeType' => 'first_night',
        'deadlineTime' => '23:59:59',
        'timezone' => 'Asia/Yangon',
        'source' => 'default',
    ], 'new booking freezes default no-show policy with site timezone', json_encode($noShowSnapshot));

    $orderId = $orderIds[] = (int) Db::table('order_main')->insertGetId([
        'order_no' => 'BOOKING-REFUND-' . bin2hex(random_bytes(6)),
        'site_id' => 991,
        'user_id' => 99101,
        'order_type' => 1,
        'merchant_id' => $merchantId,
        'property_id' => $propertyId,
        'room_type_id' => $roomTypeId,
        'goods_name' => 'Booking remediation hotel',
        'sku_name' => 'Booking remediation room',
        'quantity' => 1,
        'unit_price' => 1000,
        'original_price' => 1000,
        'total_amount' => 1000,
        'pay_amount' => 1000,
        'order_status' => 1,
        'booking_status' => BookingConst::STATUS_CANCELLED,
        'payment_status' => BookingConst::PAY_PARTIAL_REFUNDED,
        'booking_channel' => BookingConst::CHANNEL_MTRIP,
        'use_date' => date('Y-m-d', strtotime('+10 days')),
        'end_date' => date('Y-m-d', strtotime('+11 days')),
        'contact_name' => 'Fixture',
        'contact_phone' => '',
        'cancellation_policy_snapshot' => json_encode([
            'ruleType' => 2,
            'rules' => [['hours_before' => 0, 'refund_rate' => 50]],
        ], JSON_UNESCAPED_UNICODE),
    ]);
    $otherOrderId = $orderIds[] = (int) Db::table('order_main')->insertGetId([
        'order_no' => 'BOOKING-SCOPE-' . bin2hex(random_bytes(6)),
        'site_id' => 991,
        'user_id' => 99102,
        'order_type' => 1,
        'merchant_id' => $merchantId,
        'property_id' => $otherPropertyId,
        'room_type_id' => $otherRoomTypeId,
        'goods_name' => 'Booking remediation hotel B',
        'sku_name' => 'Booking remediation room B',
        'quantity' => 1,
        'unit_price' => 800,
        'original_price' => 800,
        'total_amount' => 800,
        'pay_amount' => 800,
        'order_status' => 1,
        'booking_status' => BookingConst::STATUS_CONFIRMED,
        'payment_status' => BookingConst::PAY_PAID,
        'booking_channel' => BookingConst::CHANNEL_MTRIP,
        'use_date' => date('Y-m-d', strtotime('+5 days')),
        'end_date' => date('Y-m-d', strtotime('+6 days')),
        'contact_name' => 'Scope Fixture',
        'contact_phone' => '',
    ]);
    $refundIds[] = (int) Db::table('order_refund')->insertGetId([
        'refund_no' => 'BOOKING-REFUND-HISTORY-' . bin2hex(random_bytes(4)),
        'site_id' => 991,
        'order_id' => $orderId,
        'order_no' => (string) Db::table('order_main')->where('id', $orderId)->value('order_no'),
        'user_id' => 99101,
        'merchant_id' => $merchantId,
        'property_id' => $propertyId,
        'room_type_id' => $roomTypeId,
        'refund_type' => 2,
        'apply_amount' => 300,
        'refund_amount' => 300,
        'status' => 3,
    ]);

    $refund = $container->get(BookingRefundService::class);
    $order = (array) Db::table('order_main')->where('id', $orderId)->first();
    $legacyDeadline = $lifecycle->noShowDeadline($order);
    contract($legacyDeadline->getTimezone()->getName() === 'Asia/Yangon'
        && $legacyDeadline->format('H:i:s') === '23:59:59',
        'legacy booking no-show deadline falls back to site local time', $legacyDeadline->format(DATE_ATOM));
    $pastNoShowActions = $lifecycle->availableActions(array_replace($order, [
        'booking_status' => BookingConst::STATUS_CONFIRMED,
        'use_date' => date('Y-m-d', strtotime('-1 day')),
    ]));
    contract(in_array('no-show', $pastNoShowActions, true), 'past local no-show deadline exposes action');
    $quote = $refund->quote($order);
    contract((float) $quote['refundable'] === 200.0, 'policy cap subtracts completed refunds', json_encode($quote));
    contract((float) $quote['remainingRefundable'] === 200.0, 'remaining refundable means remaining policy allowance', json_encode($quote));
    contract((float) $quote['cancellationFee'] === 500.0, 'cancellation fee excludes historical refunds', json_encode($quote));
    $excessRejected = false;
    try {
        $refund->apply($order, 991001, 'Booking Fixture', 200.01, 'Exceeds policy allowance');
    } catch (BusinessException $e) {
        $excessRejected = $e->getCode() === ErrorCode::PARAM_ERROR;
    }
    contract($excessRejected, 'refund apply rejects amount above remaining policy allowance');

    $nonRefundable = array_replace($order, [
        'id' => $orderId + 1000000,
        'cancellation_policy_snapshot' => json_encode(['ruleType' => 3], JSON_UNESCAPED_UNICODE),
    ]);
    $nonRefundableQuote = $refund->quote($nonRefundable);
    contract((float) $nonRefundableQuote['refundable'] === 0.0
        && (float) $nonRefundableQuote['remainingRefundable'] === 0.0,
        'non-refundable policy always exposes zero allowance', json_encode($nonRefundableQuote));

    $actions = $lifecycle->availableActions($order);
    contract(in_array('refund', $actions, true), 'cancelled paid booking keeps refund action', json_encode($actions));
    $nonRefundableActions = $container->get(BookingLifecycleService::class)->availableActions(array_replace($nonRefundable, [
        'booking_status' => BookingConst::STATUS_CANCELLED,
        'payment_status' => BookingConst::PAY_PAID,
    ]));
    contract(! in_array('refund', $nonRefundableActions, true), 'cancelled booking without policy allowance hides refund action', json_encode($nonRefundableActions));

    $notification = $container->get(BookingNotificationService::class);
    $notification->push($order, 'Booking contract', 'Booking remediation notification');
    $notice = (array) Db::table('merchant_notify')->where('merchant_id', $merchantId)->orderByDesc('id')->first();
    $notificationIds[] = (int) $notice['id'];
    contract(ctype_digit((string) ($notice['deep_link_value'] ?? '')), 'new booking deep link stores numeric order id', (string) ($notice['deep_link_value'] ?? ''));
    contract(array_key_exists('property_id', $notice) && (int) $notice['property_id'] === $propertyId,
        'booking notification stores property scope', json_encode($notice));

    $hotelPayOrderId = $orderIds[] = (int) Db::table('order_main')->insertGetId([
        'order_no' => 'BOOKING-HOTEL-PAY-' . bin2hex(random_bytes(5)),
        'site_id' => 991, 'user_id' => 99101, 'order_type' => 1, 'merchant_id' => $merchantId,
        'property_id' => $propertyId, 'room_type_id' => $roomTypeId,
        'goods_name' => 'Booking remediation hotel', 'sku_name' => 'Booking remediation room',
        'quantity' => 1, 'unit_price' => 1000, 'original_price' => 1000, 'total_amount' => 1000, 'pay_amount' => 1000,
        'pay_method' => BookingConst::PAY_METHOD_PAY_AT_HOTEL,
        'order_status' => 1, 'booking_status' => BookingConst::STATUS_CONFIRMED,
        'payment_status' => BookingConst::PAY_PENDING, 'booking_channel' => BookingConst::CHANNEL_WALKIN,
        'use_date' => date('Y-m-d'), 'end_date' => date('Y-m-d', strtotime('+1 day')),
        'contact_name' => 'Fixture', 'contact_phone' => '',
    ]);
    $hotelPayOrder = (array) Db::table('order_main')->where('id', $hotelPayOrderId)->first();
    $hotelPayActions = $lifecycle->availableActions($hotelPayOrder);
    contract(in_array('mark-paid', $hotelPayActions, true), 'explicit Pay at Hotel booking exposes mark-paid action', json_encode($hotelPayActions));
    contract(! in_array('refund', $hotelPayActions, true), 'unpaid Pay at Hotel booking does not expose refund action', json_encode($hotelPayActions));
    $onlineActions = $lifecycle->availableActions(array_replace($hotelPayOrder, ['pay_method' => 3]));
    contract(! in_array('mark-paid', $onlineActions, true), 'non-hotel payment never exposes mark-paid action', json_encode($onlineActions));

    $verifyOrderId = $orderIds[] = (int) Db::table('order_main')->insertGetId([
        'order_no' => 'BOOKING-VERIFY-' . bin2hex(random_bytes(6)),
        'site_id' => 991,
        'user_id' => 99101,
        'order_type' => 1,
        'merchant_id' => $merchantId,
        'property_id' => $propertyId,
        'room_type_id' => $roomTypeId,
        'goods_name' => 'Booking remediation hotel',
        'sku_name' => 'Booking remediation room',
        'quantity' => 1,
        'unit_price' => 1000,
        'original_price' => 1000,
        'total_amount' => 1000,
        'pay_amount' => 1000,
        'pay_method' => 3,
        'pay_time' => date('Y-m-d H:i:s'),
        'order_status' => 1,
        'booking_status' => BookingConst::STATUS_CONFIRMED,
        'payment_status' => BookingConst::PAY_PAID,
        'booking_channel' => BookingConst::CHANNEL_MTRIP,
        'use_date' => date('Y-m-d'),
        'end_date' => date('Y-m-d', strtotime('+1 day')),
        'contact_name' => 'Fixture',
        'contact_phone' => '',
        'verify_code' => 'BOOKINGVERIFY',
    ]);
    $merchantContext = [
        'admin_id' => 991001,
        'admin_name' => 'Booking Fixture',
        'site_id' => 991,
        'merchant_id' => $merchantId,
        'account_type' => 2,
        'is_owner' => true,
        'property_ids' => [$propertyId, $otherPropertyId],
    ];
    AdminContext::set([
        'admin_id' => 991001,
        'admin_name' => 'Booking Fixture',
        'site_id' => 991,
        'permissions' => [
            'mch:order:list',
            'mch:order:detail',
            'mch:order:verify',
            'mch:order:mark-paid',
            'order:verify:list',
            'order:verify:revoke',
            'order:all:cancel',
        ],
    ]);
    MerchantContext::set($merchantContext + ['selected_property_id' => 0]);
    $allProperties = invokeBookingController(BookingController::class, 'index', ['page' => 1, 'pageSize' => 100]);
    $allPropertyIds = array_values(array_unique(array_map('intval', array_column($allProperties['data']['list'], 'property_id'))));
    sort($allPropertyIds);
    $expectedPropertyIds = [$propertyId, $otherPropertyId];
    sort($expectedPropertyIds);
    contract($allPropertyIds === $expectedPropertyIds, 'all-properties booking list aggregates authorized properties', json_encode($allPropertyIds));

    MerchantContext::set($merchantContext + ['selected_property_id' => $propertyId]);
    $selectedProperty = invokeBookingController(BookingController::class, 'index', ['page' => 1, 'pageSize' => 100]);
    contract(array_values(array_unique(array_map('intval', array_column($selectedProperty['data']['list'], 'property_id')))) === [$propertyId],
        'selected property header fixes booking list to one property');
    $crossPropertyDetailRejected = false;
    try {
        invokeBookingController(BookingController::class, 'detail', ['id' => $otherOrderId]);
    } catch (BusinessException $e) {
        $crossPropertyDetailRejected = $e->getCode() === ErrorCode::NOT_FOUND;
    }
    contract($crossPropertyDetailRejected, 'selected property cannot read another property booking detail');

    MerchantContext::set(array_replace($merchantContext, [
        'property_ids' => [$propertyId],
        'selected_property_id' => 0,
    ]));
    $forgedFilter = invokeBookingController(BookingController::class, 'index', [
        'propertyId' => $otherPropertyId,
        'page' => 1,
        'pageSize' => 100,
    ]);
    contract((int) $forgedFilter['data']['total'] === 0, 'query property filter cannot widen authorized booking scope');

    MerchantContext::set(array_replace($merchantContext, [
        'property_ids' => [$propertyId],
        'selected_property_id' => $propertyId,
    ]));
    invokeBookingController(BookingController::class, 'markPaid', ['id' => $hotelPayOrderId]);
    $hotelPaid = (array) Db::table('order_main')->where('id', $hotelPayOrderId)->first();
    contract((int) $hotelPaid['payment_status'] === BookingConst::PAY_PAID && $hotelPaid['pay_time'] !== null,
        'mark-paid records offline collection without changing booking state', json_encode([
            'booking_status' => $hotelPaid['booking_status'],
            'payment_status' => $hotelPaid['payment_status'],
            'pay_time' => $hotelPaid['pay_time'],
        ]));
    invokeBookingController(BookingController::class, 'markPaid', ['id' => $hotelPayOrderId]);
    contract(Db::table('order_booking_event')->where('order_id', $hotelPayOrderId)
        ->where('event_type', 'payment_collected_at_hotel')->count() === 1,
        'mark-paid is idempotent and writes one payment event');
    $wrongMethodRejected = false;
    try {
        $lifecycle->markPaidAtHotel($verifyOrderId, 991001, 'Booking Fixture');
    } catch (BusinessException $e) {
        $wrongMethodRejected = $e->getCode() === ErrorCode::DATA_CONFLICT;
    }
    contract($wrongMethodRejected, 'mark-paid rejects non-Pay-at-Hotel booking');
    invokeBookingController(MerchantOrderController::class, 'verify', ['id' => $verifyOrderId]);
    $verified = (array) Db::table('order_main')->where('id', $verifyOrderId)->first();
    contract((int) $verified['booking_status'] === BookingConst::STATUS_CHECKED_IN,
        'legacy merchant hotel verification enters booking lifecycle', json_encode([
            'order_status' => $verified['order_status'],
            'booking_status' => $verified['booking_status'],
        ]));
    contract(Db::table('order_booking_event')->where('order_id', $verifyOrderId)->where('event_type', 'checked_in')->exists(),
        'legacy merchant hotel verification writes booking timeline');

    invokeBookingController(AdminVerifyController::class, 'verifyCancel', ['id' => $verifyOrderId, 'reason' => 'Admin correction']);
    $reverted = (array) Db::table('order_main')->where('id', $verifyOrderId)->first();
    contract((int) $reverted['order_status'] === 1 && (int) $reverted['booking_status'] === BookingConst::STATUS_CONFIRMED,
        'admin hotel verification revoke restores confirmed lifecycle state', json_encode([
            'order_status' => $reverted['order_status'],
            'booking_status' => $reverted['booking_status'],
        ]));
    contract(Db::table('order_booking_event')->where('order_id', $verifyOrderId)->where('event_type', 'check_in_reverted')->exists(),
        'admin hotel verification revoke writes booking timeline');
    invokeBookingController(AdminVerifyController::class, 'verify', ['id' => $verifyOrderId]);
    contract((int) Db::table('order_main')->where('id', $verifyOrderId)->value('booking_status') === BookingConst::STATUS_CHECKED_IN,
        'admin hotel verification enters booking lifecycle');

    $cancelOrderId = $orderIds[] = (int) Db::table('order_main')->insertGetId([
        'order_no' => 'BOOKING-CANCEL-' . bin2hex(random_bytes(6)),
        'site_id' => 991,
        'user_id' => 99101,
        'order_type' => 1,
        'merchant_id' => $merchantId,
        'property_id' => $propertyId,
        'room_type_id' => $roomTypeId,
        'goods_name' => 'Booking remediation hotel',
        'sku_name' => 'Booking remediation room',
        'quantity' => 1,
        'unit_price' => 1000,
        'original_price' => 1000,
        'total_amount' => 1000,
        'pay_amount' => 1000,
        'order_status' => 0,
        'booking_status' => BookingConst::STATUS_PENDING_PAYMENT,
        'payment_status' => BookingConst::PAY_PENDING,
        'booking_channel' => BookingConst::CHANNEL_MTRIP,
        'use_date' => date('Y-m-d', strtotime('+2 days')),
        'end_date' => date('Y-m-d', strtotime('+3 days')),
        'contact_name' => 'Fixture',
        'contact_phone' => '',
    ]);
    invokeBookingController(AdminOrderController::class, 'cancel', ['id' => $cancelOrderId, 'reason' => 'Admin cancellation']);
    $cancelled = (array) Db::table('order_main')->where('id', $cancelOrderId)->first();
    contract((int) $cancelled['order_status'] === 4 && (int) $cancelled['booking_status'] === BookingConst::STATUS_CANCELLED,
        'admin hotel cancellation enters booking lifecycle', json_encode([
            'order_status' => $cancelled['order_status'],
            'booking_status' => $cancelled['booking_status'],
        ]));
    contract(Db::table('order_booking_event')->where('order_id', $cancelOrderId)->where('event_type', 'cancelled')->exists(),
        'admin hotel cancellation writes booking timeline');

    UserContext::set(['user_id' => 99101, 'site_id' => 991]);
    $guestCancelId = $orderIds[] = (int) Db::table('order_main')->insertGetId([
        'order_no' => 'BOOKING-GUEST-CANCEL-' . bin2hex(random_bytes(5)),
        'site_id' => 991, 'user_id' => 99101, 'order_type' => 1, 'merchant_id' => $merchantId,
        'property_id' => $propertyId, 'room_type_id' => $roomTypeId,
        'goods_name' => 'Booking remediation hotel', 'sku_name' => 'Booking remediation room',
        'quantity' => 1, 'unit_price' => 1000, 'original_price' => 1000, 'total_amount' => 1000, 'pay_amount' => 1000,
        'order_status' => 0, 'booking_status' => BookingConst::STATUS_PENDING_PAYMENT,
        'payment_status' => BookingConst::PAY_PENDING, 'booking_channel' => BookingConst::CHANNEL_MTRIP,
        'use_date' => date('Y-m-d', strtotime('+4 days')), 'end_date' => date('Y-m-d', strtotime('+5 days')),
        'contact_name' => 'Fixture', 'contact_phone' => '',
    ]);
    invokeBookingController(AppOrderController::class, 'cancel', ['orderId' => $guestCancelId, 'reason' => 'Guest cancellation']);
    $guestCancelNotice = (array) Db::table('merchant_notify')->where('merchant_id', $merchantId)
        ->where('deep_link_value', (string) $guestCancelId)->orderByDesc('id')->first();
    if ($guestCancelNotice !== []) $notificationIds[] = (int) $guestCancelNotice['id'];
    contract($guestCancelNotice !== [] && (int) $guestCancelNotice['property_id'] === $propertyId,
        'guest hotel cancellation notifies merchant with property scope', json_encode($guestCancelNotice));

    $guestRefundId = $orderIds[] = (int) Db::table('order_main')->insertGetId([
        'order_no' => 'BOOKING-GUEST-REFUND-' . bin2hex(random_bytes(5)),
        'site_id' => 991, 'user_id' => 99101, 'order_type' => 1, 'merchant_id' => $merchantId,
        'property_id' => $propertyId, 'room_type_id' => $roomTypeId,
        'goods_name' => 'Booking remediation hotel', 'sku_name' => 'Booking remediation room',
        'quantity' => 1, 'unit_price' => 1000, 'original_price' => 1000, 'total_amount' => 1000, 'pay_amount' => 1000,
        'order_status' => 1, 'booking_status' => BookingConst::STATUS_CONFIRMED,
        'payment_status' => BookingConst::PAY_PAID, 'booking_channel' => BookingConst::CHANNEL_MTRIP,
        'use_date' => date('Y-m-d', strtotime('+6 days')), 'end_date' => date('Y-m-d', strtotime('+7 days')),
        'contact_name' => 'Fixture', 'contact_phone' => '',
    ]);
    invokeBookingController(AppOrderController::class, 'applyRefund', ['orderId' => $guestRefundId, 'reason' => 'Guest refund']);
    $guestRefundNotice = (array) Db::table('merchant_notify')->where('merchant_id', $merchantId)
        ->where('deep_link_value', (string) $guestRefundId)->orderByDesc('id')->first();
    if ($guestRefundNotice !== []) $notificationIds[] = (int) $guestRefundNotice['id'];
    contract($guestRefundNotice !== [] && str_contains((string) $guestRefundNotice['title'], '退款申请'),
        'guest hotel refund request notifies merchant', json_encode($guestRefundNotice));
} finally {
    UserContext::set([]);
    MerchantContext::set([]);
    AdminContext::set([]);
    if ($notificationIds !== []) {
        Db::table('merchant_notify_read')->whereIn('notify_id', $notificationIds)->delete();
        Db::table('merchant_notify_delivery')->whereIn('notify_id', $notificationIds)->delete();
        Db::table('merchant_notify')->whereIn('id', $notificationIds)->delete();
    }
    if ($orderIds !== []) {
        Db::table('order_booking_event')->whereIn('order_id', $orderIds)->delete();
        Db::table('order_verify_log')->whereIn('order_id', $orderIds)->delete();
        Db::table('goods_stock_log')->whereIn('order_id', $orderIds)->delete();
        Db::table('order_refund')->whereIn('order_id', $orderIds)->delete();
        Db::table('order_main')->whereIn('id', $orderIds)->delete();
    }
    if ($roomIds !== []) Db::table('hotel_room_type')->whereIn('id', $roomIds)->delete();
    if ($propertyIds !== []) Db::table('merchant_store')->whereIn('id', $propertyIds)->delete();
    if ($merchantIds !== []) Db::table('merchant_info')->whereIn('id', $merchantIds)->delete();
    Db::table('notify_record')->where('user_id', 99101)->delete();
}

if ($failures !== []) {
    fwrite(STDERR, 'Booking remediation contract failures: ' . implode(', ', $failures) . PHP_EOL);
    exit(1);
}
echo "Booking remediation contract passed\n";
