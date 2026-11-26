<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\MerchantLoginControlService;
use App\Service\MerchantAccountSecurityService;
use App\Service\MerchantAuthenticationService;
use Hyperf\Context\RequestContext;
use Hyperf\HttpMessage\Server\Request;
use Mtrip\Shared\Auth\BrowserSessionService;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Merchant\Totp;
use Mtrip\Shared\Support\CryptoHelper;
use App\Service\Merchant\MerchantAuthService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
use Mtrip\Shared\Merchant\MerchantSessions;
use Mtrip\Shared\Support\JwtHelper;

check(class_exists(MerchantLoginControlService::class), 'merchant login controls are available');
$merchantId = merchantFixture();
$otherMerchant = merchantFixture();
$fixture = static function (int $merchant, string $name): array {
    $id = Db::table('merchant_admin')->insertGetId([
        'merchant_id' => $merchant, 'site_id' => 991, 'username' => $name, 'password' => password_hash('test-only', PASSWORD_BCRYPT),
        'status' => 1, 'account_type' => 2, 'is_owner' => 1,
    ]);
    return (array) Db::table('merchant_admin')->where('id', $id)->first();
};
$owner = $fixture($merchantId, 'login-controls-owner');
$other = $fixture($otherMerchant, 'login-controls-other');
$claims = static function (array $account): array {
    $session = (new MerchantAuthService())->issueSession($account);
    return JwtHelper::verify($session['token'], (string) \Hyperf\Config\config('mtrip.jwt_secret'));
};
$active = $claims($owner);
$unrelated = $claims($other);
$service = new MerchantLoginControlService();
$merchant = (array) Db::table('merchant_info')->where('id', $merchantId)->first();
$email = 'm12-login-control@example.test';
$key = (string) \Hyperf\Config\config('mtrip.aes_key');
$secret = Totp::secret();
Db::table('merchant_info')->where('id', $merchantId)->update(['access_code' => 'M12-LOGIN-POLICY']);
Db::table('merchant_admin')->where('id', $owner['id'])->update([
    'two_fa_status' => 1, 'two_fa_secret_enc' => CryptoHelper::encrypt($secret, $key),
    'email' => CryptoHelper::encrypt($email, $key), 'verified_email_at' => gmdate('Y-m-d H:i:s'),
    'email_index' => hash_hmac('sha256', 'merchant-registration-email-v1:' . $email, $key),
]);
setMerchantAuthTestMode($config, true, true, 'dev');
$security = new MerchantAccountSecurityService();
$auth = new MerchantAuthenticationService($security, new MerchantAuthService());
$started = $auth->loginChallenge(991, 'email', $email, '', '');
$qr = $security->createAppPairing($security->beginWithAccessCode('M12-LOGIN-POLICY')['challengeToken']);
check(Db::table('merchant_login_pairing')->where('code_hash', hash('sha256', $qr['pairingCode']))->exists(), 'QR is stored in the ledger');
$browser = $container->get(BrowserSessionService::class);
$web = $browser->start((new MerchantAuthService())->issueSession($owner), 'merchant');
$renew = fn () => (new MerchantAuthService())->issueSession($owner, record: false);
$refresh = $browser->refresh($web['cookie'], 'merchant', $renew);
$webClaims = JwtHelper::verify($refresh['data']['token'], (string) \Hyperf\Config\config('mtrip.jwt_secret'));
MerchantAccessGuard::assertSession($webClaims);
check(isset($webClaims['merchant_session_id']), 'Web refresh preserves the tracked session');

$service->change($merchant, 'disable_email', 0, 'Lost contact', false, ['id' => 400, 'name' => 'Fixture Super'], '');
check(!MerchantSessions::methodEnabled($owner, 'email'), 'disabled email policy');
check(MerchantSessions::methodEnabled($owner, 'sms'), 'the other contact policy remains enabled');
rejects(40101, fn () => MerchantAccessGuard::assertSession($active), 'old session is invalid immediately');
MerchantAccessGuard::assertSession($unrelated);
check(true, 'unrelated merchant session remains usable');
rejects(40001, fn () => $service->change($merchant, 'enable_email', 0, 'Review not yet completed', false, ['id' => 400, 'name' => 'Fixture Super'], ''), 'enable requires confirmed review');
$service->change($merchant, 'enable_email', 0, 'Review completed', true, ['id' => 400, 'name' => 'Fixture Super'], '');
check(MerchantSessions::methodEnabled($owner, 'email'), 'reviewed method is enabled');
check((int) Db::table('merchant_info')->where('id', $merchantId)->value('status') === 3, 'merchant operating status preserved');
check(Db::table('merchant_login_audit')->where('merchant_id', $merchantId)->count() === 2, 'both changes audited');

rejects(40022, fn () => $auth->verifyLogin('email', $started['challengeToken'], '000000', ''), 'disabled and restored email does not revive an old OTP');
rejects(40101, fn () => $security->exchangeAppPairing($qr['pairingCode']), 'disabled login invalidates QR after restore');
rejects(40101, fn () => $browser->refresh($refresh['cookie'], 'merchant', $renew), 'revocation blocks Web refresh');
$browser->revoke($refresh['data']['token'], 'merchant');
$audit = $service->snapshot((array) Db::table('merchant_info')->where('id', $merchantId)->first());
check((int) $audit['audit'][1]['changes']['pairings'] === 1, 'audit stores the exact invalidated pending QR count');
check($audit['methods'][1]['identifier'] !== $email && str_contains($audit['methods'][1]['identifier'], '@'), 'email is masked in the overview');

RequestContext::set((new Request('POST', '/api/v1/app/merchant/auth/2fa/verify'))->withHeader('X-Client-Type', 'app-ios'));
$access = $security->beginWithAccessCode('M12-LOGIN-POLICY');
$app = $security->verify($access['challengeToken'], Totp::code($secret, intdiv(time(), 30)), '');
$appClaims = JwtHelper::verify($app['token'], (string) \Hyperf\Config\config('mtrip.jwt_secret'));
MerchantContext::set($appClaims);
$freshOwner = (array) Db::table('merchant_admin')->where('id', $owner['id'])->first();
$anotherSession = $claims($freshOwner);
$device = $service->trustDevice(str_repeat('a', 64), 'ios', 'Test iPhone');
check(count($service->ownSessions()) === 2, 'session list shows both active sign-ins');
$service->change($merchant, 'revoke_device', $device, 'Lost phone', false, ['id' => 400, 'name' => 'Fixture Super'], '');
rejects(40101, fn () => MerchantAccessGuard::assertSession($appClaims), 'device revocation ends its linked session');
MerchantAccessGuard::assertSession($anotherSession);
check(true, 'device revocation preserves another session of the same merchant');
rejects(40101, fn () => $service->trustDevice(str_repeat('a', 64), 'ios', 'Test iPhone'), 'revoked session cannot re-establish trust');
MerchantContext::set($anotherSession);
rejects(40301, fn () => $service->trustDevice(str_repeat('a', 64), 'ios', 'Test iPhone'), 'new trust requires access-code authentication');
$service->change($merchant, 'logout_all', 0, 'End all active sessions', false, ['id' => 400, 'name' => 'Fixture Super'], '');
rejects(40101, fn () => MerchantAccessGuard::assertSession($anotherSession), 'force logout also revokes the remaining session');
MerchantAccessGuard::assertSession($unrelated);
check(true, 'force logout remains scoped to the selected merchant');
