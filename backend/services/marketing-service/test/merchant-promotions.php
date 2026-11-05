<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Merchant\PromotionController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;

AdminContext::set(['is_super' => true]);
$merchant = merchantFixture();
$property = (int) Db::table('merchant_store')->insertGetId([
    'site_id' => 991, 'merchant_id' => $merchant, 'store_name' => 'Promotion fixture',
    'business_type' => 'hotel', 'status' => 1,
]);
$scope = ['admin_id' => 99101, 'admin_name' => 'Promotion fixture', 'site_id' => 991,
    'merchant_id' => $merchant, 'account_type' => 2, 'is_owner' => true, 'property_ids' => [$property]];
MerchantContext::set($scope);
$controller = $container->get(PromotionController::class);
$base = ['couponName' => 'Promotion fixture', 'promotionKind' => 1, 'discountValue' => 15,
    'propertyIds' => [$property], 'validType' => 1, 'validStart' => '2027-01-01 09:00:00',
    'validEnd' => '2027-02-01 18:30:00', 'totalCount' => 100, 'perUserLimit' => 1];
function createPromotion(array $overrides = []): int
{
    global $controller, $base;
    setRequest(array_replace($base, $overrides));
    return (int) $controller->add()['data']['id'];
}


$room = (int) Db::table('hotel_room_type')->insertGetId(['site_id' => 991, 'property_id' => $property, 'room_name' => 'Promotion room', 'base_price' => 100000, 'currency' => 'MMK', 'status' => 1]);
Db::connection('system')->table('sys_site')->insert(['id' => 991, 'site_name' => 'Promotion fixture', 'timezone' => 'Asia/Yangon']);
rejects(40901, fn () => createPromotion(), 'unconfigured limits fail closed');
foreach (['merchant_promotion_max_percent' => '80', 'merchant_promotion_max_amount' => '80000', 'merchant_promotion_min_payable_percent' => '20'] as $key => $value) {
    Db::connection('system')->table('sys_site_config')->insert(['site_id' => 991, 'config_key' => $key, 'config_value' => $value]);
}
$id = createPromotion(['enabled' => 0]);
$row = (array) Db::table('marketing_coupon')->find($id);
check($row['valid_start'] === '2027-01-01 02:30:00' && $row['valid_end'] === '2027-02-01 12:00:00', 'platform timezone converts precisely to UTC');
check((int) $row['status'] === 2 && (float) $row['discount_value'] === 8.5, 'create uses enabled state and percentage pricing');
Db::connection('system')->table('sys_site_config')->where('site_id', 991)->where('config_key', 'merchant_promotion_max_amount')->update(['config_value' => '1e999']);
setRequest(['id' => $id]);
rejects(40901, fn () => $controller->publish(), 'non-finite policy configuration blocks activation');
Db::connection('system')->table('sys_site_config')->where('site_id', 991)->where('config_key', 'merchant_promotion_max_amount')->update(['config_value' => '80000']);
foreach (['2027-01-01 08:59:00', $base['validStart'], '2027-02-30 18:00:00', 'invalid', '2027-01-01'] as $end) {
    rejects(40001, fn () => createPromotion(['validEnd' => $end]), 'reject invalid/equal/reversed or date-only schedule');
}
rejects(40001, fn () => createPromotion(['noExpiry' => 1]), 'lifetime promotion cannot bypass mandatory schedule');
rejects(40001, fn () => createPromotion(['validType' => 2, 'validDays' => 14]), 'relative expiry cannot bypass mandatory schedule');
rejects(40001, fn () => createPromotion(['discountValue' => 100]), 'free promotions are rejected');
rejects(40001, fn () => createPromotion(['discountValue' => 81]), 'percentage cap enforced');
rejects(40001, fn () => createPromotion(['promotionKind' => 2, 'discountValue' => 80001]), 'amount cap enforced');
Db::table('merchant_info')->where('id', $merchant)->update(['commission_rate' => 30]);
rejects(40001, fn () => createPromotion(['promotionKind' => 2, 'discountValue' => 75000]), 'merchant commission raises protected floor');
check(createPromotion(['discountValue' => 75, 'minAmount' => 200000]) > 0, 'protected floor is based on official price, not minimum spend');
Db::table('merchant_info')->where('id', $merchant)->update(['commission_rate' => 10]);
$fixed = createPromotion(['promotionKind' => 4, 'discountUnit' => 2, 'discountValue' => 5000, 'minNights' => 3]);
$percent = createPromotion(['promotionKind' => 4, 'discountUnit' => 1, 'discountValue' => 10, 'minNights' => 3]);
$row = (array) Db::table('marketing_coupon')->find($fixed);
check((int) $row['coupon_type'] === 1 && (float) $row['discount_value'] === 5000.0, 'fixed long stay never becomes a percentage');
setRequest(['promotionKind' => 2]);
check(array_column($controller->index()['data']['list'], 'id') === [$fixed], 'amount tab includes amount long stay');
setRequest(['promotionCondition' => 'standard']);
check(count($controller->index()['data']['list']) === 2, 'standard filter excludes long stay');
$summary = $controller->summary()['data'];
check($summary['percentage'] === 3 && $summary['fixedAmount'] === 1 && $summary['longStay'] === 2, 'summary agrees with type lists');
Db::table('marketing_coupon')->where('id', $id)->update(['valid_end' => null]);
setRequest(['id' => $id]);
rejects(40001, fn () => $controller->duplicate(), 'legacy lifetime promotions cannot bypass scheduling by duplicating');
Db::table('marketing_coupon')->where('id', $id)->update(['valid_end' => '2027-02-01 12:00:00']);

$code = createPromotion(['promotionKind' => 3, 'discountUnit' => 1, 'promoCode' => 'ISOLATED_2027', 'enabled' => 0]);
setRequest(['id' => $code]);
$controller->publish();
check((int) Db::table('marketing_promo_code')->where('coupon_id', $code)->value('status') === 1, 'enabling enables code mirror');
$controller->toggleStatus();
check((int) Db::table('marketing_promo_code')->where('coupon_id', $code)->value('status') === 2, 'disabling disables code mirror');
$controller->end();
check((int) Db::table('marketing_promo_code')->where('coupon_id', $code)->value('status') === 3, 'ending synchronizes code mirror');
rejects(40901, fn () => $controller->end(), 'ended promotion cannot end again');
rejects(40901, fn () => $controller->toggleStatus(), 'ended promotion cannot resume');
MerchantContext::set(array_replace($scope, ['property_ids' => [$property + 10000]]));
setRequest(['id' => $id]);
rejects(40401, fn () => $controller->end(), 'ending cannot cross property scope');
MerchantContext::set($scope);

$consumer = $container->get(\App\Controller\App\MarketingController::class);
\Mtrip\Shared\Context\UserContext::set(['site_id' => 991, 'user_id' => 99102]);
$renamed = createPromotion(['promotionKind' => 3, 'promoCode' => 'BEFORE_EDIT', 'validStart' => '2026-01-01 00:00:00', 'validEnd' => '2028-12-31 23:59:59']);
setRequest(array_replace($base, ['id' => $renamed, 'promotionKind' => 3, 'promoCode' => 'AFTER_EDIT', 'validStart' => '2026-01-01 00:00:00', 'validEnd' => '2028-12-31 23:59:59']));
$controller->update();
check(Db::table('marketing_promo_code')->where('coupon_id', $renamed)->value('code') === 'AFTER_EDIT', 'code edit updates redeemable mirror');
setRequest(['code' => 'BEFORE_EDIT']);
rejects(\Mtrip\Shared\Constants\ErrorCode::PROMO_CODE_NOT_FOUND, fn () => $consumer->redeemPromoCode(), 'old code stops redeeming after edit');
setRequest(['code' => 'AFTER_EDIT']);
check($consumer->redeemPromoCode()['data']['receiveId'] > 0, 'renamed code redeems against locked current template');
setRequest(array_replace($base, ['id' => $renamed, 'promotionKind' => 2, 'discountValue' => 1000]));
$controller->update();
check(! Db::table('marketing_promo_code')->where('coupon_id', $renamed)->whereNull('deleted_at')->exists(), 'changing away from code archives mirror');
$entitlement = createPromotion(['couponName' => 'Entitlement original', 'validStart' => '2026-01-01 00:00:00', 'validEnd' => '2028-12-31 23:59:59', 'remark' => 'Original terms']);
setRequest(['couponId' => $entitlement]);
$receive = $consumer->claim()['data']['receiveId'];
$original = (array) Db::table('marketing_coupon_receive')->find($receive);
check((int) $original['coupon_version_id'] > 0 && $original['rules_snapshot'] !== null, 'claim links immutable version and terms');
setRequest(array_replace($base, ['id' => $entitlement, 'couponName' => 'Entitlement changed', 'discountValue' => 5, 'remark' => 'Changed terms']));
$controller->update();
setRequest(['id' => $entitlement]);
$controller->toggleStatus();
setRequest(['couponId' => $entitlement]);
rejects(40901, fn () => $consumer->claim(), 'disabled promotion stops new claims');
setRequest(['id' => $entitlement]);
$controller->remove();
setRequest(['receiveId' => $receive]);
$view = $consumer->couponDetail()['data'];
check($view['coupon_name'] === 'Entitlement original' && $view['discount_value'] === 8.5 && $view['remark'] === 'Original terms', 'claimed view retains original rules after editing and archiving');
check($view['valid_end'] === $original['valid_end'] && $view['status'] === 'available', 'original receipt validity survives archive');
$legacy = createPromotion(['couponName' => 'Legacy last known', 'validStart' => '2026-01-01 00:00:00', 'validEnd' => '2028-12-31 23:59:59']);
setRequest(['couponId' => $legacy]);
$legacyReceive = $consumer->claim()['data']['receiveId'];
Db::table('marketing_coupon')->where('id', $legacy)->update(['current_version_id' => 0]);
Db::table('marketing_coupon_receive')->where('id', $legacyReceive)->update(['coupon_version_id' => 0, 'rules_snapshot' => null]);
setRequest(array_replace($base, ['id' => $legacy, 'couponName' => 'Future claims only', 'discountValue' => 5]));
$controller->update();
setRequest(['receiveId' => $legacyReceive]);
check($consumer->couponDetail()['data']['coupon_name'] === 'Legacy last known', 'legacy receipt freezes last-known template before first mutation');
$admin = $container->get(\App\Controller\Admin\CouponController::class);
setRequest(['id' => $id]);
rejects(40301, fn () => $admin->toggleStatus(), 'admin cannot change merchant-funded promotions');
setRequest(['id' => $entitlement]);
check(count($admin->detail()['data']['history']) >= 4, 'admin can inspect archived promotion history');

$campaignId = (int) Db::table('marketing_campaign')->insertGetId(['site_id' => 991, 'title' => 'Campaign fixture', 'status' => 1, 'invite_mode' => 1]);
$participant = (int) Db::table('marketing_campaign_participant')->insertGetId(['site_id' => 991, 'campaign_id' => $campaignId, 'merchant_id' => $merchant, 'status' => 0]);
$campaignCoupon = (int) Db::table('marketing_coupon')->insertGetId(['site_id' => 991, 'coupon_name' => 'Campaign entitlement', 'coupon_type' => 1, 'discount_value' => 1000, 'goods_scope' => 3, 'property_ids' => json_encode([$property]), 'valid_type' => 1, 'valid_start' => '2026-01-01 00:00:00', 'valid_end' => '2028-12-31 23:59:59', 'status' => 1, 'total_count' => 100, 'per_user_limit' => 10]);
Db::table('marketing_campaign')->where('id', $campaignId)->update(['coupon_ids' => json_encode([$campaignCoupon])]);
$campaign = $container->get(\App\Controller\Merchant\CampaignController::class);
setRequest(['id' => $campaignId, 'action' => 'accept']); $campaign->respond();
setRequest(['id' => $campaignId, 'action' => 'decline']);
rejects(40901, fn () => $campaign->respond(), 'accepted offers cannot bypass withdrawal approval by declining');
setRequest(['id' => $campaignId, 'reason' => 'Test withdrawal']);
$requestId = $campaign->withdraw()['data']['id'];
rejects(40901, fn () => $campaign->withdraw(), 'duplicate pending requests rejected');
check((int) Db::table('marketing_campaign_participant')->where('id', $participant)->value('status') === 1, 'pending withdrawal leaves participation accepted');
setRequest(['couponId' => $campaignCoupon]);
$campaignReceive = $consumer->claim()['data']['receiveId'];
check($campaignReceive > 0, 'eligible claims continue while withdrawal pending');
Db::table('marketing_campaign')->where('id', $campaignId)->update(['deleted_at' => gmdate('Y-m-d H:i:s')]);
rejects(40901, fn () => $consumer->claim(), 'deleted campaign never turns its coupon into standalone claims');
Db::table('marketing_campaign')->where('id', $campaignId)->update(['deleted_at' => null]);
$reviewer = $container->get(\App\Controller\Admin\CampaignController::class);
setRequest(['id' => $requestId, 'action' => 'reject', 'reason' => 'Continue participation']); $reviewer->withdrawalDecision();
check((int) Db::table('marketing_campaign_participant')->where('id', $participant)->value('status') === 1, 'rejection leaves participation unchanged');
setRequest(['id' => $campaignId, 'reason' => 'Second request']); $requestId = $campaign->withdraw()['data']['id'];
setRequest(['id' => $requestId, 'action' => 'approve', 'reason' => 'Approved end']); $reviewer->withdrawalDecision();
check((int) Db::table('marketing_campaign_participant')->where('id', $participant)->value('status') === 3, 'approval ends participation');
rejects(40901, fn () => $reviewer->withdrawalDecision(), 'decision cannot be repeated');
setRequest(['couponId' => $campaignCoupon]);
rejects(40901, fn () => $consumer->claim(), 'approved withdrawal stops new campaign claims');
setRequest(['receiveId' => $campaignReceive]);
check($consumer->couponDetail()['data']['status'] === 'available', 'campaign entitlement survives withdrawal approval');
check(Db::table('merchant_notify')->where('merchant_id', $merchant)->count() === 2, 'both decisions notify the merchant');
echo "MERCHANT PROMOTIONS INTEGRATION PASSED\n";
