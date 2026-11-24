<?php

declare(strict_types=1);

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;

// Included by onboarding-final-approval.php inside its disposable database.
Db::connection('system')->table('sys_site')->updateOrInsert(['id' => 7], [
    'site_name' => 'Stage 4 Yangon', 'status' => 1, 'country_code' => 'MM', 'deleted_at' => null,
]);
$legacy = seedReadyStage4(1, 'LEGACY', 'hotel', 2, '+95940000008', 'stage4-legacy@example.test', $merchantTemplate, $hotelTemplate);
$legacyDoc = (array) Db::table('merchant_verify_document')->where('application_business_id', $legacy['businessIds'][0])->first();
$legacyPrivateTemplate = (int) Db::table('merchant_kyc_template')->insertGetId([
    'site_id' => 1, 'scope_type' => 'property', 'business_type' => 'hotel', 'name' => 'Legacy private checklist',
    'application_business_id' => $legacy['businessIds'][0], 'source_template_id' => $hotelTemplate,
    'docs' => json_encode([['name' => 'Property License', 'doc_type' => 'property_license', 'required' => true]]), 'status' => 1,
]);
Db::table('merchant_application_business')->where('id', $legacy['businessIds'][0])->update(['kyc_template_id' => $legacyPrivateTemplate]);
$legacyRevision = (int) Db::table('merchant_verify_document_revision')->insertGetId([
    'site_id' => 1, 'doc_id' => $legacyDoc['id'], 'version' => 1, 'file_url' => $legacyDoc['file_url'], 'status' => 1,
]);
$legacyEvent = (int) Db::table('merchant_document_event')->insertGetId([
    'site_id' => 1, 'doc_id' => $legacyDoc['id'], 'version' => 1, 'action' => 'verify', 'status' => 1,
    'actor_type' => 'admin', 'actor_id' => 94001,
]);
Db::table('merchant_application_note')->insert(['site_id' => 1, 'application_id' => $legacy['applicationId'], 'note' => 'Keep legacy note']);
Db::table('merchant_verify_timeline')->insert([
    'site_id' => 1, 'merchant_id' => 0, 'application_id' => $legacy['applicationId'], 'action' => 'registration_approved',
    'actor_type' => 2, 'operator_id' => 94001, 'operator_name' => 'Stage 4 Super', 'note' => 'Keep legacy review',
]);
$historyFixture = static function (int $applicationId): int {
    return (int) Db::table('merchant_application_registration_review')->insertGetId([
        'site_id' => 1, 'application_id' => $applicationId, 'round_no' => 1, 'registration_status' => 5,
        'submitted_at' => '2026-10-01 00:00:00', 'reviewed_at' => '2026-10-02 00:00:00',
        'reviewer_id' => 94001, 'reviewer_name' => 'Legacy reviewer', 'review_reason' => 'Keep old refusal',
        'snapshot' => json_encode(['application' => ['company_name' => 'Old registration company'], 'businesses' => []]),
    ]);
};
$historyBoundaryFailures = [];
$expectHistoryBoundary = static function (bool $condition, string $name) use (&$historyBoundaryFailures): void {
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $name . PHP_EOL;
    if (!$condition) $historyBoundaryFailures[] = $name;
};
$legacyHistoryId = $historyFixture($legacy['applicationId']);
$legacyHistoryBefore = (array) Db::table('merchant_application_registration_review')->where('id', $legacyHistoryId)->first();
$legacyBefore = (array) Db::table('merchant_application')->where('id', $legacy['applicationId'])->first();
$legacyResult = $approval->approve($legacy['applicationId'], 'stage4-legacy-site-request', ['email', 'inapp']);
check((int) Db::table('merchant_application')->where('id', $legacy['applicationId'])->value('site_id') === 7
    && (int) Db::table('merchant_info')->where('id', $legacyResult['merchantId'])->value('site_id') === 7
    && (int) Db::table('merchant_admin')->where('id', $legacyResult['accountId'])->value('site_id') === 7,
    'ready legacy application and new merchant/owner move to site 7 during final approval');
$legacyHistoryAfter = (array) Db::table('merchant_application_registration_review')->where('id', $legacyHistoryId)->first();
$expectHistoryBoundary((int) $legacyHistoryAfter['site_id'] === 7
    && array_diff_assoc($legacyHistoryBefore, $legacyHistoryAfter) === ['site_id' => 1],
    'successful legacy migration moves registration history site and preserves every archived value');
check(count($legacyResult['propertyIds']) === 2
    && Db::table('merchant_store')->whereIn('id', $legacyResult['propertyIds'])->where('site_id', 7)->count() === 2
    && Db::table('merchant_application_business')->whereIn('id', $legacy['businessIds'])->where('site_id', 7)->where('kyc_status', 5)->count() === 2,
    'all legacy initial businesses and approved KYC convert into site 7 properties');
check(Db::table('merchant_verify_document')->where('id', $legacyDoc['id'])->where('site_id', 7)->where('status', 1)
    ->where('file_url', $legacyDoc['file_url'])->count() === 1
    && Db::table('merchant_verify_document_revision')->where('id', $legacyRevision)->where('site_id', 7)->where('file_url', $legacyDoc['file_url'])->count() === 1
    && Db::table('merchant_document_event')->where('id', $legacyEvent)->where('site_id', 7)->where('action', 'verify')->count() === 1,
    'legacy documents, revisions and review events keep their IDs and files in the new site');
check(Db::table('merchant_application_note')->where('application_id', $legacy['applicationId'])->where('site_id', 7)->where('note', 'Keep legacy note')->count() === 1
    && Db::table('merchant_verify_timeline')->where('application_id', $legacy['applicationId'])->where('site_id', 7)->where('note', 'Keep legacy review')->count() === 1,
    'legacy notes and review history stay with the application');
check(Db::table('merchant_application_signature')->where('id', $legacyBefore['active_signature_id'])->where('site_id', 7)->where('status', 1)->count() === 1
    && Db::table('merchant_application')->where('id', $legacy['applicationId'])->value('registration_verified_email_at') === $legacyBefore['registration_verified_email_at'],
    'existing signatures and verified contacts remain valid after migration');
check((int) Db::table('merchant_kyc_template')->where('id', $legacyPrivateTemplate)->value('site_id') === 7
    && (int) Db::table('merchant_kyc_template')->where('id', $hotelTemplate)->value('site_id') === 0
    && (int) Db::table('merchant_store')->where('source_business_id', $legacy['businessIds'][0])->value('kyc_template_id') === $legacyPrivateTemplate,
    'application-private checklist moves without changing shared templates or checklist bindings');
$legacyReplay = $approval->approve($legacy['applicationId'], 'stage4-legacy-site-request', ['email', 'inapp']);
check($legacyReplay['merchantId'] === $legacyResult['merchantId']
    && Db::table('merchant_verify_timeline')->where('application_id', $legacy['applicationId'])->where('action', 'onboarding_site_migrated')->count() === 1,
    'legacy approval replay neither creates duplicate merchants nor repeats the migration audit');

$legacyBlocked = seedReadyStage4(1, 'LEGACY-BLOCKED', 'hotel', 1, '+95940000108', 'stage4-legacy-blocked@example.test', $merchantTemplate, $hotelTemplate);
$blockedHistoryId = $historyFixture($legacyBlocked['applicationId']);
Db::table('merchant_application_business')->where('id', $legacyBlocked['businessIds'][0])->update(['kyc_status' => 2]);
stage4Rejects(ErrorCode::DATA_CONFLICT,
    fn () => $approval->approve($legacyBlocked['applicationId'], 'stage4-legacy-blocked-request', ['email']),
    'legacy migration does not bypass KYC readiness');
check((int) Db::table('merchant_application')->where('id', $legacyBlocked['applicationId'])->value('site_id') === 1
    && (int) Db::table('merchant_application_business')->where('id', $legacyBlocked['businessIds'][0])->value('site_id') === 1
    && Db::table('merchant_verify_timeline')->where('application_id', $legacyBlocked['applicationId'])->where('action', 'onboarding_site_migrated')->count() === 0,
    'failed approval rolls back the legacy move and its audit together');
$expectHistoryBoundary((int) Db::table('merchant_application_registration_review')->where('id', $blockedHistoryId)->value('site_id') === 1,
    'KYC readiness rejection leaves registration history in its source site');
AdminContext::set(['admin_id' => 94002, 'site_id' => 1, 'is_super' => false]);
stage4Rejects(ErrorCode::FORBIDDEN,
    fn () => $approval->approve($legacyBlocked['applicationId'], 'stage4-legacy-ordinary-request', ['email']),
    'ordinary administrators cannot move and approve a legacy application');
$expectHistoryBoundary((int) Db::table('merchant_application_registration_review')->where('id', $blockedHistoryId)->value('site_id') === 1,
    'ordinary administrator rejection leaves registration history in its source site');
AdminContext::set(['admin_id' => 94001, 'admin_name' => 'Stage 4 Super', 'site_id' => 0, 'is_super' => true]);

Db::connection('system')->table('sys_site')->where('id', 7)->update(['status' => 2]);
stage4Rejects(ErrorCode::DATA_CONFLICT,
    fn () => $approval->approve($legacyBlocked['applicationId'], 'stage4-legacy-disabled-request', ['email']),
    'legacy applications cannot move into a disabled target site');
Db::connection('system')->table('sys_site')->where('id', 7)->update(['status' => 1]);

$legacyMixed = seedReadyStage4(1, 'LEGACY-MIXED', 'hotel', 1, '+95940000208', 'stage4-legacy-mixed@example.test', $merchantTemplate, $hotelTemplate);
Db::table('merchant_application_business')->where('id', $legacyMixed['businessIds'][0])->update(['site_id' => 6]);
stage4Rejects(ErrorCode::DATA_CONFLICT,
    fn () => $approval->approve($legacyMixed['applicationId'], 'stage4-legacy-mixed-request', ['email']),
    'legacy approval refuses a business belonging to another site');
check((int) Db::table('merchant_application')->where('id', $legacyMixed['applicationId'])->value('site_id') === 1
    && (int) Db::table('merchant_application_business')->where('id', $legacyMixed['businessIds'][0])->value('site_id') === 6,
    'mixed ownership rejection leaves both sites unchanged');

$legacyShared = seedReadyStage4(1, 'LEGACY-SHARED', 'hotel', 1, '+95940000308', 'stage4-legacy-shared@example.test', $merchantTemplate, $hotelTemplate);
$legacySharedTemplate = (int) Db::table('merchant_kyc_template')->insertGetId([
    'site_id' => 1, 'scope_type' => 'property', 'business_type' => 'hotel', 'name' => 'Source site public checklist',
    'docs' => json_encode([['name' => 'Property License', 'doc_type' => 'property_license', 'required' => true]]), 'status' => 1,
]);
Db::table('merchant_application_business')->where('id', $legacyShared['businessIds'][0])->update(['kyc_template_id' => $legacySharedTemplate]);
stage4Rejects(ErrorCode::DATA_CONFLICT,
    fn () => $approval->approve($legacyShared['applicationId'], 'stage4-legacy-shared-request', ['email']),
    'source-site public checklists cannot be silently shared into another site');
check((int) Db::table('merchant_kyc_template')->where('id', $legacySharedTemplate)->value('site_id') === 1,
    'refused migration preserves source-site public resources');

$legacyDuplicate = seedReadyStage4(1, 'LEGACY-DUPLICATE', 'hotel', 1, '+95940000408', 'stage4-legacy-duplicate@example.test', $merchantTemplate, $hotelTemplate);
$duplicateHistoryId = $historyFixture($legacyDuplicate['applicationId']);
Db::table('merchant_application')->where('id', $legacyDuplicate['applicationId'])->update(['reg_number' => 'STAGE4-COLLISION']);
try {
    $approval->approve($legacyDuplicate['applicationId'], 'stage4-legacy-duplicate-request', ['email']);
    throw new RuntimeException('Duplicate registration unexpectedly approved');
} catch (Hyperf\Database\Exception\QueryException $exception) {
    check(str_contains($exception->getMessage(), 'uk_credit_code'), 'legacy migration retains real registration-number uniqueness');
}
check((int) Db::table('merchant_application')->where('id', $legacyDuplicate['applicationId'])->value('site_id') === 1
    && Db::table('merchant_application_business')->where('application_id', $legacyDuplicate['applicationId'])->where('site_id', 1)->count() === 1
    && Db::table('merchant_application_signature')->where('application_id', $legacyDuplicate['applicationId'])->where('site_id', 1)->count() === 1
    && Db::table('merchant_verify_document')->where('application_id', $legacyDuplicate['applicationId'])->where('site_id', 1)->count() === 2
    && Db::table('merchant_verify_timeline')->where('application_id', $legacyDuplicate['applicationId'])->where('action', 'onboarding_site_migrated')->count() === 0,
    'a later entity insertion failure rolls back migrated application, KYC, signatures and audit');

$expectHistoryBoundary((int) Db::table('merchant_application_registration_review')->where('id', $duplicateHistoryId)->value('site_id') === 1,
    'later entity insertion failure rolls registration history ownership back with the application');

$legacyTerms = seedReadyStage4(1, 'LEGACY-TERMS', 'hotel', 1, '+95940000508', 'stage4-legacy-terms@example.test', $merchantTemplate, $hotelTemplate);
$targetAgreement = (int) Db::table('merchant_onboarding_agreement')->insertGetId([
    'site_id' => 7, 'agreement_version' => 'stage4-target-v2', 'title' => 'Different target agreement',
    'content' => 'Target site-specific terms', 'content_sha256' => hash('sha256', 'Target site-specific terms'),
    'status' => 1, 'effective_at' => '2026-09-16 00:00:00', 'created_by' => 94001,
]);
try {
    $approval->approve($legacyTerms['applicationId'], 'stage4-legacy-terms-request', ['email']);
    throw new RuntimeException('Old terms unexpectedly satisfied different target terms');
} catch (\Mtrip\Shared\Exception\BusinessException $exception) {
    check($exception->getCode() === ErrorCode::DATA_CONFLICT && str_contains($exception->getMessage(), '单独迁移'),
        'different target terms require explicit migration and re-signing instead of an unresolvable approval retry');
}
check((int) Db::table('merchant_application')->where('id', $legacyTerms['applicationId'])->value('site_id') === 1
    && Db::table('merchant_application_signature')->where('application_id', $legacyTerms['applicationId'])->where('site_id', 1)->where('status', 1)->count() === 1,
    'different target terms neither rewrite consent nor commit a partial migration');
Db::table('merchant_onboarding_agreement')->where('id', $targetAgreement)->update(['status' => 2]);

check($historyBoundaryFailures === [], 'registration history follows atomic legacy site migration boundaries');
