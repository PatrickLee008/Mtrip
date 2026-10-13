<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\MerchantAuthenticationService;
use App\Service\MerchantEmailIdentityService;
use App\Service\MerchantRegistrationOtpService;
use App\Service\OnboardingFinalApprovalService;
use App\Service\OnboardingKycService;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Support\CryptoHelper;

$aes = (string) $config->get('mtrip.aes_key');
$hash = static fn (string $email): string => hash_hmac('sha256', 'merchant-registration-email-v1:' . strtolower(trim($email)), $aes);
$email = 'identity-reservation@example.test';
$emailHash = $hash($email);
$merchantId = merchantFixture();
$accountId = (int) Db::table('merchant_admin')->insertGetId([
    'site_id' => 991, 'merchant_id' => $merchantId, 'username' => 'identity-owner',
    'password' => password_hash('Identity-fixture-4829', PASSWORD_BCRYPT), 'is_owner' => 1,
    'email' => CryptoHelper::encrypt($email, $aes), 'email_index' => $emailHash,
    'verified_email_at' => gmdate('Y-m-d H:i:s'), 'status' => 2,
]);
$audit = static function (): array {
    $process = proc_open([PHP_BINARY, '/opt/www/bin/audit-email-identities.php'],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (! is_resource($process)) throw new RuntimeException('Cannot start read-only audit');
    fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]);
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    $code = proc_close($process);
    $result = json_decode($output, true);
    if (! is_array($result)) throw new RuntimeException('Audit failed: ' . $error);
    return [$code, $result];
};
check($audit() === [0, ['conflicts' => [], 'anomalies' => []]], 'read-only audit accepts a valid standalone account');
Db::table('merchant_admin')->where('id', $accountId)->update(['email_index' => str_repeat('f', 64)]);
[$auditCode, $auditResult] = $audit();
check($auditCode === 2 && $auditResult['anomalies'][0]['reason'] === 'missing_or_stale_hash',
    'audit detects stale hashes from normalized decrypted email');
Db::table('merchant_admin')->where('id', $accountId)->update(['email_index' => $emailHash, 'email' => '']);
[$auditCode, $auditResult] = $audit();
check($auditCode === 2 && $auditResult['anomalies'][0]['reason'] === 'missing_encrypted_email',
    'audit detects a reserved hash without an encrypted email');
Db::table('merchant_admin')->where('id', $accountId)->update(['email' => CryptoHelper::encrypt($email, $aes)]);
$otp = $container->get(MerchantRegistrationOtpService::class);
setMerchantAuthTestMode($config, true, true, 'test');
foreach ([2, 0, 1] as $status) {
    Db::table('merchant_admin')->where('id', $accountId)->update(['status' => $status]);
    rejects(ErrorCode::DATA_CONFLICT, fn () => $otp->send(992, '+95911123999', strtoupper($email), 'sms', ''),
        'account status ' . $status . ' does not release its email');
}
$now = gmdate('Y-m-d H:i:s');
Db::table('merchant_admin')->where('id', $accountId)->update(['deleted_at' => $now]);
rejects(ErrorCode::DATA_CONFLICT, fn () => MerchantEmailIdentityService::assertAvailable($emailHash),
    'soft deletion alone does not release an email');
Db::table('merchant_admin')->where('id', $accountId)->update(['email_released_at' => $now]);
MerchantEmailIdentityService::assertAvailable($emailHash);
check(Db::table('merchant_admin')->where('id', $accountId)->value('email_index') === $emailHash,
    'explicit release preserves historical encrypted email and hash');

$sent = $otp->send(992, '+95911123999', $email, 'email', '');
$registration = $otp->verify(992, '+95911123999', $email, 'email', '000000');
check($sent['testMode'] && $registration['applicationId'] > 0, 'released email can register a new application');
$applicationId = $registration['applicationId'];
Db::table('merchant_application')->where('id', $applicationId)->update(['deleted_at' => $now]);
rejects(ErrorCode::DATA_CONFLICT, fn () => MerchantEmailIdentityService::assertAvailable($emailHash),
    'archiving an application alone does not release its email');
Db::table('merchant_application')->where('id', $applicationId)->update(['registration_email_released_at' => $now]);
MerchantEmailIdentityService::assertAvailable($emailHash);
check(true, 'explicit application release frees the email');

$approvedEmail = 'identity-approval@example.test';
$approvedHash = $hash($approvedEmail);
$applicationId = (int) Db::table('merchant_application')->insertGetId([
    'site_id' => 991, 'app_no' => 'EMAIL-APPROVAL', 'company_name' => 'Email identity fixture',
    'registration_phone' => CryptoHelper::encrypt('+95911123888', $aes),
    'registration_email' => CryptoHelper::encrypt($approvedEmail, $aes), 'registration_email_index' => $approvedHash,
    'registration_channel' => 'email', 'contact_data_status' => 0, 'state_model_version' => 1,
    'registration_status' => 3,
]);
$conflictingAccount = (int) Db::table('merchant_admin')->insertGetId([
    'site_id' => 992, 'merchant_id' => $merchantId, 'username' => 'identity-conflict',
    'password' => '', 'email' => CryptoHelper::encrypt($approvedEmail, $aes), 'email_index' => $approvedHash,
    'is_owner' => 1, 'status' => 2,
]);
AdminContext::set(['admin_id' => 99001, 'admin_name' => 'Email Identity QA', 'site_id' => 0, 'is_super' => true]);
$before = [Db::table('merchant_info')->count(), Db::table('merchant_admin')->count(), Db::table('merchant_store')->count()];
rejects(ErrorCode::DATA_CONFLICT, fn () => $container->get(OnboardingFinalApprovalService::class)
    ->approve($applicationId, 'email-conflict-approval', ['email']), 'final approval rejects an email held by another account');
check($before === [Db::table('merchant_info')->count(), Db::table('merchant_admin')->count(), Db::table('merchant_store')->count()],
    'email conflict creates no merchant, account or property');
$app = (array) Db::table('merchant_application')->where('id', $applicationId)->first();
check(in_array('registration_email_conflict', $container->get(OnboardingKycService::class)->readiness($app)['reasons'], true),
    'admin readiness explains email conflicts');
Db::table('merchant_admin')->where('id', $conflictingAccount)->delete();

rejects(ErrorCode::DATA_CONFLICT, fn () => MerchantEmailIdentityService::transaction($approvedHash,
    fn () => Db::table('merchant_application')->insert([
        'site_id' => 992, 'app_no' => 'EMAIL-DIRECT-DUPLICATE', 'company_name' => 'Duplicate',
        'registration_email_index' => $approvedHash,
    ])), 'database rejects duplicate application emails across sites with a business error');
$occupiedAccountHash = $hash('identity-account-unique@example.test');
Db::table('merchant_admin')->insert(['site_id' => 991, 'merchant_id' => $merchantId, 'username' => 'email-index-one',
    'password' => '', 'email_index' => $occupiedAccountHash]);
rejects(ErrorCode::DATA_CONFLICT, fn () => MerchantEmailIdentityService::transaction($occupiedAccountHash,
    fn () => Db::table('merchant_admin')->insert(['site_id' => 992, 'merchant_id' => $merchantId,
        'username' => 'email-index-two', 'password' => '', 'email_index' => $occupiedAccountHash])),
    'database rejects duplicate account emails across sites with a business error');

// Simulate a legacy duplicate before the unique migration to verify safe login behavior.
Db::statement('ALTER TABLE merchant_admin DROP INDEX uk_merchant_account_email_identity');
$conflictingAccount = (int) Db::table('merchant_admin')->insertGetId([
    'site_id' => 991, 'merchant_id' => $merchantId, 'username' => 'email-legacy-duplicate', 'password' => '',
    'email_index' => $occupiedAccountHash, 'email' => CryptoHelper::encrypt('identity-account-unique@example.test', $aes),
    'status' => 1, 'verified_email_at' => $now,
]);
$challenge = $container->get(MerchantAuthenticationService::class)->loginChallenge(0, 'email', 'identity-account-unique@example.test', '', '');
check((int) Db::table('merchant_auth_challenge')->where('token_hash', hash('sha256', $challenge['challengeToken']))->value('account_id') === 0,
    'legacy duplicate email never selects an arbitrary account or sends an OTP');
check(Db::table('merchant_activity_log')->where('description', 'like', '%email_identity_conflict%')->count() === 2,
    'legacy email conflict is recorded without plaintext contact or credentials');
Db::table('merchant_admin')->where('id', $conflictingAccount)->delete();
Db::statement('ALTER TABLE merchant_admin ADD UNIQUE INDEX uk_merchant_account_email_identity (email_identity_key)');

foreach ([false, true] as $independent) {
    $processes = [];
    foreach (['application', 'account'] as $mode) {
        $plainEmail = $independent ? 'identity-independent-' . $mode . '@example.test' : 'identity-race@example.test';
        $raceHash = $hash($plainEmail);
        Db::table('merchant_email_identity_lock')->insertOrIgnore(['email_hash' => $raceHash]);
        $process = proc_open([PHP_BINARY, '/tmp/email-identity-worker.php', $mode, $raceHash, (string) $merchantId, $plainEmail],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (! is_resource($process)) throw new RuntimeException('Cannot start concurrency worker');
        fclose($pipes[0]);
        $processes[] = [$process, $pipes];
    }
    $successes = 0;
    foreach ($processes as [$process, $pipes]) {
        $output = stream_get_contents($pipes[1]);
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        check(proc_close($process) === 0, 'cross-table concurrency worker completed: ' . $error);
        $result = json_decode(trim($output), true);
        check(is_array($result) && isset($result['ok']), 'concurrency worker returned a result');
        if ($result['ok']) ++$successes;
    }
    check($successes === ($independent ? 2 : 1), $independent ? 'different emails can be claimed concurrently'
        : 'concurrent application and account creation cannot claim the same email');
    if (! $independent) check(Db::table('merchant_application')->where('registration_email_index', $raceHash)->count()
        + Db::table('merchant_admin')->where('email_index', $raceHash)->count() === 1,
        'one email has exactly one identity owner after the race');
}
$container->get(Redis::class)->del('mtrip:merchant:registration:cooldown:992:email:' . $emailHash);
echo "Email identity integration complete\n";
