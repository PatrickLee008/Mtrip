<?php

declare(strict_types=1);
require __DIR__ . '/M12Bootstrap.php';

use App\Service\MerchantAuthenticationService;
use App\Service\MerchantAccountSecurityService;
use App\Service\Merchant\MerchantAuthService;
use App\Service\MerchantPhoneIdentityService;
use App\Service\MerchantRegistrationOtpService;
use App\Service\MerchantDraftExpiryService;
use App\Service\MerchantContactRecoveryService;
use Mtrip\Shared\Context\AdminContext;
use App\Service\OnboardingCredentialDeliveryService;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Merchant\Totp;

class ContactTestAuth extends MerchantAuthenticationService
{
    public string $emailCode = '';
    protected function sendEmailOtp(int $siteId, string $recipient, string $code, string $purpose): bool { $this->emailCode = $code; return true; }
    protected function sendSmsOtp(int $siteId, string $recipient): string { return 'contact-fixture-sms'; }
    protected function verifySmsOtp(int $siteId, string $requestId, string $code): bool { return $requestId === 'contact-fixture-sms' && $code === '654321'; }
}
$aes = (string) $config->get('mtrip.aes_key');
$hash = static fn (string $type, string $plain): string => hash_hmac('sha256', 'merchant-registration-' . $type . '-v1:' . $plain, $aes);
$cipher = static fn (string $plain): string => CryptoHelper::encrypt($plain, $aes);
$otp = $container->get(MerchantRegistrationOtpService::class);
setMerchantAuthTestMode($config, true, true, 'test');
$phone = '+95910000881'; $email = 'phone-unique@example.test';
$otp->send(991, $phone, $email, 'email', '');
$draft = $otp->verify(991, $phone, $email, 'email', '000000');
$draftId = $draft['applicationId'];
$row = (array) Db::table('merchant_application')->where('id', $draftId)->first();
check($row['registration_otp_source'] === 'test' && ! $row['registration_verified_email_at'], 'test registration proof is not real email verification');
rejects(ErrorCode::DATA_CONFLICT, fn () => $otp->send(992, $phone, 'other@example.test', 'sms', ''), 'phone cannot register across emails and sites');
Db::table('merchant_application')->where('id', $draftId)->update(['deleted_at' => gmdate('Y-m-d H:i:s')]);
rejects(ErrorCode::DATA_CONFLICT, fn () => MerchantPhoneIdentityService::assertAvailable($hash('phone', $phone)), 'soft delete does not release phone');
Db::table('merchant_application')->where('id', $draftId)->update(['deleted_at' => null]);
$cooldown = 'mtrip:merchant:registration:cooldown:991:email:' . $hash('email', $email);
$container->get(Redis::class)->del($cooldown);
$otp->send(991, $phone, $email, 'email', '');
check($otp->verify(991, $phone, $email, 'email', '000000')['applicationId'] === $draftId, 'exact original contact pair restores its draft');
Db::table('merchant_application')->where('id', $draftId)->update(['created_at' => gmdate('Y-m-d H:i:s', time() - 8 * 86400), 'last_activity_at' => gmdate('Y-m-d H:i:s')]);
(new MerchantDraftExpiryService())->expireDue();
$row = (array) Db::table('merchant_application')->where('id', $draftId)->first();
check($row['deleted_at'] && $row['registration_phone_released_at'] && $row['registration_email_released_at'], 'fixed seven-day draft expiration releases both identities despite recent activity');
rejects(ErrorCode::UNAUTHORIZED, fn () => $otp->registrationClaims(991, $draft['registrationToken']), 'archived draft token is invalid');
MerchantPhoneIdentityService::assertAvailable($hash('phone', $phone));
check(Db::table('merchant_verify_timeline')->where('application_id', $draftId)->where('action', 'registration_draft_expired')->count() === 1, 'draft release audit is idempotent');

// Simulate an SMTP OTP response without sending any message to an external address.
setMerchantAuthTestMode($config, true, false, 'test');
$realPhone = '+95910000880'; $realEmail = 'real-registration@example.test';
$realKey = 'mtrip:merchant:registration:otp:991:email:' . $hash('email', $realEmail);
$container->get(Redis::class)->setex($realKey, 300, json_encode([
    'type' => 'email', 'codeHash' => hash_hmac('sha256', '482913', (string) $config->get('mtrip.jwt_secret')),
    'attempts' => 0, 'maxAttempts' => 5, 'phoneHash' => $hash('phone', $realPhone), 'emailHash' => $hash('email', $realEmail),
]));
$real = $otp->verify(991, $realPhone, $realEmail, 'email', '482913');
$row = (array) Db::table('merchant_application')->where('id', $real['applicationId'])->first();
check($row['registration_verified_email_at'] && ! $row['registration_verified_mobile_at'] && $row['registration_otp_source'] === 'otp', 'real registration records exactly the channel verified');
Db::table('merchant_application')->where('id', $real['applicationId'])->update(['submitted_at' => gmdate('Y-m-d H:i:s'), 'registration_status' => 1, 'created_at' => gmdate('Y-m-d H:i:s', time() - 8 * 86400)]);
(new MerchantDraftExpiryService())->expireDue();
check(! Db::table('merchant_application')->where('id', $real['applicationId'])->value('registration_phone_released_at'), 'submitted application identity never silently expires');
setMerchantAuthTestMode($config, true, true, 'test');

$merchantId = merchantFixture(); $phone = '+95910000882'; $email = 'contact-owner@example.test'; $now = gmdate('Y-m-d H:i:s');
$secret = Totp::secret();
$accountId = (int) Db::table('merchant_admin')->insertGetId([
    'site_id' => 991, 'merchant_id' => $merchantId, 'account_type' => 2, 'is_owner' => 1,
    'username' => 'contact-owner', 'password' => '', 'mobile' => $cipher($phone), 'mobile_index' => $hash('phone', $phone),
    'email' => $cipher($email), 'email_index' => $hash('email', $email), 'status' => 1,
    'verified_email_at' => $now, 'email_verification_source' => 'otp',
    'two_fa_status' => 1, 'two_fa_secret_enc' => $cipher($secret), 'two_fa_enrolled_at' => $now,
]);
$applicationId = (int) Db::table('merchant_application')->insertGetId([
    'site_id' => 991, 'merchant_id' => $merchantId, 'app_no' => 'CONTACT-OWNER', 'company_name' => 'Contact fixture',
    'registration_phone' => $cipher($phone), 'registration_phone_index' => $hash('phone', $phone),
    'registration_email' => $cipher($email), 'registration_email_index' => $hash('email', $email),
    'registration_status' => 3, 'final_approved_at' => $now,
]);
$context = ['admin_id' => $accountId, 'merchant_id' => $merchantId, 'site_id' => 991, 'account_type' => 2, 'is_owner' => true];
MerchantContext::set($context);
$auth = new ContactTestAuth(new MerchantAccountSecurityService(), $container->get(MerchantAuthService::class));
check($auth->contacts()['contacts'][1]['status'] === 'unverified', 'settings shows unverified mobile');
$sms = $auth->sendContactOtp('sms', '');
$state = $auth->verifyContactOtp($sms['challengeToken'], '000000', '');
check($state['contacts'][1]['status'] === 'unverified' && Db::table('merchant_admin')->where('id', $accountId)->value('test_verified_mobile_at'), 'test supplement does not mark mobile really verified');
setMerchantAuthTestMode($config, true, false, 'test');
$sms = $auth->sendContactOtp('sms', '');
rejects(ErrorCode::SMS_CODE_INVALID, fn () => $auth->verifyContactOtp($sms['challengeToken'], '111111', ''), 'wrong contact code rejected');
MerchantContext::set(array_replace($context, ['is_owner' => false]));
rejects(ErrorCode::FORBIDDEN, fn () => $auth->contacts(), 'employee cannot access owner contact identities');
MerchantContext::set(array_replace($context, ['site_id' => 992]));
rejects(ErrorCode::FORBIDDEN, fn () => $auth->verifyContactOtp($sms['challengeToken'], '654321', ''), 'cross-site contact update rejected');
MerchantContext::set($context);
$state = $auth->verifyContactOtp($sms['challengeToken'], '654321', '');
check($state['contacts'][1]['status'] === 'verified' && $state['contacts'][1]['source'] === 'otp', 'real SMS supplement enables verified mobile');
rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $auth->verifyContactOtp($sms['challengeToken'], '654321', ''), 'contact OTP cannot be replayed');
$login = $auth->loginChallenge(0, 'sms', $phone, '', '');
check((int) Db::table('merchant_auth_challenge')->where('token_hash', hash('sha256', $login['challengeToken']))->value('account_id') === $accountId, 'verified phone locates OTP login account');

// Rebind requires existing real-channel OTP, TOTP and unique new contact OTP.
rejects(ErrorCode::UNAUTHORIZED, fn () => $auth->startRebind('email', '000000', ''), 'rebind requires valid authenticator');
$start = $auth->startRebind('email', Totp::code($secret, intdiv(time(), 30)), '');
$oldCode = $auth->emailCode;
$nextPhone = '+95910000883';
$new = $auth->sendRebindNew($start['challengeToken'], $oldCode, 'sms', $nextPhone, '');
$version = (int) Db::table('merchant_admin')->where('id', $accountId)->value('auth_version');
check($auth->finishRebind($new['challengeToken'], '654321', '')['requiresLogin'], 'secure rebind completes after both OTPs');
$row = (array) Db::table('merchant_admin')->where('id', $accountId)->first();
check($row['mobile_index'] === $hash('phone', $nextPhone) && (int) $row['auth_version'] === $version + 1, 'rebind updates identity and revokes old sessions');
check(Db::table('merchant_contact_identity_history')->where('account_id', $accountId)->value('contact_hash') === $hash('phone', $phone), 'rebind preserves released old contact audit');
MerchantPhoneIdentityService::assertAvailable($hash('phone', $phone));
rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $auth->verifyLogin('sms', $login['challengeToken'], '654321', ''), 'old login challenges revoked by rebind');
check(Db::table('merchant_application')->where('id', $applicationId)->value('registration_phone_index') === $hash('phone', $nextPhone), 'linked application shares the new account identity');

// Employee phone contact can repeat, disabled/deleted owner phones still reserve.
Db::table('merchant_admin')->insert(['site_id' => 991, 'merchant_id' => $merchantId, 'is_owner' => 0, 'username' => 'contact-employee', 'password' => '', 'mobile_index' => $hash('phone', $nextPhone)]);
check(true, 'employee contact phone is outside owner uniqueness');
Db::table('merchant_admin')->where('id', $accountId)->update(['status' => 0, 'deleted_at' => $now]);
rejects(ErrorCode::DATA_CONFLICT, fn () => MerchantPhoneIdentityService::assertAvailable($hash('phone', $nextPhone)), 'disabled deleted owner still reserves identity');
Db::table('merchant_admin')->where('id', $accountId)->update(['status' => 2, 'deleted_at' => null, 'verified_email_at' => null, 'verified_mobile_at' => null, 'credential_expires_at' => gmdate('Y-m-d H:i:s', time() - 1)]);
$account = (array) Db::table('merchant_admin')->where('id', $accountId)->first();
$delivery = new OnboardingCredentialDeliveryService();
$delivery->create((array) Db::table('merchant_application')->where('id', $applicationId)->first(), $merchantId, $accountId, 'contact-claim-request', ['sms'], ['accessCode' => 'H01234', 'username' => 'contact-owner', 'temporaryPassword' => 'fixture-password']);
$receipts = $delivery->deliverApplication($applicationId, false);
check($receipts[0]['status'] === 'pending' && $receipts[0]['lastError'] === 'recipient_otp_required', 'unverified recipient cannot receive credentials');
$claim = $auth->claimPhoneOtp('CONTACT-OWNER', $nextPhone, 'claim-ip');
rejects(ErrorCode::SMS_CODE_INVALID, fn () => $auth->claimEmailOtp($claim['challengeToken'], '111111', ''), 'email recipient alone cannot claim credentials');
$emailProof = $auth->claimEmailOtp($claim['challengeToken'], '654321', '');
$claimed = $auth->claimCredentials($emailProof['challengeToken'], $auth->emailCode, '');
$row = (array) Db::table('merchant_admin')->where('id', $accountId)->first();
check($row['verified_email_at'] && $row['verified_mobile_at'] && strtotime($row['credential_expires_at'] . ' UTC') > time(), 'dual real OTP claim records contacts and renews expired credentials');
check(count($claimed['deliveries']) === 2, 'fallback creates email delivery only after dual proof');
rejects(ErrorCode::SMS_CODE_EXPIRED, fn () => $auth->claimCredentials($emailProof['challengeToken'], $auth->emailCode, ''), 'credential email proof is one-time');
$decoy = $auth->claimPhoneOtp('UNKNOWN-APPLICATION', '+95910000111', 'claim-ip');
rejects(ErrorCode::SMS_CODE_INVALID, fn () => $auth->claimEmailOtp($decoy['challengeToken'], '654321', ''), 'unknown application gets decoy OTP, never account access');

AdminContext::set(['admin_id' => 999, 'admin_name' => 'Contact QA', 'site_id' => 991, 'is_super' => false]);
$recovery = new MerchantContactRecoveryService();
rejects(ErrorCode::FORBIDDEN, fn () => $recovery->correct($merchantId, '+95910000884', 'corrected@example.test', 'Documented identity review fixture'), 'ordinary admin cannot correct login contacts');
AdminContext::set(['admin_id' => 999, 'admin_name' => 'Contact QA', 'site_id' => 0, 'is_super' => true]);
rejects(ErrorCode::PARAM_ERROR, fn () => $recovery->correct($merchantId, '+95910000884', 'corrected@example.test', 'short'), 'manual correction requires identity review reason');
$recovery->correct($merchantId, '+95910000884', 'corrected@example.test', 'Documented identity review fixture');
$row = (array) Db::table('merchant_admin')->where('id', $accountId)->first();
check(! $row['verified_email_at'] && ! $row['verified_mobile_at'] && $row['email_verification_source'] === 'admin', 'manual correction resets proof and never verifies contacts');
check(Db::table('merchant_verify_timeline')->where('application_id', $applicationId)->where('action', 'contact_corrected_after_identity_review')->count() === 1, 'manual correction retains operator and identity review audit');
MerchantPhoneIdentityService::assertAvailable($hash('phone', $nextPhone));

// The retained legacy admin approval path must not bypass main-account phone ownership.
$legacyId = merchantFixture(992, 0);
$legacy = (array) Db::table('merchant_info')->where('id', $legacyId)->first();
$legacy['contact_phone'] = $cipher('+95910000884');
$before = Db::table('merchant_admin')->count();
rejects(ErrorCode::DATA_CONFLICT, fn () => (new \App\Service\MerchantService())->approve($legacy, 'Fixture'), 'legacy administrator approval cannot duplicate owner phone');
check(Db::table('merchant_admin')->count() === $before && (int) Db::table('merchant_info')->where('id', $legacyId)->value('status') === 0, 'legacy phone conflict leaves approval entities untouched');

// Two tables racing with different emails for one phone have exactly one winner.
$processes = [];
$raceHash = $hash('phone', '+95910000777');
foreach (['application', 'account'] as $mode) {
    $process = proc_open([PHP_BINARY, '/tmp/phone-identity-worker.php', $mode, $hash('email', 'race-' . $mode . '@example.test'), $raceHash, (string) $merchantId],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    fclose($pipes[0]); $processes[] = [$process, $pipes];
}
$wins = 0;
foreach ($processes as [$process, $pipes]) {
    $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    check(proc_close($process) === 0, 'phone concurrency worker completes without deadlock: ' . $err);
    $result = json_decode($out, true); if ($result['ok']) ++$wins;
}
check($wins === 1, 'cross-table parallel phone reservation has exactly one owner');
$container->get(Redis::class)->del($cooldown);
$claimPrefix = 'mtrip:merchant:credential-claim:' . (string) $config->get('databases.default.database') . ':';
$container->get(Redis::class)->del($claimPrefix . 'ip:' . hash_hmac('sha256', 'claim-ip', (string) $config->get('mtrip.jwt_secret')),
    $claimPrefix . 'contact:' . $hash('phone', $nextPhone), $claimPrefix . 'contact:' . $hash('phone', '+95910000111'));
echo "Merchant contact security regression complete\n";
