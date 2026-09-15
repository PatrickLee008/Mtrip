<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\OnboardingCredentialDeliveryService;
use App\Service\OnboardingFinalApprovalService;
use App\Service\OnboardingKycService;
use App\Service\OnboardingAdminContactService;
use App\Service\MerchantAuthTestMode;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Support\CryptoHelper;

use function Hyperf\Config\config;

class Stage4Delivery extends OnboardingCredentialDeliveryService
{
    public bool $emailSucceeds = false;

    protected function deliverEmail(int $siteId, string $recipient, array $payload): array
    {
        return $this->emailSucceeds
            ? ['ok' => true, 'receipt' => 'test-email', 'error' => '']
            : ['ok' => false, 'receipt' => '', 'error' => 'test-email-failure'];
    }
}

class Stage4Approval extends OnboardingFinalApprovalService
{
    /** @var list<string> */
    public array $candidates = [];

    protected function accessCodeCandidate(string $prefix): string
    {
        return array_shift($this->candidates) ?? parent::accessCodeCandidate($prefix);
    }
}

/** @return array{applicationId:int,businessIds:list<int>} */
function seedReadyStage4(int $siteId, string $suffix, string $type, int $propertyCount, string $phone, string $email, int $merchantTemplate, int $propertyTemplate): array
{
    $aes = (string) config('mtrip.aes_key');
    $applicationId = (int) Db::table('merchant_application')->insertGetId([
        'site_id' => $siteId, 'app_no' => 'APP-STAGE4-' . $suffix,
        'merchant_name' => 'Stage 4 Merchant ' . $suffix, 'company_name' => 'Stage 4 Company ' . $suffix,
        'reg_number' => 'STAGE4-REG-' . $suffix, 'country' => 'Myanmar', 'address' => 'Stage 4 HQ ' . $suffix,
        'business_types' => $type, 'primary_business_type' => $type, 'num_businesses' => $propertyCount,
        'registration_channel' => 'email', 'registration_contact_hash' => hash('sha256', $email),
        'registration_phone' => CryptoHelper::encrypt($phone, $aes), 'registration_phone_index' => hash('sha256', $phone),
        'registration_email' => CryptoHelper::encrypt($email, $aes), 'registration_email_index' => hash('sha256', $email),
        'contact_data_status' => 0, 'registration_status' => 3, 'merchant_kyc_status' => 5,
        'account_status' => 0, 'state_model_version' => 1, 'kyc_template_id' => $merchantTemplate,
    ]);
    $businessIds = [];
    for ($index = 1; $index <= $propertyCount; ++$index) {
        $businessId = (int) Db::table('merchant_application_business')->insertGetId([
            'site_id' => $siteId, 'application_id' => $applicationId, 'client_ref' => $suffix . '-' . $index,
            'business_name' => 'Stage 4 Property ' . $suffix . '-' . $index, 'business_type' => $type,
            'contact_name' => 'Stage Four Owner', 'contact_phone' => CryptoHelper::encrypt($phone, $aes),
            'contact_phone_index' => hash('sha256', $phone), 'contact_email' => $email,
            'city' => 'Yangon', 'country_code' => 'MM', 'city_key' => 'yangon', 'address' => 'Property ' . $index,
            'kyc_scope' => 2, 'kyc_status' => 5, 'kyc_template_id' => $propertyTemplate,
            'kyc_version' => 1, 'kyc_submitted_at' => gmdate('Y-m-d H:i:s'), 'kyc_approved_at' => gmdate('Y-m-d H:i:s'),
        ]);
        $businessIds[] = $businessId;
        Db::table('merchant_verify_document')->insert([
            'site_id' => $siteId, 'merchant_id' => 0, 'scope_type' => 'property', 'property_id' => 0,
            'application_id' => $applicationId, 'application_business_id' => $businessId,
            'scope_resolution_status' => 0, 'scope_model_version' => 1, 'doc_type' => 'property_license',
            'name' => 'Property License', 'file_url' => '/test/property-' . $businessId . '.pdf', 'status' => 1,
        ]);
    }
    Db::table('merchant_verify_document')->insert([
        'site_id' => $siteId, 'merchant_id' => 0, 'scope_type' => 'merchant', 'property_id' => 0,
        'application_id' => $applicationId, 'application_business_id' => 0,
        'scope_resolution_status' => 0, 'scope_model_version' => 1, 'doc_type' => 'business_reg',
        'name' => 'Business Registration', 'file_url' => '/test/merchant-' . $applicationId . '.pdf', 'status' => 1,
    ]);
    $agreement = Db::table('merchant_onboarding_agreement')->where('site_id', 0)->where('status', 1)->orderByDesc('id')->first();
    $signatureId = (int) Db::table('merchant_application_signature')->insertGetId([
        'site_id' => $siteId, 'application_id' => $applicationId, 'agreement_id' => $agreement->id,
        'agreement_version' => $agreement->agreement_version, 'agreement_sha256' => $agreement->content_sha256,
        'signer_name' => 'Stage Four Owner', 'signer_role' => 'Owner', 'signature_file_url' => '/test/signature.png',
        'signature_sha256' => hash('sha256', 'signature-' . $suffix), 'terms_read_at' => gmdate('Y-m-d H:i:s'),
        'signed_at' => gmdate('Y-m-d H:i:s'), 'status' => 1,
    ]);
    Db::table('merchant_application')->where('id', $applicationId)->update(['active_signature_id' => $signatureId]);
    return ['applicationId' => $applicationId, 'businessIds' => $businessIds];
}

function stage4Rejects(int $code, callable $callback, string $message): void
{
    rejects($code, $callback, $message);
}

$siteId = 994;
$config->set('mtrip.merchant_auth_test_mode', false);
$kyc = $container->get(OnboardingKycService::class);
$delivery = new Stage4Delivery();
$approval = new Stage4Approval($kyc, $delivery);
AdminContext::set([
    'admin_id' => 94001, 'admin_name' => 'Stage 4 Super', 'site_id' => 0, 'is_super' => true,
    'permissions' => ['merchant:onboarding:final-approve', 'merchant:onboarding:credential-retry'],
]);

$merchantTemplate = (int) Db::table('merchant_kyc_template')->insertGetId([
    'site_id' => 0, 'scope_type' => 'merchant', 'name' => 'Stage 4 Merchant KYC', 'business_type' => 'unified',
    'docs' => json_encode([['name' => 'Business Registration', 'doc_type' => 'business_reg', 'required' => true]]),
    'status' => 1, 'sort' => 1,
]);
$hotelTemplate = (int) Db::table('merchant_kyc_template')->insertGetId([
    'site_id' => 0, 'scope_type' => 'property', 'name' => 'Stage 4 Hotel KYC', 'business_type' => 'hotel',
    'docs' => json_encode([['name' => 'Property License', 'doc_type' => 'property_license', 'required' => true]]),
    'status' => 1, 'sort' => 1,
]);
$carTemplate = (int) Db::table('merchant_kyc_template')->insertGetId([
    'site_id' => 0, 'scope_type' => 'property', 'name' => 'Stage 4 Car KYC', 'business_type' => 'car_rental',
    'docs' => json_encode([['name' => 'Property License', 'doc_type' => 'property_license', 'required' => true]]),
    'status' => 1, 'sort' => 2,
]);
Db::table('merchant_onboarding_agreement')->insert([
    'site_id' => 0, 'agreement_version' => 'stage4-v1', 'title' => 'Stage 4 Agreement',
    'content' => 'Stage 4 test agreement', 'content_sha256' => hash('sha256', 'Stage 4 test agreement'),
    'status' => 1, 'effective_at' => '2026-09-15 00:00:00', 'created_by' => 94001,
]);

Db::connection('system')->table('sys_email_channel')->update(['status' => 2]);
    Db::table('merchant_info')->insert([
        'merchant_code' => 'MCH-9400', 'site_id' => $siteId, 'merchant_name' => 'Collision Merchant',
        'credit_code' => 'STAGE4-COLLISION', 'legal_person' => '', 'contact_name' => '', 'contact_phone' => '',
        'access_code' => 'haaaaa', 'status' => 1,
    ]);
    $seed = seedReadyStage4($siteId, '001', 'hotel', 2, '+95940000001', 'stage4-one@example.test', $merchantTemplate, $hotelTemplate);
    $approval->candidates = ['HAAAAA', 'HBBBBB'];
    $result = $approval->approve($seed['applicationId'], 'stage4-request-001', ['email', 'inapp']);
    check(preg_match('/^H[A-Z0-9]{5}$/D', $result['accessCode']) === 1 && $result['accessCode'] === 'HBBBBB', 'hotel access code retries a case-insensitive collision');
    check(count($result['propertyIds']) === 2, 'all initial businesses convert to formal properties');
    check(Db::table('merchant_store')->where('merchant_id', $result['merchantId'])->whereIn('source_business_id', $seed['businessIds'])->count() === 2,
        'each initial business has a unique source_business_id mapping');
    $app = (array) Db::table('merchant_application')->where('id', $seed['applicationId'])->first();
    check((int) $app['merchant_id'] === $result['merchantId'] && (int) $app['account_status'] === 1 && $app['final_approval_request_id'] === 'stage4-request-001',
        'application records merchant, pending activation, and idempotency request');
    $account = (array) Db::table('merchant_admin')->where('id', $result['accountId'])->first();
    check((int) $account['status'] === 2 && (int) $account['is_owner'] === 1, 'owner account is created but cannot log in before activation');
    $aes = (string) config('mtrip.aes_key');
    check(CryptoHelper::decrypt($account['mobile'], $aes) === '+95940000001'
        && CryptoHelper::decrypt($account['email'], $aes) === 'stage4-one@example.test', 'owner account preserves verified phone and email');
    check(Db::table('merchant_verify_document')->where('application_id', $seed['applicationId'])->where('merchant_id', $result['merchantId'])->count() === 3
        && Db::table('merchant_verify_document')->where('application_id', $seed['applicationId'])->where('scope_type', 'property')->where('property_id', 0)->count() === 0,
        'onboarding documents attach to the formal merchant and properties');
    check(Db::table('merchant_credential_delivery')->where('application_id', $seed['applicationId'])->count() === 2
        && Db::table('merchant_credential_delivery')->where('application_id', $seed['applicationId'])->where('channel', 'email')->value('status') === 'failed'
        && Db::table('merchant_credential_delivery')->where('application_id', $seed['applicationId'])->where('channel', 'inapp')->value('status') === 'delivered',
        'outbox records real per-channel failure and delivery states');
    check(! str_contains((string) Db::table('merchant_notify')->where('merchant_id', $result['merchantId'])->value('message'), 'temporaryPassword'),
        'in-app notification does not persist the temporary password');

    $same = $approval->approve($seed['applicationId'], 'stage4-request-001', ['email', 'inapp']);
    check($same['merchantId'] === $result['merchantId'] && Db::table('merchant_info')->where('credit_code', 'STAGE4-REG-001')->count() === 1,
        'same final approval request is idempotent');
    stage4Rejects(ErrorCode::DATA_CONFLICT, fn () => $approval->approve($seed['applicationId'], 'stage4-request-other', ['email']),
        'different request id cannot repeat final approval');

    $failedDeliveryId = (int) Db::table('merchant_credential_delivery')->where('application_id', $seed['applicationId'])->where('channel', 'email')->value('id');
    $delivery->emailSucceeds = true;
    $retried = $delivery->retry($failedDeliveryId);
    check($retried['status'] === 'delivered' && $retried['attempts'] === 3, 'failed credential delivery can be retried safely');
    Db::table('merchant_credential_delivery')->where('id', $failedDeliveryId)->update([
        'status' => 'processing', 'locked_at' => gmdate('Y-m-d H:i:s'),
    ]);
    $lockedRetry = $delivery->retry($failedDeliveryId);
    check($lockedRetry['status'] === 'processing' && $lockedRetry['attempts'] === 3,
        'manual retry respects an active delivery lock');

    $car = seedReadyStage4($siteId, '002', 'car_rental', 1, '+95940000002', 'stage4-car@example.test', $merchantTemplate, $carTemplate);
    $carResult = $approval->approve($car['applicationId'], 'stage4-request-002', ['email']);
    check(preg_match('/^C[A-Z0-9]{5}$/D', $carResult['accessCode']) === 1, 'car-rental application receives a C access code');

    $adminLead = seedReadyStage4($siteId, 'ADMIN', 'hotel', 1, '+95940000005', 'stage4-admin@example.test', $merchantTemplate, $hotelTemplate);
    $adminFields = (new OnboardingAdminContactService())->fields($siteId, '+95940000005', 'stage4-admin@example.test', $adminLead['applicationId']);
    Db::table('merchant_application')->where('id', $adminLead['applicationId'])->update($adminFields);
    $adminApp = (array) Db::table('merchant_application')->where('id', $adminLead['applicationId'])->first();
    check($kyc->readiness($adminApp)['ready'], 'admin-confirmed contacts satisfy final approval readiness');
    foreach ([['contact_data_status' => 1], ['registration_phone' => ''], ['registration_email' => ''], ['registration_channel' => '']] as $invalid) {
        check(in_array('registration_contacts_not_verified', $kyc->readiness(array_replace($adminApp, $invalid))['reasons'], true),
            'readiness explains incomplete contacts: ' . key($invalid));
    }
    stage4Rejects(ErrorCode::DATA_CONFLICT, fn () => $approval->approve($adminLead['applicationId'], 'stage4-admin-request', ['sms']),
        'admin confirmation does not redirect credentials away from its designated email channel');
    $adminResult = $approval->approve($adminLead['applicationId'], 'stage4-admin-request', []);
    $adminAccount = (array) Db::table('merchant_admin')->where('id', $adminResult['accountId'])->first();
    check(CryptoHelper::decrypt($adminAccount['email'], $aes) === 'stage4-admin@example.test'
        && CryptoHelper::decrypt($adminAccount['mobile'], $aes) === '+95940000005' && (int) $adminAccount['status'] === 2,
        'admin-confirmed lead creates the correct owner account pending activation');
    check(Db::table('merchant_credential_delivery')->where('application_id', $adminLead['applicationId'])->where('channel', 'email')->exists()
        && Db::table('merchant_credential_delivery')->where('application_id', $adminLead['applicationId'])->where('channel', 'inapp')->exists(),
        'admin-confirmed lead defaults to email and in-app credential delivery');

    stage4Rejects(ErrorCode::FORBIDDEN, fn () => $delivery->testCredentials($adminLead['applicationId']),
        'credential viewing is disabled by default');
    $config->set('app_env', 'test');
    $config->set('mtrip.merchant_auth_test_mode', true);
    $testLead = seedReadyStage4($siteId, 'TESTMODE', 'hotel', 1, '+95940000006', 'stage4-testmode@example.test', $merchantTemplate, $hotelTemplate);
    $testResult = $approval->approve($testLead['applicationId'], 'stage4-testmode-request', ['email', 'inapp']);
    $emailRow = Db::table('merchant_credential_delivery')->where('application_id', $testLead['applicationId'])->where('channel', 'email')->first();
    check($testResult['testMode'] && $emailRow->status === 'pending' && (int) $emailRow->attempts === 0,
        'test final approval skips external delivery without pretending it succeeded');
    $credentials = $delivery->testCredentials($testLead['applicationId']);
    check($credentials['accessCode'] === $testResult['accessCode'] && $credentials['email'] === 'stage4-testmode@example.test'
        && $credentials['testOtpCode'] === MerchantAuthTestMode::OTP
        && password_verify($credentials['temporaryPassword'], (string) Db::table('merchant_admin')->where('id', $testResult['accountId'])->value('password')),
        'super admin can read the original valid encrypted activation credentials in test mode');
    check($delivery->testCredentials($adminLead['applicationId'])['email'] === 'stage4-admin@example.test',
        'previously approved applications can retrieve credentials after enabling test mode');
    check(! str_contains(json_encode($approval->status($testLead['applicationId'])), $credentials['temporaryPassword']),
        'normal detail never exposes a temporary password');
    $audit = Db::table('merchant_verify_timeline')->where('application_id', $testLead['applicationId'])->where('action', 'test_credentials_viewed')->first();
    check($audit && (int) $audit->operator_id === 94001 && ! str_contains($audit->note, $credentials['temporaryPassword']),
        'credential viewing audits the actual admin without recording the password');
    AdminContext::set(['admin_id' => 94002, 'site_id' => $siteId, 'is_super' => false]);
    stage4Rejects(ErrorCode::FORBIDDEN, fn () => $delivery->testCredentials($testLead['applicationId']), 'ordinary admins cannot view test credentials');
    AdminContext::set(['admin_id' => 94001, 'admin_name' => 'Stage 4 Super', 'site_id' => 0, 'is_super' => true,
        'permissions' => ['merchant:onboarding:final-approve', 'merchant:onboarding:credential-retry']]);
    $config->set('app_env', 'production');
    stage4Rejects(ErrorCode::FORBIDDEN, fn () => $delivery->testCredentials($testLead['applicationId']), 'production refuses test credentials even with the flag enabled');
    $config->set('app_env', 'test');
    Db::table('merchant_admin')->where('id', $testResult['accountId'])->update(['status' => 1]);
    stage4Rejects(ErrorCode::DATA_CONFLICT, fn () => $delivery->testCredentials($testLead['applicationId']), 'activated accounts cannot expose their old temporary credentials');
    $config->set('mtrip.merchant_auth_test_mode', false);

    $rollback = seedReadyStage4($siteId, 'ROLLBACK', 'hotel', 1, '+95940000003', 'stage4-rollback@example.test', $merchantTemplate, $hotelTemplate);
    Db::table('merchant_info')->insert([
        'merchant_code' => 'MCH-9499', 'site_id' => $siteId, 'merchant_name' => 'Duplicate Credit',
        'credit_code' => 'STAGE4-REG-ROLLBACK', 'legal_person' => '', 'contact_name' => '', 'contact_phone' => '', 'status' => 1,
    ]);
    $beforeMerchants = Db::table('merchant_info')->count();
    $beforeAccounts = Db::table('merchant_admin')->count();
    $beforeStores = Db::table('merchant_store')->count();
    try {
        $approval->approve($rollback['applicationId'], 'stage4-request-rollback', ['email']);
        check(false, 'duplicate credit code must fail');
    } catch (Throwable) {
        check(Db::table('merchant_info')->count() === $beforeMerchants && Db::table('merchant_admin')->count() === $beforeAccounts
            && Db::table('merchant_store')->count() === $beforeStores, 'entity creation rolls back when a transaction step fails');
    }

    $crossSiteDelivery = (int) Db::table('merchant_credential_delivery')->where('application_id', $car['applicationId'])->value('id');
    AdminContext::set(['admin_id' => 94002, 'admin_name' => 'Wrong Site', 'site_id' => 995, 'is_super' => false, 'permissions' => ['merchant:onboarding:credential-retry']]);
    stage4Rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $delivery->retry($crossSiteDelivery), 'credential retry enforces site isolation');
    stage4Rejects(ErrorCode::FORBIDDEN, fn () => $approval->approve($rollback['applicationId'], 'stage4-request-forbidden', ['email']),
        'non-super administrator cannot execute final approval');

    AdminContext::set(['admin_id' => 94001, 'admin_name' => 'Stage 4 Super', 'site_id' => 0, 'is_super' => true, 'permissions' => []]);
    $concurrent = seedReadyStage4($siteId, 'CONCURRENT', 'hotel', 2, '+95940000004', 'stage4-concurrent@example.test', $merchantTemplate, $hotelTemplate);
    $command = 'php /tmp/onboarding-final-approval-worker.php ' . $concurrent['applicationId'] . ' stage4-concurrent-request';
    $pipesOne = $pipesTwo = [];
    $processOne = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipesOne);
    $processTwo = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipesTwo);
    $outputOne = stream_get_contents($pipesOne[1]); $errorOne = stream_get_contents($pipesOne[2]);
    $outputTwo = stream_get_contents($pipesTwo[1]); $errorTwo = stream_get_contents($pipesTwo[2]);
    $exitOne = proc_close($processOne); $exitTwo = proc_close($processTwo);
    check($exitOne === 0 && $exitTwo === 0, 'concurrent final approvals both resolve through the same idempotency request: ' . $errorOne . $errorTwo);
    $workerOne = json_decode($outputOne, true); $workerTwo = json_decode($outputTwo, true);
check($workerOne['merchantId'] === $workerTwo['merchantId']
    && Db::table('merchant_info')->where('credit_code', 'STAGE4-REG-CONCURRENT')->count() === 1
    && Db::table('merchant_store')->whereIn('source_business_id', $concurrent['businessIds'])->count() === 2,
    'concurrent requests create one merchant and one property per initial business');

echo "Stage 4 onboarding final approval assertions passed\n";
