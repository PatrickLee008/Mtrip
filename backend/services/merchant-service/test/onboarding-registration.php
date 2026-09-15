<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\OnboardingController;
use App\Service\MerchantAppOnboardingService;
use App\Service\MerchantRegistrationOtpService;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Support\JwtHelper;
use Mtrip\Shared\Support\CryptoHelper;

function onboardingRequest(object $controller, string $method, array $input): mixed
{
    setRequest($input);
    return $controller->$method()['data'];
}

function otpHashes(string $phone, string $email): array
{
    $key = (string) Hyperf\Config\config('mtrip.aes_key');
    return [
        hash_hmac('sha256', 'merchant-registration-phone-v1:' . $phone, $key),
        hash_hmac('sha256', 'merchant-registration-email-v1:' . strtolower($email), $key),
    ];
}

function seedEmailOtp(Redis $redis, int $siteId, string $phone, string $email, string $code): void
{
    [$phoneHash, $emailHash] = otpHashes($phone, $email);
    $payload = [
        'type' => 'email',
        'codeHash' => hash_hmac('sha256', $code, (string) Hyperf\Config\config('mtrip.jwt_secret')),
        'attempts' => 0,
        'maxAttempts' => 5,
        'phoneHash' => $phoneHash,
        'emailHash' => $emailHash,
    ];
    $redis->setex("mtrip:merchant:registration:otp:{$siteId}:email:{$emailHash}", 300, json_encode($payload));
}

$otp = $container->get(MerchantRegistrationOtpService::class);
$config->set('mtrip.merchant_auth_test_mode', false);
$onboarding = $container->get(MerchantAppOnboardingService::class);
$admin = $container->get(OnboardingController::class);
$redis = $container->get(Redis::class);
$applicationIds = [];
$phones = ['+95911122001', '+95911122002'];
$emails = ['stage2-one@example.test', 'stage2-two@example.test'];
$code = '246810';

try {
    Db::table('merchant_kyc_template')->insert([
        ['site_id' => 0, 'scope_type' => 'merchant', 'name' => 'Registration Test Merchant KYC', 'business_type' => 'unified',
            'docs' => json_encode([['name' => 'Business Registration', 'doc_type' => 'business_reg', 'required' => true]]), 'status' => 1, 'sort' => 1],
        ['site_id' => 0, 'scope_type' => 'property', 'name' => 'Registration Test Hotel KYC', 'business_type' => 'hotel',
            'docs' => json_encode([['name' => 'Hotel License', 'doc_type' => 'hotel_license', 'required' => true]]), 'status' => 1, 'sort' => 1],
        ['site_id' => 0, 'scope_type' => 'property', 'name' => 'Registration Test Car KYC', 'business_type' => 'car_rental',
            'docs' => json_encode([['name' => 'Fleet Registration', 'doc_type' => 'vehicle_reg', 'required' => true]]), 'status' => 1, 'sort' => 1],
    ]);
    rejects(ErrorCode::PARAM_ERROR, fn () => $otp->verify(991, '', $emails[0], 'email', $code), 'registration phone required');
    rejects(ErrorCode::PARAM_ERROR, fn () => $otp->verify(991, $phones[0], 'bad-email', 'email', $code), 'registration email validated');

    seedEmailOtp($redis, 991, $phones[0], $emails[0], $code);
    $verified = $otp->verify(991, $phones[0], $emails[0], 'email', $code);
    $applicationIds[] = $applicationId = $verified['applicationId'];
    check($applicationId > 0 && $verified['registrationToken'] !== '', 'OTP verification creates a registration draft');
    $draft = (array) Db::table('merchant_application')->where('id', $applicationId)->first();
    check((int) $draft['registration_status'] === 0 && (int) $draft['merchant_kyc_status'] === 0
        && (int) $draft['account_status'] === 0 && (int) $draft['merchant_id'] === 0,
        'new draft initializes three independent states without a merchant');

    seedEmailOtp($redis, 991, $phones[0], $emails[0], $code);
    $restored = $otp->verify(991, $phones[0], $emails[0], 'email', $code);
    check($restored['applicationId'] === $applicationId, 'same verified contacts restore the existing draft');
    $token = $restored['registrationToken'];

    $saved = $onboarding->save(991, $token, [
        'applicationId' => $applicationId,
        'companyName' => 'Stage 2 Travel Group',
        'regNumber' => 'STAGE2-REG-001',
        'country' => 'Myanmar',
        'address' => 'Yangon HQ',
        'currentStep' => 3,
        'businesses' => [
            [
                'clientRef' => 'hotel-one', 'businessName' => 'Stage 2 Hotel', 'businessType' => 'hotel',
                'countryCode' => 'MM', 'cityKey' => 'yangon', 'city' => 'Yangon', 'address' => 'Downtown Yangon',
                'contactName' => 'Hotel Contact', 'contactPhone' => $phones[0], 'contactEmail' => $emails[0],
            ],
            [
                'clientRef' => 'rental-one', 'businessName' => 'Stage 2 Cars', 'businessType' => 'car_rental',
                'city' => 'Yangon', 'contactName' => 'Car Contact', 'contactPhone' => $phones[0], 'contactEmail' => $emails[0],
            ],
        ],
    ]);
    check(count($saved['businesses']) === 2 && $saved['businesses'][0]['businessType'] === 'hotel'
        && $saved['businesses'][1]['businessType'] === 'car_rental', 'draft persists multiple real business types');

    $businessId = $saved['businesses'][0]['applicationBusinessId'];
    $onboarding->save(991, $token, [
        'applicationId' => $applicationId,
        'merchantName' => 'Stage 2 Merchant',
        'businesses' => [[
            'applicationBusinessId' => $businessId,
            'clientRef' => 'hotel-one',
            'contactName' => 'Updated Hotel Contact',
        ]],
    ]);
    $detail = $onboarding->detail(991, $token, $applicationId);
    check($detail['application']['companyName'] === 'Stage 2 Travel Group'
        && $detail['businesses'][0]['businessName'] === 'Stage 2 Hotel'
        && $detail['businesses'][0]['contactName'] === 'Updated Hotel Contact',
        'incremental save preserves omitted application and business fields');
    check(Db::table('merchant_application_business')->where('application_id', $applicationId)->where('client_ref', 'hotel-one')->count() === 1,
        'clientRef upsert does not duplicate a business');

    rejects(ErrorCode::UNAUTHORIZED, fn () => $onboarding->status(992, $token, $applicationId), 'registration token is site-bound');
    $submitted = $onboarding->submit(991, $token, $applicationId);
    check($submitted['registrationStatus'] === 'submitted', 'complete draft enters submitted registration state');
    check($onboarding->submit(991, $token, $applicationId)['registrationStatus'] === 'submitted', 'duplicate registration submit is idempotent');

    $merchantBefore = Db::table('merchant_info')->count();
    $adminBefore = Db::table('merchant_admin')->count();
    $storeBefore = Db::table('merchant_store')->count();
    $reviewPermissions = ['merchant:onboarding:list', 'merchant:onboarding:update', 'merchant:onboarding:registration-approve', 'merchant:onboarding:reject'];
    AdminContext::set(['admin_id' => 92001, 'admin_name' => 'Stage 2 Reviewer', 'site_id' => 991, 'is_super' => false, 'permissions' => $reviewPermissions]);
    onboardingRequest($admin, 'registrationReviewStart', ['id' => $applicationId]);
    onboardingRequest($admin, 'registrationResubmit', ['id' => $applicationId, 'reason' => 'Please confirm the trading name']);
    check($onboarding->status(991, $token, $applicationId)['registrationStatus'] === 'resubmit_required', 'reviewer can request registration correction');
    $onboarding->save(991, $token, ['applicationId' => $applicationId, 'merchantName' => 'Stage 2 Merchant Corrected']);
    check($onboarding->submit(991, $token, $applicationId)['registrationStatus'] === 'submitted', 'corrected registration can be resubmitted');
    onboardingRequest($admin, 'registrationReviewStart', ['id' => $applicationId]);
    onboardingRequest($admin, 'approve', ['id' => $applicationId]);

    $approved = (array) Db::table('merchant_application')->where('id', $applicationId)->first();
    check((int) $approved['registration_status'] === 3 && (int) $approved['merchant_kyc_status'] === 1
        && (int) $approved['account_status'] === 0 && (int) $approved['merchant_id'] === 0,
        'base registration approval opens KYC only');
    check(Db::table('merchant_info')->count() === $merchantBefore
        && Db::table('merchant_admin')->count() === $adminBefore
        && Db::table('merchant_store')->count() === $storeBefore,
        'base approval creates no merchant account or property');
    rejects(ErrorCode::DATA_CONFLICT, fn () => onboardingRequest($admin, 'updateStage', ['id' => $applicationId, 'stage' => 3]), 'new workflow rejects legacy stage writes');

    seedEmailOtp($redis, 991, $phones[1], $emails[1], $code);
    $second = $otp->verify(991, $phones[1], $emails[1], 'email', $code);
    $applicationIds[] = $secondId = $second['applicationId'];
    Db::table('merchant_application')->where('id', $secondId)->update(['registration_status' => 2]);
    AdminContext::set(['admin_id' => 92002, 'admin_name' => 'Wrong Site', 'site_id' => 992, 'is_super' => false, 'permissions' => $reviewPermissions]);
    rejects(ErrorCode::NO_DATA_PERMISSION, fn () => onboardingRequest($admin, 'approve', ['id' => $secondId]), 'cross-site reviewer cannot approve registration');
    AdminContext::set(['admin_id' => 92001, 'admin_name' => 'Stage 2 Reviewer', 'site_id' => 991, 'is_super' => false, 'permissions' => $reviewPermissions]);
    onboardingRequest($admin, 'reject', ['id' => $secondId, 'reasonCode' => 3, 'note' => 'Registration data mismatch']);
    check((int) Db::table('merchant_application')->where('id', $secondId)->value('registration_status') === 5,
        'reviewer can reject an under-review registration');

    $queues = onboardingRequest($admin, 'queues', []);
    check($queues['approved'] === 1 && $queues['rejected'] === 1 && $queues['pending'] === 0 && $queues['resubmission'] === 0,
        'admin onboarding queues are driven by registration status');

    $claims = JwtHelper::verify($token, (string) Hyperf\Config\config('mtrip.jwt_secret'));
    check((int) $claims['application_id'] === $applicationId && isset($claims['phone_hash'], $claims['email_hash']),
        'registration token binds application and both contact hashes');

    AdminContext::set(['admin_id' => 92001, 'admin_name' => 'Stage 2 Reviewer', 'site_id' => 991, 'is_super' => false,
        'permissions' => ['merchant:onboarding:create', 'merchant:onboarding:list']]);
    $leadInput = [
        'siteId' => 992, 'companyName' => 'Admin Confirmed Lead', 'regNumber' => 'ADMIN-CONTACTS-001',
        'registrationPhone' => '+95 9111-22003', 'registrationEmail' => 'Admin-Lead@Example.test',
        'registration_channel' => 'email', 'contact_data_status' => 1,
        'businesses' => [['businessName' => 'Admin Property', 'businessType' => 'hotel',
            'contactPhone' => '+95999999999', 'contactEmail' => 'property@example.test']],
    ];
    rejects(ErrorCode::PARAM_ERROR, fn () => onboardingRequest($admin, 'create', array_replace($leadInput, ['registrationPhone' => ''])),
        'admin creation requires an explicit owner phone');
    rejects(ErrorCode::PARAM_ERROR, fn () => onboardingRequest($admin, 'create', array_replace($leadInput, ['registrationPhone' => '0911122003'])),
        'admin creation does not guess a country calling code');
    rejects(ErrorCode::PARAM_ERROR, fn () => onboardingRequest($admin, 'create', array_replace($leadInput, ['registrationEmail' => 'invalid'])),
        'admin creation validates owner email');
    $lead = onboardingRequest($admin, 'create', $leadInput);
    $applicationIds[] = (int) $lead['id'];
    check((int) $lead['site_id'] === 991 && $lead['registration_channel'] === 'admin' && (int) $lead['contact_data_status'] === 0,
        'admin contacts are confirmed on the authorized site with a server-owned source');
    $key = (string) Hyperf\Config\config('mtrip.aes_key');
    check(CryptoHelper::decrypt($lead['registration_phone'], $key) === '+95911122003'
        && CryptoHelper::decrypt($lead['registration_email'], $key) === 'admin-lead@example.test',
        'encrypted owner contacts normalize independently of property contacts');
    [$phoneHash, $emailHash] = otpHashes('+95911122003', 'admin-lead@example.test');
    check($lead['registration_phone_index'] === $phoneHash && $lead['registration_email_index'] === $emailHash,
        'admin identity indexes match OTP identity indexes');
    $event = Db::table('merchant_verify_timeline')->where('application_id', $lead['id'])
        ->where('action', 'registration_contacts_admin_confirmed')->first();
    check($event && (int) $event->actor_type === 2 && (int) $event->operator_id === 92001,
        'admin contact confirmation records the actual administrator');
    check((int) $lead['registration_status'] === 1 && (int) $lead['merchant_kyc_status'] === 0
        && (int) $lead['account_status'] === 0 && (int) $lead['merchant_id'] === 0,
        'admin contact confirmation does not bypass base approval, KYC, or account activation');
    rejects(ErrorCode::DATA_CONFLICT, fn () => onboardingRequest($admin, 'create', array_replace($leadInput, ['regNumber' => 'ADMIN-CONTACTS-002'])),
        'duplicate admin registration identity is rejected');
    rejects(ErrorCode::PARAM_ERROR, fn () => $otp->verify(991, '+95911122003', 'admin-lead@example.test', 'admin', $code),
        'public OTP API cannot request the admin confirmation channel');

    $config->set('app_env', 'test');
    $config->set('mtrip.merchant_auth_test_mode', true);
    check(count($otp->availableChannels(991)) === 2, 'test registration exposes email and SMS without provider configuration');
    foreach (['email', 'sms'] as $index => $channel) {
        $phone = '+9591112200' . ($index + 4);
        $email = 'registration-test-' . $channel . '@example.test';
        $phones[] = $phone;
        $emails[] = $email;
        $sent = $otp->send(991, $phone, $email, $channel, '');
        check($sent['testMode'], 'registration creates a test OTP without sending ' . $channel);
        rejects(ErrorCode::SMS_CODE_INVALID, fn () => $otp->verify(991, $phone, $email, $channel, '111111'), 'wrong test registration code rejected for ' . $channel);
        $config->set('app_env', 'production');
        rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $otp->verify(991, $phone, $email, $channel, '000000'), 'production rejects persisted test registration code for ' . $channel);
        $config->set('app_env', 'test');
        $verifiedTest = $otp->verify(991, $phone, $email, $channel, '000000');
        $applicationIds[] = $verifiedTest['applicationId'];
        check($verifiedTest['applicationId'] > 0, '000000 creates a test registration draft for ' . $channel);
        rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $otp->verify(991, $phone, $email, $channel, '000000'), 'test registration code remains single use for ' . $channel);
        $config->set('mtrip.merchant_auth_test_mode', false);
        rejects(ErrorCode::UNAUTHORIZED, fn () => $otp->registrationClaims(991, $verifiedTest['registrationToken']), 'test registration token stops working when test mode is disabled');
        $config->set('mtrip.merchant_auth_test_mode', true);
    }
    $config->set('mtrip.merchant_auth_test_mode', false);
} finally {
    foreach ($emails as $index => $email) {
        [, $emailHash] = otpHashes($phones[$index], $email);
        $redis->del("mtrip:merchant:registration:otp:991:email:{$emailHash}");
        $redis->del("mtrip:merchant:registration:cooldown:991:email:{$emailHash}");
        $smsHash = hash_hmac('sha256', 'merchant-registration-sms-v1:' . $phones[$index], (string) Hyperf\Config\config('mtrip.aes_key'));
        $redis->del("mtrip:merchant:registration:otp:991:sms:{$smsHash}");
        $redis->del("mtrip:merchant:registration:cooldown:991:sms:{$smsHash}");
    }
    if ($applicationIds !== []) {
        Db::table('merchant_verify_timeline')->whereIn('application_id', $applicationIds)->delete();
        Db::table('merchant_application_business')->whereIn('application_id', $applicationIds)->delete();
        Db::table('merchant_application')->whereIn('id', $applicationIds)->delete();
    }
}

echo "Onboarding registration integration complete\n";
