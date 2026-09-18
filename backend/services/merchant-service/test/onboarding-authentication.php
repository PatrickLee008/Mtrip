<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\Merchant\MerchantAuthService;
use App\Service\MerchantAccountSecurityService;
use App\Service\MerchantAuthenticationService;
use App\Service\MerchantAuthTestMode;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
use Mtrip\Shared\Merchant\Totp;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\JwtHelper;

use function Hyperf\Config\config;

class Stage5Authentication extends MerchantAuthenticationService
{
    public string $lastEmailCode = '';
    public string $smsCode = '654321';
    private int $smsSequence = 0;

    protected function sendEmailOtp(int $siteId, string $recipient, string $code, string $purpose): bool
    {
        $this->lastEmailCode = $code;
        return true;
    }

    protected function sendSmsOtp(int $siteId, string $recipient): string
    {
        return 'stage5-sms-' . ++$this->smsSequence;
    }

    protected function verifySmsOtp(int $siteId, string $requestId, string $code): bool
    {
        return str_starts_with($requestId, 'stage5-sms-') && $code === $this->smsCode;
    }

    protected function verifyGoogleIdToken(string $idToken): array
    {
        if (! preg_match('/^google-([a-z0-9-]+)$/D', $idToken, $match)) {
            throw new \Mtrip\Shared\Exception\BusinessException(ErrorCode::UNAUTHORIZED, 'Google 身份验证失败');
        }
        return ['issuer' => 'https://accounts.google.com', 'subject' => $match[1], 'email' => $match[1] . '@gmail.test'];
    }
}

/** @return array{merchantId:int,accountId:int,applicationId:int,password:string,email:string,mobile:string,accessCode:string} */
function stage5Pending(int $siteId, string $suffix, string $email, string $mobile): array
{
    $aes = (string) config('mtrip.aes_key');
    $password = 'Stage5-temp-' . $suffix . '-4829';
    $accessCode = 'H' . strtoupper(str_pad($suffix, 5, 'X'));
    $merchantId = (int) Db::table('merchant_info')->insertGetId([
        'merchant_code' => 'MCH-S5-' . $suffix, 'site_id' => $siteId, 'merchant_name' => 'Stage 5 Merchant ' . $suffix,
        'credit_code' => 'STAGE5-' . $suffix, 'legal_person' => '', 'contact_name' => 'Stage Five Owner',
        'contact_phone' => CryptoHelper::encrypt($mobile, $aes), 'contact_email' => $email,
        'access_code' => $accessCode, 'status' => 1,
    ]);
    $accountId = (int) Db::table('merchant_admin')->insertGetId([
        'site_id' => $siteId, 'merchant_id' => $merchantId, 'account_type' => 2, 'is_owner' => 1,
        'username' => 'stage5-' . strtolower($suffix), 'password' => password_hash($password, PASSWORD_BCRYPT),
        'real_name' => 'Stage Five Owner', 'mobile' => CryptoHelper::encrypt($mobile, $aes),
        'mobile_index' => stage5ContactHash('sms', $mobile), 'email' => CryptoHelper::encrypt($email, $aes),
        'email_index' => stage5ContactHash('email', $email), 'status' => 2,
    ]);
    $applicationId = (int) Db::table('merchant_application')->insertGetId([
        'site_id' => $siteId, 'app_no' => 'APP-STAGE5-' . $suffix, 'merchant_name' => 'Stage 5 Merchant ' . $suffix,
        'company_name' => 'Stage 5 Company ' . $suffix, 'reg_number' => 'STAGE5-' . $suffix,
        'business_types' => 'hotel', 'primary_business_type' => 'hotel', 'num_businesses' => 1,
        'registration_status' => 3, 'merchant_kyc_status' => 5, 'account_status' => 1,
        'state_model_version' => 1, 'merchant_id' => $merchantId, 'final_approval_request_id' => 'stage5-' . $suffix,
        'final_approved_at' => gmdate('Y-m-d H:i:s'),
    ]);
    Db::table('merchant_store')->insert([
        'site_id' => $siteId, 'merchant_id' => $merchantId, 'store_name' => 'Stage 5 Property ' . $suffix,
        'business_type' => 'hotel', 'status' => 2, 'kyc_status' => 1, 'operating_status' => 2,
    ]);
    return compact('merchantId', 'accountId', 'applicationId', 'password', 'email', 'mobile', 'accessCode');
}

function stage5ContactHash(string $channel, string $value): string
{
    $type = $channel === 'sms' ? 'phone' : 'email';
    return hash_hmac('sha256', 'merchant-registration-' . $type . '-v1:' . $value, (string) config('mtrip.aes_key'));
}

function stage5Claims(string $token): array
{
    return JwtHelper::verify($token, (string) config('mtrip.jwt_secret'));
}

$security = new MerchantAccountSecurityService();
setMerchantAuthTestMode($config, false, false, 'test');
$legacyAuth = new MerchantAuthService();
$auth = new Stage5Authentication($security, $legacyAuth);
$siteOne = 995;
$siteTwo = 996;

$emailAccount = stage5Pending($siteOne, 'E0001', 'owner-one@example.test', '+95950000001');
rejects(ErrorCode::DATA_CONFLICT, fn () => $legacyAuth->login('stage5-e0001', $emailAccount['password'], ''),
    'pending owner password login directs the merchant to first activation');
rejects(ErrorCode::DATA_CONFLICT, fn () => $auth->loginChallenge($siteOne, 'access_code', $emailAccount['accessCode'], '', ''),
    'pending owner access-code login directs the merchant to first activation');
rejects(ErrorCode::UNAUTHORIZED, fn () => $security->beginWithAccessCode($emailAccount['accessCode']),
    'pending account cannot use access code to enter the workspace');
rejects(ErrorCode::UNAUTHORIZED, fn () => $auth->startActivation($siteOne, '', 'stage5-e0001', 'wrong-password', ''),
    'wrong temporary password cannot start activation');
check((int) Db::table('merchant_admin')->where('id', $emailAccount['accountId'])->value('security_fail_count') === 1,
    'failed activation credential is retained in security counters');

$start = $auth->startActivation($siteOne, strtolower($emailAccount['accessCode']), '', '', '127.0.0.1');
check(strlen($start['activationToken']) === 43 && str_contains($start['profile']['email'], '***')
    && str_contains($start['profile']['mobile'], '****'), 'access code starts a masked activation context');
$emailOtp = $auth->sendActivationOtp($start['activationToken'], 'email', '127.0.0.1');
rejects(ErrorCode::SMS_SEND_TOO_FREQUENT, fn () => $auth->sendActivationOtp($start['activationToken'], 'email', '127.0.0.1'),
    'activation OTP resend cooldown is enforced');
rejects(ErrorCode::SMS_CODE_INVALID, fn () => $auth->verifyActivationOtp($emailOtp['challengeToken'], '000000', '127.0.0.1'),
    'wrong activation OTP is rejected');
check((int) Db::table('merchant_auth_challenge')->where('token_hash', hash('sha256', $emailOtp['challengeToken']))->value('attempts') === 1,
    'wrong OTP attempt persists outside the failed request');
$verified = $auth->verifyActivationOtp($emailOtp['challengeToken'], $auth->lastEmailCode, '127.0.0.1');
check($verified['profile']['otpVerified'] && $verified['profile']['methods']['email'], 'activation OTP verifies and links the email method');

$setup = $auth->setupActivationTotp($verified['activationToken']);
$totpSecret = $setup['manualKey'];
$auth->verifyActivationTotp($verified['activationToken'], Totp::code($totpSecret, intdiv(time(), 30)), '127.0.0.1');
$linked = $auth->linkGoogle($verified['activationToken'], 'google-owner-one', '127.0.0.1');
check($linked['methods']['google'] && $linked['methods']['accessCode'], 'activation links Google and Authenticator methods');
$activated = $auth->finishActivation($verified['activationToken'], '127.0.0.1');
$activationClaims = stage5Claims($activated['token']);
MerchantAccessGuard::assertSession($activationClaims);
check($activationClaims['amr'] === 'activation_email_otp'
    && (int) Db::table('merchant_admin')->where('id', $emailAccount['accountId'])->value('status') === 1
    && (int) Db::table('merchant_info')->where('id', $emailAccount['merchantId'])->value('status') === 3
    && (int) Db::table('merchant_application')->where('id', $emailAccount['applicationId'])->value('account_status') === 2,
    'activation atomically enables account, merchant and application state');
rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $auth->finishActivation($verified['activationToken'], ''),
    'activation token is single use');
rejects(ErrorCode::UNAUTHORIZED, fn () => $legacyAuth->login('stage5-e0001', $emailAccount['password'], ''),
    'temporary password is invalidated after activation');

Db::table('merchant_admin')->where('id', $emailAccount['accountId'])->update(['last_accepted_totp_step' => -1]);
$accessLogin = $auth->loginChallenge($siteOne, 'access_code', strtolower($emailAccount['accessCode']), '', '127.0.0.1');
check($accessLogin['verification'] === 'totp' && ! isset($accessLogin['token']), 'access code alone only creates a TOTP challenge');
$accessSession = $auth->verifyLogin('access_code', $accessLogin['challengeToken'], Totp::code($totpSecret, intdiv(time(), 30)), '127.0.0.1');
check(stage5Claims($accessSession['token'])['amr'] === 'totp', 'access code plus Authenticator issues a TOTP session');

$emailLogin = $auth->loginChallenge($siteOne, 'email', strtoupper($emailAccount['email']), '', '127.0.0.1');
$emailSession = $auth->verifyLogin('email', $emailLogin['challengeToken'], $auth->lastEmailCode, '127.0.0.1');
check(stage5Claims($emailSession['token'])['amr'] === 'email_otp', 'registered email plus email OTP signs in');
rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $auth->verifyLogin('email', $emailLogin['challengeToken'], $auth->lastEmailCode, ''),
    'login OTP cannot be reused');

$googleLogin = $auth->loginChallenge($siteOne, 'google', '', 'google-owner-one', '127.0.0.1');
$googleSession = $auth->verifyLogin('google', $googleLogin['challengeToken'], $auth->lastEmailCode, '127.0.0.1');
check(stage5Claims($googleSession['token'])['amr'] === 'google_mtrip_otp', 'linked Google identity still requires a separate mTrip OTP');

$smsAccount = stage5Pending($siteTwo, 'S0002', 'owner-two@example.test', '+95950000002');
$smsStart = $auth->startActivation($siteTwo, '', 'stage5-s0002', $smsAccount['password'], '127.0.0.2');
$smsOtp = $auth->sendActivationOtp($smsStart['activationToken'], 'sms', '127.0.0.2');
$smsVerified = $auth->verifyActivationOtp($smsOtp['challengeToken'], $auth->smsCode, '127.0.0.2');
$smsActivated = $auth->finishActivation($smsVerified['activationToken'], '127.0.0.2');
check(stage5Claims($smsActivated['token'])['amr'] === 'activation_sms_otp', 'SMS activation issues a strong activation session');
$smsLogin = $auth->loginChallenge($siteTwo, 'sms', $smsAccount['mobile'], '', '127.0.0.2');
$smsSession = $auth->verifyLogin('sms', $smsLogin['challengeToken'], $auth->smsCode, '127.0.0.2');
check(stage5Claims($smsSession['token'])['amr'] === 'sms_otp', 'registered mobile plus SMS OTP signs in');

$unknown = $auth->loginChallenge($siteOne, 'email', 'missing@example.test', '', '127.0.0.3');
check(strlen($unknown['challengeToken']) === 43 && $unknown['recipient'] === '***@***', 'unknown email receives a non-enumerating challenge response');
rejects(ErrorCode::SMS_CODE_INVALID, fn () => $auth->verifyLogin('email', $unknown['challengeToken'], '123456', ''),
    'decoy challenge never signs in');

$recovery = $auth->recoveryChallenge($siteOne, 'email', $emailAccount['email'], '127.0.0.4');
$recoveryVerified = $auth->verifyRecoveryOtp($recovery['challengeToken'], $auth->lastEmailCode, '127.0.0.4');
$recoverySetup = $auth->setupRecoveryTotp($recoveryVerified['recoveryToken']);
$recoverySession = $auth->verifyRecoveryTotp(
    $recoveryVerified['recoveryToken'], Totp::code($recoverySetup['manualKey'], intdiv(time(), 30)), '127.0.0.4'
);
check(stage5Claims($recoverySession['token'])['amr'] === 'totp'
    && (int) Db::table('merchant_admin')->where('id', $emailAccount['accountId'])->value('auth_version') > (int) $activationClaims['auth_version'],
    'verified contact recovery rotates Authenticator and revokes old sessions');
rejects(ErrorCode::UNAUTHORIZED, fn () => MerchantAccessGuard::assertSession($emailSession['token'] ? stage5Claims($emailSession['token']) : []),
    'recovery invalidates earlier business sessions');

$audit = json_encode(Db::table('merchant_activity_log')->whereIn('merchant_id', [$emailAccount['merchantId'], $smsAccount['merchantId']])->get()->all());
check(! str_contains((string) $audit, $emailAccount['password']) && ! str_contains((string) $audit, $auth->lastEmailCode)
    && ! str_contains((string) $audit, $totpSecret), 'authentication audit excludes passwords, OTP values and Authenticator secrets');

$config->set('app_env', 'staging');
setMerchantAuthTestMode($config, false, true);
$testAuth = new MerchantAuthenticationService($security, $legacyAuth);
check(! $testAuth->config()['testMode'], 'database switch cannot bypass the deployment capability gate');
setMerchantAuthTestMode($config, true, true);
$testAuth = new MerchantAuthenticationService($security, $legacyAuth);
check($testAuth->config()['testMode'], 'auth config exposes explicitly enabled staging test mode');
$testAccount = stage5Pending($siteOne, 'T0003', 'owner-test@example.test', '+95950000003');
$testStart = $testAuth->startActivation($siteOne, $testAccount['accessCode'], '', '', '');
$testOtp = $testAuth->sendActivationOtp($testStart['activationToken'], 'email', '');
check($testOtp['testMode'] && Db::table('merchant_auth_challenge')->where('token_hash', hash('sha256', $testOtp['challengeToken']))
    ->value('provider_request_id') === MerchantAuthTestMode::OTP_MARKER, 'email test OTP is issued without SMTP and persisted with an explicit test marker');
rejects(ErrorCode::SMS_SEND_TOO_FREQUENT, fn () => $testAuth->sendActivationOtp($testStart['activationToken'], 'email', ''), 'test OTP retains resend cooldown');
rejects(ErrorCode::SMS_CODE_INVALID, fn () => $testAuth->verifyActivationOtp($testOtp['challengeToken'], '111111', ''), 'test mode does not accept arbitrary OTP values');
$testVerified = $testAuth->verifyActivationOtp($testOtp['challengeToken'], '000000', '');
setMerchantAuthTestMode($config, true, false);
rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $testAuth->finishActivation($testVerified['activationToken'], ''), 'disabling test mode invalidates an already verified test activation');
setMerchantAuthTestMode($config, true, true);
$config->set('app_env', 'production');
check(! $testAuth->config()['testMode'], 'production ignores the test-mode flag');
rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $testAuth->finishActivation($testVerified['activationToken'], ''), 'production cannot consume a test activation');
$config->set('app_env', 'staging');
$testSession = $testAuth->finishActivation($testVerified['activationToken'], '');
check(stage5Claims($testSession['token'])['amr'] === 'activation_email_otp', '000000 completes the normal activation state transition');
$testLogin = $testAuth->loginChallenge($siteOne, 'email', $testAccount['email'], '', '');
$config->set('app_env', 'production');
rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $testAuth->verifyLogin('email', $testLogin['challengeToken'], '000000', ''), 'production rejects a pending test login OTP');
$config->set('app_env', 'staging');
check(isset($testAuth->verifyLogin('email', $testLogin['challengeToken'], '000000', '')['token']), 'verified registration email can log in with the test OTP');
rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $testAuth->verifyLogin('email', $testLogin['challengeToken'], '000000', ''), 'test login OTP cannot be replayed');
$testUnknown = $testAuth->loginChallenge($siteOne, 'email', 'missing-test@example.test', '', '');
rejects(ErrorCode::SMS_CODE_INVALID, fn () => $testAuth->verifyLogin('email', $testUnknown['challengeToken'], '000000', ''), 'test OTP cannot authenticate an unknown account');
$unknownSms = $testAuth->loginChallenge($siteOne, 'sms', '+95959999999', '', '');
rejects(ErrorCode::SMS_CODE_INVALID, fn () => $testAuth->verifyLogin('sms', $unknownSms['challengeToken'], '000000', ''), 'unknown SMS test login is rejected without contacting a provider');
$testWrongSite = $testAuth->loginChallenge($siteTwo, 'email', $testAccount['email'], '', '');
rejects(ErrorCode::SMS_CODE_INVALID, fn () => $testAuth->verifyLogin('email', $testWrongSite['challengeToken'], '000000', ''), 'test OTP cannot cross the requested site');
$testRecovery = $testAuth->recoveryChallenge($siteOne, 'email', $testAccount['email'], '');
check(isset($testAuth->verifyRecoveryOtp($testRecovery['challengeToken'], '000000', '')['recoveryToken']), 'test recovery OTP does not require email delivery');
$testSmsAccount = stage5Pending($siteTwo, 'T0004', 'owner-testsms@example.test', '+95950000004');
$testSmsStart = $testAuth->startActivation($siteTwo, $testSmsAccount['accessCode'], '', '', '');
$testSmsOtp = $testAuth->sendActivationOtp($testSmsStart['activationToken'], 'sms', '');
check($testAuth->verifyActivationOtp($testSmsOtp['challengeToken'], '000000', '')['profile']['otpVerified'], 'SMS test OTP verifies without a provider');
$testExpired = stage5Pending($siteTwo, 'T0005', 'owner-expired@example.test', '+95950000005');
$expiredStart = $testAuth->startActivation($siteTwo, $testExpired['accessCode'], '', '', '');
$expiredOtp = $testAuth->sendActivationOtp($expiredStart['activationToken'], 'email', '');
Db::table('merchant_auth_challenge')->where('token_hash', hash('sha256', $expiredOtp['challengeToken']))->update(['expires_at' => '2000-01-01 00:00:00']);
rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $testAuth->verifyActivationOtp($expiredOtp['challengeToken'], '000000', ''), 'expired test OTP is not accepted');
$testAudit = Db::table('merchant_activity_log')->where('merchant_id', $testAccount['merchantId'])->pluck('description')->all();
check(str_contains(implode(' ', $testAudit), 'activation_test_otp_verified') && ! str_contains(implode(' ', $testAudit), '000000'), 'test authentication is distinguishable in audit without logging OTP');
setMerchantAuthTestMode($config, true, false);

echo "Stage 5 merchant activation and login assertions passed\n";
