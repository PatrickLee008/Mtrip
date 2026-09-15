<?php

declare(strict_types=1);

if (getenv('MTRIP_STAGE7_E2E') !== '1') {
    throw new RuntimeException('Stage 7 E2E environment required');
}
require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\OnboardingController;
use App\Service\Merchant\MerchantAuthService;
use App\Service\MerchantAccountSecurityService;
use App\Service\MerchantAppOnboardingService;
use App\Service\MerchantAuthenticationService;
use App\Service\MerchantDocumentService;
use App\Service\MerchantRegistrationOtpService;
use App\Service\MerchantStatusService;
use App\Service\OnboardingCredentialDeliveryService;
use App\Service\OnboardingFinalApprovalService;
use App\Service\OnboardingKycService;
use App\Service\PropertyProfileService;
use Hyperf\DbConnection\Db;
use Hyperf\HttpMessage\Upload\UploadedFile;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
use Mtrip\Shared\Merchant\Totp;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\JwtHelper;

use function Hyperf\Config\config;

final class Stage7Delivery extends OnboardingCredentialDeliveryService
{
    protected function deliverEmail(int $siteId, string $recipient, array $payload): array
    {
        return ['ok' => true, 'receipt' => 'stage7-email', 'error' => ''];
    }
}

function stage7Worker(int $applicationId, string $requestId): array
{
    $command = 'php /tmp/onboarding-final-approval-worker.php '
        . escapeshellarg((string) $applicationId) . ' ' . escapeshellarg($requestId);
    $pipes = [];
    $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (! is_resource($process)) throw new RuntimeException('Cannot start final-approval worker');
    return [$process, $pipes];
}

function stage7WorkerResult(array $worker): array
{
    [$process, $pipes] = $worker;
    $output = stream_get_contents($pipes[1]);
    $error = stream_get_contents($pipes[2]);
    $exit = proc_close($process);
    $result = json_decode((string) $output, true);
    if ($exit !== 0 || ! is_array($result) || ($result['ok'] ?? false) !== true) {
        throw new RuntimeException('Final-approval worker failed: ' . $error . $output);
    }
    return $result;
}

final class Stage7Authentication extends MerchantAuthenticationService
{
    public string $lastEmailCode = '';

    protected function sendEmailOtp(int $siteId, string $recipient, string $code, string $purpose): bool
    {
        $this->lastEmailCode = $code;
        return true;
    }
}

function stage7File(string $name): UploadedFile
{
    $content = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF";
    $path = tempnam(sys_get_temp_dir(), 'stage7-kyc-');
    if ($path === false) throw new RuntimeException('Cannot create KYC fixture');
    file_put_contents($path, $content);
    return new UploadedFile($path, strlen($content), UPLOAD_ERR_OK, $name, 'application/pdf');
}

function stage7OtpHashes(string $phone, string $email): array
{
    $key = (string) config('mtrip.aes_key');
    return [
        hash_hmac('sha256', 'merchant-registration-phone-v1:' . $phone, $key),
        hash_hmac('sha256', 'merchant-registration-email-v1:' . strtolower($email), $key),
    ];
}

function stage7SeedOtp(Redis $redis, int $siteId, string $phone, string $email, string $code): array
{
    [$phoneHash, $emailHash] = stage7OtpHashes($phone, $email);
    $payload = [
        'type' => 'email',
        'codeHash' => hash_hmac('sha256', $code, (string) config('mtrip.jwt_secret')),
        'attempts' => 0, 'maxAttempts' => 5,
        'phoneHash' => $phoneHash, 'emailHash' => $emailHash,
    ];
    $redis->setex("mtrip:merchant:registration:otp:{$siteId}:email:{$emailHash}", 300, json_encode($payload));
    return [$phoneHash, $emailHash];
}

function stage7Application(string $key): array
{
    $row = Db::table('merchant_application')->where('reg_number', 'STAGE7-' . $key)->first();
    if (! $row) throw new RuntimeException('Stage 7 application not found');
    return (array) $row;
}

function stage7Properties(array $application): array
{
    return Db::table('merchant_store as p')
        ->join('merchant_application_business as b', 'b.id', '=', 'p.source_business_id')
        ->where('b.application_id', $application['id'])->orderBy('b.id')
        ->get(['p.*'])->map(static fn ($row) => (array) $row)->all();
}

function stage7MerchantContext(array $application, array $property): void
{
    $account = (array) Db::table('merchant_admin')->where('merchant_id', $application['merchant_id'])
        ->where('account_type', 2)->where('is_owner', 1)->first();
    MerchantContext::set([
        'admin_id' => (int) $account['id'], 'admin_name' => (string) $account['real_name'],
        'site_id' => (int) $application['site_id'], 'merchant_id' => (int) $application['merchant_id'],
        'account_type' => 2, 'group_id' => 0, 'store_id' => 0, 'is_owner' => true,
        'selected_property_id' => (int) $property['id'],
        'permissions' => ['mch:properties:profile-edit', 'mch:properties:profile-submit', 'mch:properties:publish'],
    ]);
}

function stage7RemoveDir(string $dir): void
{
    if (! is_dir($dir)) return;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($iterator as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
    rmdir($dir);
}

$mode = $argv[1] ?? 'start';
$key = (string) getenv('MTRIP_STAGE7_KEY');
if (! preg_match('/^[0-9]{8,24}$/D', $key)) throw new RuntimeException('Invalid Stage 7 key');
$siteId = 997;

if (in_array($mode, ['publish', 'offline'], true)) {
    $application = stage7Application($key);
    $property = stage7Properties($application)[0];
    stage7MerchantContext($application, $property);
    $result = (new PropertyProfileService())->publish((int) $property['id'], $mode === 'publish');
    check((int) $result['publishStatus'] === ($mode === 'publish' ? 1 : 2),
        $mode === 'publish' ? 'E2E property publishes through the merchant service' : 'E2E property goes offline through the merchant service');
    if ($mode === 'offline') {
        check((int) Db::table('merchant_store')->where('id', $property['id'])->value('operating_status') === 1,
            'E2E offline keeps the approved operating state');
    }
    exit(0);
}

if (in_array($mode, ['suspend', 'activate'], true)) {
    $application = stage7Application($key);
    $merchant = (array) Db::table('merchant_info')->where('id', $application['merchant_id'])->first();
    AdminContext::set([
        'admin_id' => 97004, 'admin_name' => 'Stage 7 Status Reviewer',
        'site_id' => $siteId, 'is_super' => false,
        'permissions' => ['merchant:status:' . $mode],
    ]);
    $result = (new MerchantStatusService())->change((int) $merchant['id'], $mode, [
        'note' => $mode === 'suspend' ? 'Stage 7 temporary suspension' : 'Stage 7 suspension resolved',
        'requestId' => 'stage7-' . $mode . '-' . $key,
        'expectedVersion' => (int) $merchant['status_version'],
    ], '127.0.0.1');
    check((int) $result['status'] === ($mode === 'suspend' ? 4 : 3),
        $mode === 'suspend' ? 'E2E administrator suspends the merchant' : 'E2E administrator restores the merchant');
    exit(0);
}

$phone = '+9597' . substr($key, -8);
$email = 'stage7-' . $key . '@example.test';
$code = '731942';
$applicationId = 0;
$redis = $container->get(Redis::class);
[, $emailHash] = stage7SeedOtp($redis, $siteId, $phone, $email, $code);

try {
    Db::table('merchant_kyc_template')->insert([
        ['site_id' => 0, 'scope_type' => 'merchant', 'name' => 'Stage 7 Merchant KYC', 'business_type' => 'unified',
            'docs' => json_encode([['name' => 'Business Registration', 'doc_type' => 'business_reg', 'required' => true]]), 'status' => 1, 'sort' => 1],
        ['site_id' => 0, 'scope_type' => 'property', 'name' => 'Stage 7 Hotel KYC', 'business_type' => 'hotel',
            'docs' => json_encode([['name' => 'Hotel License', 'doc_type' => 'hotel_license', 'required' => true]]), 'status' => 1, 'sort' => 1],
    ]);
    $agreementContent = 'Stage 7 onboarding agreement';
    Db::table('merchant_onboarding_agreement')->insert([
        'site_id' => 0, 'agreement_version' => 'stage7-v1', 'title' => 'Stage 7 Agreement',
        'content' => $agreementContent, 'content_sha256' => hash('sha256', $agreementContent),
        'status' => 1, 'effective_at' => '2026-09-15 00:00:00', 'created_by' => 97001,
    ]);

    $otp = $container->get(MerchantRegistrationOtpService::class);
    $onboarding = $container->get(MerchantAppOnboardingService::class);
    $verified = $otp->verify($siteId, $phone, $email, 'email', $code);
    $applicationId = (int) $verified['applicationId'];
    $token = (string) $verified['registrationToken'];
    check($applicationId > 0, 'E2E registration OTP creates the application draft');

    $saved = $onboarding->save($siteId, $token, [
        'applicationId' => $applicationId, 'merchantName' => 'Stage 7 Merchant',
        'companyName' => 'Stage 7 Travel Group', 'regNumber' => 'STAGE7-' . $key,
        'country' => 'Myanmar', 'address' => 'Stage 7 Headquarters', 'currentStep' => 4,
        'businesses' => [
            ['clientRef' => 'hotel-one', 'businessName' => 'Stage 7 Shared Hotel', 'businessType' => 'hotel',
                'countryCode' => 'MM', 'cityKey' => 'stage7-city', 'city' => 'Yangon', 'address' => 'Stage 7 Address One',
                'contactName' => 'Stage Seven Owner', 'contactPhone' => $phone, 'contactEmail' => $email],
            ['clientRef' => 'hotel-two', 'businessName' => 'Stage 7 Shared Hotel', 'businessType' => 'hotel',
                'countryCode' => 'MM', 'cityKey' => 'stage7-city', 'city' => 'Yangon', 'address' => 'Stage 7 Address Two',
                'contactName' => 'Stage Seven Owner', 'contactPhone' => $phone, 'contactEmail' => $email],
        ],
    ]);
    $businessIds = array_column($saved['businesses'], 'applicationBusinessId');
    check(count($businessIds) === 2, 'E2E registration draft contains two initial hotel businesses');
    check($onboarding->submit($siteId, $token, $applicationId)['registrationStatus'] === 'submitted',
        'E2E registration submits for base approval');

    $admin = $container->get(OnboardingController::class);
    AdminContext::set(['admin_id' => 97001, 'admin_name' => 'Stage 7 Reviewer', 'site_id' => $siteId, 'is_super' => false,
        'permissions' => ['merchant:onboarding:list', 'merchant:onboarding:update', 'merchant:onboarding:registration-approve', 'merchant:onboarding:kyc', 'merchant:doc:list']]);
    setRequest(['id' => $applicationId]);
    $admin->registrationReviewStart();
    setRequest(['id' => $applicationId, 'reason' => 'Please confirm the merchant trading name']);
    $admin->registrationResubmit();
    check($onboarding->status($siteId, $token, $applicationId)['registrationStatus'] === 'resubmit_required',
        'E2E reviewer can require a registration correction');
    $onboarding->save($siteId, $token, [
        'applicationId' => $applicationId, 'merchantName' => 'Stage 7 Merchant Corrected',
    ]);
    check($onboarding->submit($siteId, $token, $applicationId)['registrationStatus'] === 'submitted',
        'E2E corrected registration can be resubmitted');
    setRequest(['id' => $applicationId]);
    $admin->registrationReviewStart();
    setRequest(['id' => $applicationId]);
    $admin->approve();
    check((int) Db::table('merchant_application')->where('id', $applicationId)->value('merchant_kyc_status') === 1,
        'E2E base approval opens KYC without creating formal entities');

    $kyc = $container->get(OnboardingKycService::class);
    $app = (array) Db::table('merchant_application')->where('id', $applicationId)->first();
    $agreement = $kyc->agreement($app);
    $receipt = $kyc->confirmAgreementRead($app, $agreement['agreementId'], $agreement['version'], true);
    $signature = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    $kyc->sign($app, $agreement['agreementId'], $agreement['version'], $receipt['readReceipt'],
        'Stage Seven Owner', 'Owner', $signature, '127.0.0.1', 'stage7-e2e');
    $kyc->upload($app, 'merchant', 0, 'business_reg', stage7File('merchant.pdf'));
    foreach ($businessIds as $index => $businessId) {
        $kyc->upload($app, 'property', (int) $businessId, 'hotel_license', stage7File('hotel-' . ($index + 1) . '.pdf'));
    }
    check(count($kyc->submit((array) Db::table('merchant_application')->where('id', $applicationId)->first())['submittedScopes']) === 3,
        'E2E KYC submits merchant and both initial-property scopes together');

    $documents = new MerchantDocumentService();
    foreach (Db::table('merchant_verify_document')->where('application_id', $applicationId)->orderBy('id')->get() as $document) {
        $documents->review((int) $document->id, ['action' => 'verify', 'expectedVersion' => (int) $document->document_version]);
    }
    $app = (array) Db::table('merchant_application')->where('id', $applicationId)->first();
    check($kyc->readiness($app)['ready'] === true, 'E2E merchant, two properties and signature pass the final-approval gate');

    AdminContext::set(['admin_id' => 97002, 'admin_name' => 'Stage 7 Super', 'site_id' => 0, 'is_super' => true,
        'permissions' => ['merchant:onboarding:final-approve']]);
    $requestId = 'stage7-' . $key;
    $workerOne = stage7Worker($applicationId, $requestId);
    $workerTwo = stage7Worker($applicationId, $requestId);
    $workerResultOne = stage7WorkerResult($workerOne);
    $workerResultTwo = stage7WorkerResult($workerTwo);
    check($workerResultOne['merchantId'] === $workerResultTwo['merchantId']
        && Db::table('merchant_info')->where('credit_code', 'STAGE7-' . $key)->count() === 1,
        'E2E concurrent final approval creates one formal merchant');

    $deliveryRow = Db::table('merchant_credential_delivery')->where('application_id', $applicationId)
        ->where('channel', 'email')->first();
    check($deliveryRow && (string) $deliveryRow->status === 'failed',
        'E2E credential outbox records a real delivery failure without rolling back approval');
    $delivery = new Stage7Delivery();
    $approval = new OnboardingFinalApprovalService($kyc, $delivery);
    $approved = $approval->status($applicationId);
    if ($approved === null) throw new RuntimeException('Final approval status missing');
    check(count($approved['propertyIds']) === 2
        && Db::table('merchant_store')->whereIn('id', $approved['propertyIds'])->whereNotNull('source_business_id')->count() === 2,
        'E2E final approval creates the merchant account and both mapped properties');
    $retried = $delivery->retry((int) $deliveryRow->id);
    check($retried['status'] === 'delivered', 'E2E failed credential delivery can be retried safely');
    $deliveryRow = Db::table('merchant_credential_delivery')->where('id', $deliveryRow->id)->first();
    $credentials = json_decode(CryptoHelper::decrypt((string) $deliveryRow->credential_ciphertext, (string) config('mtrip.aes_key')), true);
    $auth = new Stage7Authentication(new MerchantAccountSecurityService(), new MerchantAuthService());
    $activation = $auth->startActivation($siteId, (string) $credentials['accessCode'], '', '', '127.0.0.1');
    $emailOtp = $auth->sendActivationOtp($activation['activationToken'], 'email', '127.0.0.1');
    $activationVerified = $auth->verifyActivationOtp($emailOtp['challengeToken'], $auth->lastEmailCode, '127.0.0.1');
    $totp = $auth->setupActivationTotp($activationVerified['activationToken']);
    $auth->verifyActivationTotp($activationVerified['activationToken'], Totp::code($totp['manualKey'], intdiv(time(), 30)), '127.0.0.1');
    $session = $auth->finishActivation($activationVerified['activationToken'], '127.0.0.1');
    $claims = JwtHelper::verify($session['token'], (string) config('mtrip.jwt_secret'));
    MerchantAccessGuard::assertSession($claims);
    check((int) Db::table('merchant_info')->where('id', $approved['merchantId'])->value('status') === 3
        && (int) Db::table('merchant_application')->where('id', $applicationId)->value('account_status') === 2,
        'E2E activation enables the merchant, owner account and application');

    $properties = stage7Properties(stage7Application($key));
    stage7MerchantContext(stage7Application($key), $properties[0]);
    $authorized = MerchantContext::authorizedPropertyIds();
    $account = (array) Db::table('merchant_admin')->where('id', $approved['accountId'])->first();
    $menuData = (new MerchantAuthService())->menus((int) $account['id'], 2, true, (int) $approved['merchantId'], [(int) $approved['merchantId']], null);
    check($authorized === array_map(static fn ($row) => (int) $row['id'], $properties)
        && count($menuData['businesses']) === 2, 'E2E activated owner sees both initial properties in All Properties');

    $profiles = new PropertyProfileService();
    $profile = $profiles->save([
        'propertyId' => $properties[0]['id'], 'propertyName' => 'Stage 7 Live Hotel',
        'location' => 'Stage 7 Address One', 'countryCode' => 'MM', 'cityKey' => 'stage7-city',
        'description' => 'Stage 7 approved profile', 'starLevel' => 4,
        'facilities' => ['WiFi'], 'images' => ['https://example.test/stage7.jpg'],
    ], true);
    AdminContext::set(['admin_id' => 97001, 'admin_name' => 'Stage 7 Reviewer', 'site_id' => $siteId, 'is_super' => false]);
    $profiles->audit($profile['revisionId'], 1, 'Approved');
    stage7MerchantContext(stage7Application($key), $properties[0]);
    $pending = $profiles->save(['propertyId' => $properties[0]['id'], 'propertyName' => 'Stage 7 Pending Hotel'], true);
    check($pending['version'] === 2
        && Db::table('merchant_store')->where('id', $properties[0]['id'])->value('store_name') === 'Stage 7 Live Hotel',
        'E2E pending profile update preserves the approved live profile');

    echo "Stage 7 merchant onboarding chain complete\n";
} finally {
    $redis->del("mtrip:merchant:registration:otp:{$siteId}:email:{$emailHash}");
    $redis->del("mtrip:merchant:registration:cooldown:{$siteId}:email:{$emailHash}");
    if ($applicationId > 0) stage7RemoveDir('/opt/www/uploads/kyc/' . $applicationId);
}
