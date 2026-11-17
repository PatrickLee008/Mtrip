<?php

declare(strict_types=1);

require '/tmp/M12CommercialBootstrap.php';
require '/tmp/CommercialMerchantController.php';

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Merchant\MerchantCommercialSettings;

$controller = $container->get(App\Controller\Admin\CommercialMerchantController::class);
function commercialCall(string $method, array $params): array {
    global $controller;
    setRequest($params);
    return $controller->$method()['data'];
}
function termsInput(int $id, array $overrides = []): array {
    return array_replace([
        'id' => $id, 'expectedVersion' => 0, 'commissionPlan' => 'premium', 'commissionRate' => '8',
        'transactionFeeRate' => '2', 'payAtHotelEnabled' => true, 'noShowFeeEnabled' => true,
        'merchantUpfrontRate' => '20', 'effectiveAt' => '2020-01-01T08:00:00+08:00',
        'reason' => '  Synthetic contract  ', 'requestId' => 'commercial-first',
    ], $overrides);
}
AdminContext::set(['admin_id' => 902, 'admin_name' => 'Commercial tester', 'site_id' => 991, 'is_super' => true]);
$id = merchantFixture();
$foreign = merchantFixture(992);
$closed = merchantFixture(991, 5);
$baseline = commercialCall('commercialSettings', ['id' => $id]);
check($baseline['merchant_id'] === $id && $baseline['latest_version'] === 0, 'legacy starts at revision zero');
check($baseline['current']['commission_plan'] === null && $baseline['current']['effective_at'] === null, 'legacy null plan preserved');
check($baseline['current']['transaction_fee_rate'] === '0.00' && $baseline['current']['pay_at_hotel_enabled'] === false && $baseline['next'] === null, 'legacy extra terms default safely');
$first = commercialCall('saveCommercialSettings', termsInput($id));
check($first['latest_version'] === 1 && $first['current']['commission_rate'] === '8.00', 'save then read applicable configuration');
check(commercialCall('commercialSettings', ['id' => $id]) === $first, 'fresh read matches saved configuration');
check($first['current']['created_by_name'] === 'Commercial tester' && $first['current']['reason'] === 'Synthetic contract' && $first['current']['effective_at'] === '2020-01-01 00:00:00', 'actor reason and UTC effective time recorded');
check(commercialCall('saveCommercialSettings', termsInput($id)) === $first, 'identical request retries succeed despite original expected version');
rejects(40901, fn () => commercialCall('saveCommercialSettings', termsInput($id, ['commissionRate' => '9'])), 'request identity cannot change payload');
rejects(40901, fn () => commercialCall('saveCommercialSettings', termsInput($id, ['requestId' => 'stale'])), 'stale revision rejected');
$future = commercialCall('saveCommercialSettings', termsInput($id, ['expectedVersion' => 1, 'requestId' => 'scheduled', 'commissionPlan' => 'vip', 'commissionRate' => '12', 'effectiveAt' => '2099-01-01T00:00:00Z', 'reason' => 'Scheduled contract']));
check($future['latest_version'] === 2 && $future['current']['version'] === 1 && $future['next']['version'] === 2, 'scheduled terms separated from currently effective terms');
check((float) Db::table('merchant_info')->where('id', $id)->value('commission_rate') !== 12.0, 'future save does not publish baseline rates early');
$effective = MerchantCommercialSettings::effectiveMany([(array) Db::table('merchant_info')->where('id', $id)->first()]);
check($effective[$id]['commission_plan'] === 'premium' && $effective[$id]['commission_rate'] === '8.00', 'batch directory resolver selects effective terms');
$history = commercialCall('commercialSettingsHistory', ['id' => $id, 'page' => 1, 'pageSize' => 1]);
check($history['total'] === 2 && count($history['list']) === 1 && $history['list'][0]['version'] === 2 && $history['pageSize'] === 1, 'history is paginated latest revision first');
check($history['list'][0]['merchant_upfront_rate'] === '20.00' && $history['list'][0]['transaction_fee_rate'] === '2.00' && $history['list'][0]['no_show_fee_enabled'] === true, 'history retains complete saved terms');
rejects(40901, fn () => commercialCall('saveCommercialSettings', termsInput($closed)), 'closed merchant cannot save');
rejects(40001, fn () => commercialCall('commission', ['id' => $id, 'commissionRate' => 99]), 'legacy commission endpoint cannot bypass history');
check((int) Db::table('merchant_info')->where('id', $id)->value('commercial_version') === 2, 'rejections and retries create no revision');
AdminContext::set(['admin_id' => 902, 'site_id' => 991, 'is_super' => false, 'permissions' => ['merchant:list:list']]);
rejects(40301, fn () => MerchantCommercialSettings::save($id, termsInput($id)), 'service enforces write permission');
rejects(40301, fn () => commercialCall('commission', ['id' => $id, 'commissionRate' => 10]), 'deprecated endpoint still enforces edit permission');
rejects(40302, fn () => MerchantCommercialSettings::read($foreign), 'service enforces read site isolation');
AdminContext::set(['admin_id' => 902, 'site_id' => 991, 'is_super' => false, 'permissions' => ['merchant:list:edit']]);
rejects(40302, fn () => MerchantCommercialSettings::save($foreign, termsInput($foreign)), 'service enforces write site isolation');
rejects(40301, fn () => MerchantCommercialSettings::read($id), 'service enforces read permission');
rejects(40301, fn () => MerchantCommercialSettings::history($id, 1, 10), 'service history enforces read permission');
AdminContext::set(['admin_id' => 902, 'site_id' => 991, 'is_super' => true]);
$backdated = commercialCall('saveCommercialSettings', termsInput($id, ['expectedVersion' => 2, 'requestId' => 'backdate', 'effectiveAt' => '2019-01-01T00:00:00Z', 'commissionRate' => '5']));
check($backdated['latest_version'] === 3 && $backdated['current']['version'] === 1, 'latest saved revision does not override later effective time');
$tied = commercialCall('saveCommercialSettings', termsInput($id, ['expectedVersion' => 3, 'requestId' => 'same-time', 'commissionRate' => '9']));
check($tied['current']['version'] === 4 && $tied['current']['commission_rate'] === '9.00', 'equal effective times choose later saved version');
check(Db::table('merchant_activity_log')->where('merchant_id', $id)->count() === 4, 'successful revisions create activity audit once');
// Audit insertion is part of the same transaction, including the revision counter.
Db::statement("ALTER TABLE merchant_activity_log ADD CONSTRAINT commercial_audit_failure CHECK (description <> 'Commercial v5: Synthetic contract')");
try {
    try {
        MerchantCommercialSettings::save($id, termsInput($id, ['expectedVersion' => 4, 'requestId' => 'atomic-rollback']));
        throw new RuntimeException('Expected synthetic audit failure');
    } catch (Hyperf\Database\Exception\QueryException $e) {
        check(str_contains($e->getMessage(), 'commercial_audit_failure'), 'audit failure reaches save transaction');
    }
} finally {
    Db::statement('ALTER TABLE merchant_activity_log DROP CHECK commercial_audit_failure');
}
check((int) Db::table('merchant_info')->where('id', $id)->value('commercial_version') === 4
    && ! Db::table('merchant_commercial_config')->where('merchant_id', $id)->where('request_id', 'atomic-rollback')->exists(), 'audit failure rolls back config and latest revision atomically');
echo "Commercial configuration integration passed.\n";
