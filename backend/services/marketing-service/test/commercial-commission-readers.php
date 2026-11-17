<?php

declare(strict_types=1);

require '/tmp/M12CommercialBootstrap.php';
require '/tmp/CommercialPromotionController.php';

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Merchant\MerchantCommercialSettings;
use App\Service\MerchantPromotionPolicy;

$merchant = merchantFixture();
Db::table('merchant_info')->where('id', $merchant)->update(['commission_rate' => 10]);
$property = (int) Db::table('merchant_store')->insertGetId(['site_id' => 991, 'merchant_id' => $merchant, 'store_name' => 'Commercial promotion fixture', 'business_type' => 'hotel', 'status' => 1]);
Db::table('hotel_room_type')->insert(['site_id' => 991, 'property_id' => $property, 'room_name' => 'Commercial room', 'base_price' => 100000, 'currency' => 'MMK', 'status' => 1]);
Db::connection('system')->table('sys_site')->insert(['id' => 991, 'site_name' => 'Commercial promotions fixture', 'timezone' => 'UTC']);
foreach (['merchant_promotion_max_percent' => '80', 'merchant_promotion_max_amount' => '80000', 'merchant_promotion_min_payable_percent' => '10'] as $key => $value) {
    Db::connection('system')->table('sys_site_config')->insert(['site_id' => 991, 'config_key' => $key, 'config_value' => $value]);
}
MerchantContext::set(['admin_id' => 99101, 'site_id' => 991, 'merchant_id' => $merchant, 'account_type' => 2, 'is_owner' => true, 'property_ids' => [$property]]);
$controller = $container->get(App\Controller\Merchant\CommercialPromotionController::class);
$coupon = ['coupon_type' => 1, 'discount_value' => 75000, 'property_ids' => [$property], 'room_type_ids' => [], 'min_nights' => 1, 'min_amount' => 0];
check(MerchantPromotionPolicy::validate(991, $merchant, $coupon)['protectedPercent'] === 10.0, 'promotion baseline protection uses legacy rate');
check($controller->options()['data']['properties'][0]['commission_rate'] === 10.0, 'promotion options show legacy baseline rate');
AdminContext::set(['admin_id' => 902, 'admin_name' => 'Promotion contract tester', 'site_id' => 991, 'is_super' => true]);
$terms = ['expectedVersion' => 0, 'commissionPlan' => 'standard', 'commissionRate' => 30, 'transactionFeeRate' => 0,
    'payAtHotelEnabled' => false, 'noShowFeeEnabled' => false, 'merchantUpfrontRate' => 0,
    'effectiveAt' => '2020-01-01T00:00:00Z', 'reason' => 'Current promotion commission', 'requestId' => 'promotion-current'];
MerchantCommercialSettings::save($merchant, $terms);
rejects(40001, fn () => MerchantPromotionPolicy::validate(991, $merchant, $coupon), 'effective commission increase rejects discount below current protection');
check($controller->options()['data']['properties'][0]['commission_rate'] === 30.0, 'promotion options show effective override instead of baseline');
MerchantCommercialSettings::save($merchant, array_replace($terms, ['expectedVersion' => 1, 'commissionRate' => 50, 'effectiveAt' => '2099-01-01T00:00:00Z', 'requestId' => 'promotion-future']));
check(MerchantPromotionPolicy::validate(991, $merchant, array_replace($coupon, ['discount_value' => 65000]))['protectedPercent'] === 30.0, 'scheduled commission does not prematurely increase promotion protection');
check($controller->options()['data']['properties'][0]['commission_rate'] === 30.0, 'scheduled commission does not appear early in promotion options');
check((float) Db::table('merchant_info')->where('id', $merchant)->value('commission_rate') === 10.0, 'promotion compatibility does not overwrite baseline rate');
$foreign = merchantFixture(992);
rejects(40401, fn () => MerchantPromotionPolicy::validate(991, $foreign, $coupon), 'promotion commission reader enforces same merchant site');
MerchantContext::set(['admin_id' => 99101, 'site_id' => 992, 'merchant_id' => $merchant, 'account_type' => 2, 'is_owner' => true, 'property_ids' => [$property]]);
check($controller->options()['data']['properties'] === [], 'promotion options preserve property site scope');
echo "Commercial promotion commission integration passed.\n";
