<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\MerchantDeletionService;
use App\Service\MerchantAuthenticationService;
use App\Service\Merchant\MerchantAuthService;
use App\Service\MerchantAccountSecurityService;
use App\Service\MerchantService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\JwtHelper;
use function Hyperf\Config\config;

check(class_exists(MerchantDeletionService::class), 'Merchant deletion workflow exists');
$auth = new MerchantAuthenticationService(new MerchantAccountSecurityService(), new MerchantAuthService());
$service = new MerchantDeletionService($auth, new MerchantService());
setMerchantAuthTestMode($config, true, true, 'dev');
$merchant = merchantFixture();
$site = 991;
$email = 'closure-' . bin2hex(random_bytes(8)) . '@example.test';
$key = config('mtrip.aes_key');
$account = Db::table('merchant_admin')->insertGetId([
    'site_id' => $site, 'merchant_id' => $merchant, 'username' => $email,
    'account_type' => 2, 'is_owner' => 1, 'status' => 1,
    'password' => password_hash('Isolation-only-password', PASSWORD_BCRYPT),
    'email' => CryptoHelper::encrypt($email, $key),
    'email_index' => hash_hmac('sha256', 'merchant-registration-email-v1:' . $email, $key),
    'verified_email_at' => gmdate('Y-m-d H:i:s'),
]);
$identity = ['admin_id' => $account, 'admin_name' => 'Owner', 'site_id' => $site,
    'merchant_id' => $merchant, 'account_type' => 2, 'is_owner' => true];
MerchantContext::set(array_replace($identity, ['is_owner' => false]));
rejects(40301, fn () => $service->current(), 'employee cannot open the application');
MerchantContext::set($identity);
check($service->current()['request'] === null, 'no prior request');
$send = function () use ($service, $account): string {
    Db::table('merchant_auth_challenge')->where('account_id', $account)->update(['resend_available_at' => null]);
    return $service->send('email', '127.0.0.1')['challengeToken'];
};
$token = $send();
rejects(40021, fn () => $service->submit('unused', '', $token, '999999', ''), 'incorrect OTP');
check((int) Db::table('merchant_auth_challenge')->where('account_id', $account)->value('attempts') === 1, 'failed attempt is persisted');
$request = $service->submit('unused', '', $token, '000000', '');
check($request['status'] === 'pending', 'valid OTP submits a pending request');
rejects(40901, fn () => $service->send('email', ''), 'only one pending request per merchant');
rejects(40401, fn () => $service->receipt($request['id'], 'incorrect'), 'receipt rejects incorrect token');
rejects(40401, fn () => $service->receipt($request['id'], $request['receiptToken'], 992), 'receipt rejects incorrect client site');
AdminContext::set(['admin_id' => 5, 'site_id' => 992, 'permissions' => ['merchant:deletion:list']]);
rejects(40401, fn () => $service->detail($request['id']), 'detail is scoped to admin site');
check((int) Db::table('merchant_info')->where('id', $merchant)->value('status') === 3, 'pending does not change access');
rejects(40901, fn () => (new MerchantService())->close(['id' => $merchant, 'site_id' => $site], 'Legacy closure'), 'legacy closure cannot bypass the pending review');
$service->cancel($request['id'], '');
rejects(40022, fn () => $service->submit('unused', '', $token, '000000', ''), 'OTP cannot be replayed after cancellation');
$expired = $send();
Db::table('merchant_auth_challenge')->where('token_hash', hash('sha256', $expired))->update(['expires_at' => '2000-01-01 00:00:00']);
rejects(40022, fn () => $service->submit('unused', '', $expired, '000000', ''), 'expired OTP cannot submit');
$request = $service->submit('privacy', 'Privacy request', $send(), '000000', '');
AdminContext::set(['admin_id' => 5, 'admin_name' => 'Site operator', 'site_id' => $site, 'permissions' => ['merchant:deletion:review']]);
rejects(40301, fn () => $service->review($request['id'], 'approved', 'Test', ''), 'site admin cannot approve');
AdminContext::set(['admin_id' => 7, 'admin_name' => 'Platform admin', 'site_id' => 0, 'is_super' => true]);
rejects(40001, fn () => $service->review($request['id'], 'rejected', ' ', ''), 'review note is mandatory');
$service->review($request['id'], 'rejected', 'Rejected for test', '');
check($service->current()['request']['reviewNote'] === 'Rejected for test', 'owner sees rejection reason');
rejects(40901, fn () => $service->cancel($request['id'], ''), 'reviewed request cannot be cancelled');
$accountRow = (array) Db::table('merchant_admin')->where('id', $account)->first();
$session = (new MerchantAuthService())->issueSession($accountRow);
$claims = JwtHelper::verify($session['token'], config('mtrip.jwt_secret'));
MerchantAccessGuard::assertSession($claims);
$request = $service->submit('unused', '', $send(), '000000', '');
$order = Db::table('order_main')->insertGetId([
    'site_id' => $site, 'merchant_id' => $merchant, 'order_no' => 'deletion-test-' . bin2hex(random_bytes(6)),
    'goods_name' => 'Test booking', 'sku_name' => 'Test room', 'contact_name' => 'Fixture', 'contact_phone' => '', 'order_status' => 2, 'booking_status' => 3,
]);
rejects(40901, fn () => $service->review($request['id'], 'approved', 'Approved for test', ''), 'approval preserves in-progress stays');
MerchantAccessGuard::assertSession($claims);
check($service->current()['request']['status'] === 'pending', 'blocked approval rolls back');
Db::table('order_main')->where('id', $order)->update(['order_status' => 3, 'booking_status' => 4]);
Db::table('merchant_info')->where('id', $merchant)->update(['access_code' => 'M12-DELETION-TEST']);
$service->review($request['id'], 'approved', 'Approved for test', '');
check(Db::table('order_main')->where('id', $order)->whereNull('deleted_at')->value('order_status') == 3, 'completed booking is retained');
rejects(40901, fn () => $service->review($request['id'], 'approved', 'Duplicate', ''), 'review does not repeat');
rejects(40101, fn () => (new MerchantAuthService())->login($email, 'Isolation-only-password', ''), 'new Web login is blocked');
rejects(40101, fn () => (new MerchantAccountSecurityService())->beginWithAccessCode('M12-DELETION-TEST'), 'new App login is blocked');
rejects(40301, fn () => MerchantAccessGuard::assertSession($claims), 'approval revokes the live session');
check((int) Db::table('merchant_admin')->where('id', $account)->value('auth_version') === ((int) $accountRow['auth_version'] + 1),
    'approval invalidates issued auth versions');
check(Db::table('merchant_info')->where('id', $merchant)->whereNull('deleted_at')->value('status') == 5, 'merchant record is retained');
check(Db::table('merchant_notify')->where('recipient_id', $account)->count() === 6, 'all six transitions deliver owner notifications');
check($service->receipt($request['id'], $request['receiptToken'])['status'] === 'approved', 'signed-in applicant can retain a read-only outcome receipt');
