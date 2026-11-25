<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';
// Load the current source under a test-only name, independent of the running proxy cache.
require __DIR__ . '/ApprovedUiVerifyController.php';

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Constants\ErrorCode;

$controller = new App\Controller\Admin\ApprovedUiVerifyController();
foreach (['request' => Hyperf\HttpServer\Contract\RequestInterface::class, 'config' => Hyperf\Contract\ConfigInterface::class] as $property => $dependency) {
    (new ReflectionProperty(App\Controller\AbstractController::class, $property))->setValue($controller, $container->get($dependency));
}
AdminContext::set(['admin_id' => 92001, 'admin_name' => 'Approved Reviewer', 'site_id' => 991, 'is_super' => false]);
Db::beginTransaction();
try {
    $merchant = merchantFixture(991, 3);
    Db::table('merchant_info')->where('id', $merchant)->update(['audit_by' => 1, 'access_code' => 'PRIVATE-TEST-CODE', 'audit_time' => '2026-11-16 09:47:22']);
    $application = (int) Db::table('merchant_application')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchant, 'app_no' => 'APP-APPROVED-TEST', 'company_name' => 'Approved Company',
        'submitted_at' => '2026-11-15 08:20:00', 'assigned_ops_id' => 0, 'assigned_ops_name' => 'stale name',
        'state_model_version' => 1, 'account_status' => 1, 'final_approved_at' => '2026-11-16 09:47:22',
    ]);
    $business = (int) Db::table('merchant_application_business')->insertGetId([
        'site_id' => 991, 'application_id' => $application, 'business_name' => 'Approved Hotel', 'business_type' => 'hotel',
    ]);
    Db::table('merchant_kyc_template')->insert(['site_id' => 0, 'scope_type' => 'property', 'name' => 'Hotel', 'business_type' => 'hotel',
        'docs' => json_encode([['doc_type' => 'hotel_license', 'name' => 'Hotel License', 'required' => true]])]);
    foreach ([['merchant', 0, 'business_registration'], ['property', $business, 'hotel_license']] as [$scope, $businessId, $type]) {
        Db::table('merchant_verify_document')->insert([
            'site_id' => 991, 'merchant_id' => $merchant, 'application_id' => $application, 'scope_type' => $scope,
            'application_business_id' => $businessId, 'scope_model_version' => 1, 'doc_type' => $type,
            'name' => 'Readable ' . $type, 'file_url' => 'uploads/approved-test.pdf', 'status' => 1,
        ]);
    }
    Db::table('merchant_verify_timeline')->insert(['site_id' => 991, 'merchant_id' => $merchant, 'action' => 'final_approved', 'operator_name' => 'Actual Approver']);
    Db::table('merchant_credential_delivery')->insert([
        'site_id' => 991, 'application_id' => $application, 'merchant_id' => $merchant, 'account_id' => 1,
        'approval_request_id' => 'approved-test', 'channel' => 'email', 'credential_ciphertext' => 'PRIVATE-CIPHERTEXT',
        'recipient_ciphertext' => 'PRIVATE-RECIPIENT', 'payload_hash' => str_repeat('a', 64), 'status' => 'pending',
    ]);
    // Deliberately inconsistent foreign-site rows must never enter the approved read model.
    Db::table('merchant_application')->insert(['site_id' => 992, 'merchant_id' => $merchant, 'app_no' => 'APP-FOREIGN', 'company_name' => 'Foreign', 'assigned_ops_id' => 1, 'assigned_ops_name' => 'Foreign Operator']);
    Db::table('merchant_verify_document')->insert(['site_id' => 992, 'merchant_id' => $merchant, 'doc_type' => 'foreign', 'file_url' => 'foreign.pdf']);
    Db::table('merchant_verify_timeline')->insert(['site_id' => 992, 'merchant_id' => $merchant, 'action' => 'approved', 'operator_name' => 'Foreign Approver']);

    setRequest(['tab' => 'approved']);
    $list = $controller->index()['data']['list'];
    check(count($list) === 1 && $list[0]['assigned_ops_name'] === '' && (int) $list[0]['audit_by'] === 1, 'unassigned operator never falls back to reviewer ID or stale name');
    check($list[0]['application_no'] === 'APP-APPROVED-TEST' && $list[0]['application_submitted_at'] === '2026-11-15 08:20:00', 'submitted timestamp and application match the merchant site');
    Db::table('merchant_application')->where('id', $application)->update(['assigned_ops_id' => 12, 'assigned_ops_name' => 'Actual Operator']);
    check($controller->index()['data']['list'][0]['assigned_ops_name'] === 'Actual Operator', 'assigned operator uses the application snapshot name');
    setRequest(['id' => $merchant]);
    $detail = $controller->detail()['data'];
    check($detail['merchant']['company_name'] === 'Approved Company' && (int) $detail['merchant']['approval_account_status'] === 1, 'company and pending activation status use actual application values');
    check($detail['merchant']['approved_by_name'] === 'Actual Approver', 'approver name uses the same-site final approval event');
    check(count($detail['documents']) === 2 && count($detail['timeline']) === 1, 'foreign-site documents and history are excluded');
    check((int) $detail['businesses'][0]['kyc_status'] === 1, 'new scope files with empty biz_unit verify the correct application business');
    check($detail['access_grant']['receipts'] === [['channel' => 'email', 'status' => 'pending', 'attempts' => 0]], 'delivery receipts expose channel, actual status and attempt count only');
    check(! str_contains(json_encode($detail), 'PRIVATE-'), 'details never expose access codes or encrypted delivery payloads');
    Db::table('merchant_credential_delivery')->where('application_id', $application)->update(['status' => 'accepted', 'attempts' => 1]);
    Db::table('merchant_application')->where('id', $application)->update(['account_status' => 2]);
    $activated = $controller->detail()['data'];
    check($activated['access_grant']['receipts'][0]['status'] === 'accepted' && (int) $activated['merchant']['approval_account_status'] === 2, 'activation preserves provider acceptance instead of fabricating a delivery confirmation');
    setMerchantAuthTestMode($config, true, true, 'test');
    check($controller->detail()['data']['access_grant']['delivery_test_mode'] === true, 'read model exposes the current test delivery policy');
    setMerchantAuthTestMode($config, true, true, 'production');
    check($controller->detail()['data']['access_grant']['delivery_test_mode'] === false, 'production cannot present test delivery policy as enabled');
    Db::table('merchant_verify_document')->where('doc_type', 'hotel_license')->update(['scope_type' => 'merchant', 'biz_unit' => (string) $business, 'scope_resolution_status' => 1]);
    check((int) $controller->detail()['data']['businesses'][0]['kyc_status'] === 1, 'migrated legacy biz_unit retains its explicit application business link');
    Db::table('merchant_verify_document')->where('doc_type', 'hotel_license')->update(['scope_model_version' => 0, 'application_business_id' => 0]);
    check((int) $controller->detail()['data']['businesses'][0]['kyc_status'] === 1, 'legacy biz_unit files remain compatible');
    $property = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchant, 'source_business_id' => $business, 'business_type' => 'hotel', 'store_name' => 'Approved Hotel',
    ]);
    $revision = (int) Db::table('merchant_property_content_revision')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchant, 'property_id' => $property, 'version' => 1, 'status' => 1,
        'submitted_at' => '2026-11-25 10:05:02', 'payload_json' => '{}',
    ]);
    $pending = static fn () => $controller->detail()['data']['businesses'][0]['pending_profile_revision'] ?? null;
    check($pending() === null, 'verification permission alone does not expose a pending revision');
    AdminContext::set(AdminContext::get() + ['permissions' => ['merchant:property:content-list']]);
    $summary = $pending();
    check($summary !== null && (int) $summary['id'] === $revision && $summary['submitted_at'] === '2026-11-25 10:05:02', 'approved hotel exposes the actual mapped pending revision and its submission time');
    foreach ([['merchant_store', $property, 'site_id', 992, 991],
        ['merchant_store', $property, 'merchant_id', $merchant + 1, $merchant],
        ['merchant_store', $property, 'source_business_id', null, $business],
        ['merchant_store', $property, 'deleted_at', '2026-11-25 12:00:00', null],
        ['merchant_store', $property, 'business_type', 'restaurant', 'hotel'],
        ['merchant_application_business', $business, 'business_type', 'restaurant', 'hotel'],
        ['merchant_property_content_revision', $revision, 'site_id', 992, 991],
        ['merchant_property_content_revision', $revision, 'merchant_id', $merchant + 1, $merchant],
        ['merchant_property_content_revision', $revision, 'status', 0, 1],
        ['merchant_property_content_revision', $revision, 'status', 2, 1],
        ['merchant_property_content_revision', $revision, 'status', 3, 1],
        ['merchant_property_content_revision', $revision, 'status', 4, 1],
        ['merchant_info', $merchant, 'status', 0, 3],
    ] as [$table, $id, $field, $value, $original]) {
        Db::table($table)->where('id', $id)->update([$field => $value]);
        check($pending() === null, "ineligible $table.$field ($value) hides pending review");
        Db::table($table)->where('id', $id)->update([$field => $original]);
    }
    AdminContext::set(['admin_id' => 92002, 'site_id' => 992, 'is_super' => false]);
    rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $controller->detail(), 'foreign-site operator cannot open the merchant detail');
} finally {
    Db::rollBack();
}
echo "Approved detail checks passed\n";
