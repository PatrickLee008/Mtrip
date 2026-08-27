<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\MerchantAccountSecurityService;
use App\Service\MerchantImpersonationService;
use App\Service\Merchant\MerchantAuthService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
use Mtrip\Shared\Merchant\MerchantImpersonationGuard;
use Mtrip\Shared\Merchant\Totp;
use Mtrip\Shared\Support\JwtHelper;
use Mtrip\Shared\Support\CryptoHelper;

$security = new MerchantAccountSecurityService();
$support = new MerchantImpersonationService();
$auth = new MerchantAuthService();
if (($argv[1] ?? '') === '--verify') {
    try { $security->verify($argv[2], $argv[3], '127.0.0.1'); echo 'ok'; }
    catch (\Mtrip\Shared\Exception\BusinessException $e) { echo 'denied'; }
    exit;
}
if (($argv[1] ?? '') === '--exchange') {
    try { $support->exchange($argv[2]); echo 'ok'; }
    catch (\Mtrip\Shared\Exception\BusinessException $e) { echo 'denied'; }
    exit;
}
function s4Parallel(array $args): array {
    $command = PHP_BINARY . ' ' . escapeshellarg(__FILE__) . ' ' . implode(' ', array_map('escapeshellarg', $args));
    $one = $two = [];
    $p1 = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $one);
    $p2 = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $two);
    $outputs = [];
    foreach ([[$p1, $one], [$p2, $two]] as [$process, $pipes]) {
        $outputs[] = stream_get_contents($pipes[1]); $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        if (proc_close($process) !== 0) throw new RuntimeException('S4 child failed: ' . $error);
    }
    sort($outputs);
    return $outputs;
}
$merchants = $accounts = $operators = $groups = $stores = [];
$fault = null;
$fixtureMenu = null;
function s4Actor(bool $super = true, int $site = 991, ?int $id = null): void {
    global $operators;
    AdminContext::set(['admin_id' => $id ?? $operators[0], 'admin_name' => 'S4 Administrator', 'site_id' => $site, 'is_super' => $super, 'permissions' => ['merchant:list:2fa', 'merchant:list:impersonate']]);
}
function s4Account(int $merchant, int $site = 991, int $type = 2, int $group = 0, int $store = 0): int {
    global $accounts;
    return $accounts[] = (int) Db::table('merchant_admin')->insertGetId(['site_id' => $site, 'merchant_id' => $merchant, 'group_id' => $group, 'store_id' => $store, 'account_type' => $type, 'username' => 's4-' . bin2hex(random_bytes(6)), 'password' => password_hash('S4-fixture-password123', PASSWORD_BCRYPT), 'real_name' => 'S4 Account', 'status' => 1, 'is_owner' => 1]);
}
function s4Login(int $id): array {
    global $auth;
    return $auth->login((string) Db::table('merchant_admin')->where('id', $id)->value('username'), 'S4-fixture-password123', '127.0.0.1');
}
function s4Claims(string $token): array { global $config; return JwtHelper::verify($token, (string) $config->get('mtrip.jwt_secret')); }
function s4Code(string $secret): string { return Totp::code($secret, intdiv(time(), 30)); }
function s4Request(string $token, string $method = 'GET', string $path = '/api/v1/merchant/order/list'): array {
    global $config;
    $handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
        public function handle(\Psr\Http\Message\ServerRequestInterface $request): \Psr\Http\Message\ResponseInterface {
            return (new \Hyperf\HttpMessage\Server\Response())->withBody(new \Hyperf\HttpMessage\Stream\SwooleStream(json_encode(['code' => 0, 'data' => MerchantContext::get()])));
        }
    };
    $response = (new \Mtrip\Shared\Middleware\MerchantAuthMiddleware($config))->process((new \Hyperf\HttpMessage\Server\Request($method, $path))->withHeader('Authorization', 'Bearer ' . $token), $handler);
    return ['context' => json_decode((string) $response->getBody(), true)['data'], 'cache' => $response->getHeaderLine('Cache-Control')];
}
try {
    foreach ([1, 1, 0] as $isSuper) $operators[] = (int) Db::connection('system')->table('sys_admin')->insertGetId(['username' => 's4-op-' . bin2hex(random_bytes(5)), 'password' => password_hash('S4-local-only123', PASSWORD_BCRYPT), 'is_super' => $isSuper, 'status' => 1]);
    s4Actor();
    $merchant = $merchants[] = merchantFixture();
    $foreign = $merchants[] = merchantFixture(992);
    $one = s4Account($merchant); $two = s4Account($merchant); $other = s4Account($foreign, 992);
    $pending = s4Login($one);
    check(!isset($pending['token']) && $pending['requiresEnrollment'], 'S4 password alone returns enrollment challenge only');
    check(s4Claims($pending['challengeToken'])['aud'] === 'merchant_2fa', 'S4 separate challenge audience');
    rejects(40101, fn () => s4Request($pending['challengeToken']), 'S4 challenge cannot call merchant APIs');
    $setup = $security->setup($pending['challengeToken']);
    check($setup === $security->setup($pending['challengeToken']), 'S4 enrollment retry uses same pending secret');
    check(str_starts_with($setup['otpauthUri'], 'otpauth://totp/mTrip%3A') && strlen($setup['manualKey']) === 32, 'S4 local Google Authenticator URI and key');
    check(Db::table('merchant_admin')->where('id', $one)->value('two_fa_status') === 0, 'S4 setup without OTP does not activate');
    $second = s4Login($two); $setupTwo = $security->setup($second['challengeToken']);
    check($setup['manualKey'] !== $setupTwo['manualKey'], 'S4 accounts have independent secrets');
    $session = $security->verify($pending['challengeToken'], s4Code($setup['manualKey']), '127.0.0.1');
    check(s4Claims($session['token'])['amr'] === 'totp' && $session['admin']['id'] === $one, 'S4 OTP completion issues business JWT for actual account');
    check(Db::table('merchant_admin')->where('id', $one)->value('two_fa_secret_enc') !== $setup['manualKey'], 'S4 secret is encrypted at rest');
    check(s4Request($session['token'])['context']['admin_id'] === $one, 'S4 verified session can call merchant API');
    rejects(40101, fn () => $security->verify($pending['challengeToken'], s4Code($setup['manualKey']), ''), 'S4 consumed challenge rejected');
    rejects(40101, fn () => $security->setup($session['token']), 'S4 business JWT cannot fetch enrollment key');
    $again = s4Login($one);
    check(!$again['requiresEnrollment'], 'S4 returning account requires OTP not enrollment');
    rejects(40901, fn () => $security->setup($again['challengeToken']), 'S4 bound secret cannot be shown again');
    rejects(40001, fn () => $security->verify($again['challengeToken'], s4Code($setup['manualKey']), ''), 'S4 previously accepted time step cannot replay');
    $old = $again; $again = s4Login($one);
    rejects(40101, fn () => $security->verify($old['challengeToken'], '123456', ''), 'S4 new password login invalidates prior challenge');
    Db::table('merchant_admin')->where('id', $one)->update(['challenge_expires_at' => gmdate('Y-m-d H:i:s', time() - 1)]);
    rejects(40101, fn () => $security->verify($again['challengeToken'], '123456', ''), 'S4 expired challenge rejected');
    $again = s4Login($one);
    for ($i = 0; $i < 4; $i++) rejects(40001, fn () => $security->verify($again['challengeToken'], 'invalid', ''), 'S4 OTP failure persists');
    rejects(42901, fn () => s4Login($one), 'S4 lockout survives new password login');
    check(Db::table('merchant_activity_log')->where('target_account_id', $one)->where('description', 'like', '%authentication_locked%')->count() === 1, 'S4 lockout audited once');
    $secondSession = $security->verify($second['challengeToken'], s4Code($setupTwo['manualKey']), '');
    check($secondSession['admin']['id'] === $two, 'S4 another account unaffected by lockout');
    s4Actor(false);
    rejects(40301, fn () => $security->reset($merchant, $one, 1, 'Security reset'), 'S4 ordinary role with permission cannot reset');
    s4Actor(true, 991, $operators[2]);
    rejects(40301, fn () => $security->reset($merchant, $one, 1, 'Security reset'), 'S4 stale super claim checked against current administrator');
    s4Actor(true, 992);
    rejects(40302, fn () => $security->reset($merchant, $one, 1, 'Security reset'), 'S4 reset site isolation');
    s4Actor();
    rejects(40302, fn () => $security->reset($merchant, $other, 1, 'Security reset'), 'S4 reset account ownership');
    rejects(40001, fn () => $security->reset($merchant, $one, 1, ' '), 'S4 reset reason required');
    rejects(40901, fn () => $security->reset($merchant, $one, 99, 'Security reset'), 'S4 stale reset version rejected');
    $security->reset($merchant, $one, 1, 'Lost authenticator');
    $reset = (array) Db::table('merchant_admin')->where('id', $one)->first();
    check($reset['two_fa_status'] === 2 && $reset['two_fa_secret_enc'] === '' && $reset['pending_secret_enc'] === '' && $reset['auth_version'] === 2, 'S4 reset clears old and pending secrets and increments account version');
    rejects(40101, fn () => s4Request($session['token']), 'S4 reset invalidates target account old JWT');
    check(s4Request($secondSession['token'])['context']['admin_id'] === $two, 'S4 reset preserves other account JWT');
    s4Actor();
    $listing = $security->accounts($merchant);
    check(!str_contains(json_encode($listing), 'secret') && !str_contains(json_encode($listing), 'password'), 'S4 admin account list excludes secret and password');
    $resetLogin = s4Login($one); $resetSetup = $security->setup($resetLogin['challengeToken']);
    check($resetLogin['requiresEnrollment'] && $resetSetup['manualKey'] !== $setup['manualKey'], 'S4 reset forces fresh independent enrollment');
    Db::table('merchant_admin')->where('id', $one)->update(['last_accepted_totp_step' => -1]);
    check(s4Parallel(['--verify', $resetLogin['challengeToken'], s4Code($resetSetup['manualKey'])]) === ['denied', 'ok'], 'S4 concurrent OTP completion has one winner');
    $fault = 's4_audit_' . bin2hex(random_bytes(4));
    Db::unprepared("ALTER TABLE merchant_activity_log ADD CONSTRAINT {$fault} CHECK (description <> '2FA reset: fault-injection')");
    try { $security->reset($merchant, $one, 2, 'fault-injection'); throw new RuntimeException('Expected audit failure'); }
    catch (\Hyperf\Database\Exception\QueryException $e) {}
    check(Db::table('merchant_admin')->where('id', $one)->value('auth_version') === 2, 'S4 audit failure rolls back reset');
    Db::unprepared("ALTER TABLE merchant_activity_log DROP CHECK {$fault}"); $fault = null;
    $group = $groups[] = (int) Db::table('merchant_group')->insertGetId(['site_id' => 991, 'group_name' => 'S4 test group', 'contact_name' => 'Fixture', 'contact_phone' => '', 'status' => 1]);
    Db::table('merchant_info')->where('id', $merchant)->update(['group_id' => $group]);
    $groupAccount = s4Account(0, 991, 1, $group);
    $groupPending = s4Login($groupAccount);
    check($groupPending['requiresEnrollment'], 'S4 group account also forced to enroll');
    $groupSetup = $security->setup($groupPending['challengeToken']);
    $groupSession = $security->verify($groupPending['challengeToken'], s4Code($groupSetup['manualKey']), '');
    check($groupSession['admin']['accountType'] === 1, 'S4 group account can independently authenticate');
    $store = $stores[] = (int) Db::table('merchant_store')->insertGetId(['site_id' => 991, 'merchant_id' => $merchant, 'store_name' => 'S4 property', 'status' => 1]);
    $storeAccount = s4Account($merchant, 991, 3, 0, $store);
    check(s4Login($storeAccount)['requiresEnrollment'], 'S4 store account independently requires enrollment');
    Db::table('merchant_info')->where('id', $merchant)->update(['status' => 4, 'access_code' => 'S4-ACCESS-ALIAS']);
    check($auth->login('S4-ACCESS-ALIAS', 'S4-fixture-password123', '')['challengeToken'] !== '', 'S4 suspended access-code login still requires 2FA');
    s4Actor(false);
    rejects(40301, fn () => $support->start($merchant, $one, 'Support investigation'), 'S4 only super can impersonate');
    s4Actor();
    rejects(40001, fn () => $support->start($merchant, $one, ' '), 'S4 support reason required');
    rejects(40302, fn () => $support->start($merchant, $other, 'Support investigation'), 'S4 support target ownership');
    rejects(40302, fn () => $support->start($merchant, $groupAccount, 'Support investigation'), 'S4 no group-wide impersonation');
    $start = $support->start($merchant, $one, 'Support investigation');
    check(strlen($start['exchangeCode']) === 64 && !isset($start['token']), 'S4 admin gets one-time exchange not merchant credential');
    rejects(40901, fn () => $support->start($merchant, $one, 'Duplicate support'), 'S4 duplicate active support session rejected');
    $supportSession = $support->exchange($start['exchangeCode']);
    rejects(40101, fn () => $support->exchange($start['exchangeCode']), 'S4 support exchange is one-time');
    $context = s4Request($supportSession['token']);
    check($context['context']['admin_id'] === $one && $context['context']['actor_admin_id'] === $operators[0] && $context['cache'] === 'no-store', 'S4 support preserves actor and target and disables caching');
    check(isset($supportSession['admin']['impersonation']) && !$supportSession['admin']['isOwner'], 'S4 merchant profile includes support banner identity');
    foreach (['auth/password', 'auth/2fa/setup', 'account/create', 'role/create', 'rooms/save', 'order/verify', 'notifications/read', 'store/update'] as $route) {
        rejects(40301, fn () => s4Request($supportSession['token'], 'POST', '/api/v1/merchant/' . $route), 'S4 restricted support route ' . $route);
    }
    rejects(40301, fn () => s4Request($supportSession['token'], 'GET', '/api/v1/merchant/earnings/summary'), 'S4 support cannot access settlement');
    $events = Db::table('merchant_activity_log')->where('impersonation_session_id', $start['session_id'])->get()->all();
    check(count($events) >= 12 && !str_contains(json_encode($events), $start['exchangeCode']), 'S4 support request and denial audit excludes exchange secret');
    s4Actor(true, 991, $operators[1]);
    rejects(40302, fn () => $support->end($start['session_id']), 'S4 one administrator cannot end another session');
    $separate = $support->start($merchant, $two, 'Separate administrator');
    s4Actor();
    $support->end($start['session_id']);
    rejects(40101, fn () => s4Request($supportSession['token']), 'S4 explicit end revokes JWT immediately');
    check(Db::table('merchant_impersonation_session')->where('id', $separate['session_id'])->value('status') === 1, 'S4 end does not terminate merchant other sessions');
    $concurrent = $support->start($merchant, $one, 'Concurrent exchange');
    check(s4Parallel(['--exchange', $concurrent['exchangeCode']]) === ['denied', 'ok'], 'S4 concurrent exchange has one winner');
    $support->end($concurrent['session_id']);
    $expiry = $support->start($merchant, $one, 'Expired exchange');
    Db::table('merchant_impersonation_session')->where('id', $expiry['session_id'])->update(['exchange_expires_at' => gmdate('Y-m-d H:i:s', time() - 1)]);
    rejects(40101, fn () => $support->exchange($expiry['exchangeCode']), 'S4 expired one-time exchange denied');
    $support->end($expiry['session_id']);
    $live = $support->start($merchant, $one, 'Live authority'); $liveSession = $support->exchange($live['exchangeCode']);
    Db::connection('system')->table('sys_admin')->where('id', $operators[0])->update(['is_super' => 0]);
    rejects(40301, fn () => s4Request($liveSession['token']), 'S4 support rechecks live administrator authority');
    Db::connection('system')->table('sys_admin')->where('id', $operators[0])->update(['is_super' => 1]);
    s4Actor();
    $security->reset($merchant, $one, 2, 'Invalidate support too');
    rejects(40101, fn () => s4Request($liveSession['token']), 'S4 account reset also invalidates impersonation');
    $support->end($live['session_id']);
    $timed = $support->start($merchant, $one, 'Timed support'); $timedSession = $support->exchange($timed['exchangeCode']);
    Db::table('merchant_impersonation_session')->where('id', $timed['session_id'])->update(['expires_at' => gmdate('Y-m-d H:i:s', time() - 1)]);
    rejects(40101, fn () => s4Request($timedSession['token']), 'S4 session expiry enforced independently of cron');
    check($support->expire() === 1 && $support->expire() === 0, 'S4 expiry audit and close are idempotent');
    s4Actor();
    Db::table('merchant_blacklist')->insert(['site_id' => 991, 'merchant_id' => $merchant, 'reason' => 'S4 fixture', 'status' => 1]);
    rejects(40301, fn () => $support->start($merchant, $one, 'Blacklisted support'), 'S4 blacklisted merchant cannot be impersonated');
    rejects(40301, fn () => s4Login($one), 'S4 blacklisted merchant cannot start challenge');
    $platformHandler = new class implements \Psr\Http\Server\RequestHandlerInterface {
        public function handle(\Psr\Http\Message\ServerRequestInterface $request): \Psr\Http\Message\ResponseInterface { return new \Hyperf\HttpMessage\Server\Response(); }
    };
    foreach ([$pending['challengeToken'], $secondSession['token']] as $wrongAudience) {
        rejects(40101, fn () => (new \Mtrip\Shared\Middleware\AdminAuthMiddleware($config))->process((new \Hyperf\HttpMessage\Server\Request('GET', '/api/v1/admin/merchant/list'))->withHeader('Authorization', 'Bearer ' . $wrongAudience), $platformHandler), 'S4 merchant/challenge JWT cannot enter platform APIs');
    }
    // Independent fixtures for controller wiring, revocation, and historical credential redaction.
    $extraMerchant = $merchants[] = merchantFixture();
    $extra = s4Account($extraMerchant);
    $loginController = $container->get(\App\Controller\Merchant\AuthController::class);
    $securityController = $container->get(\App\Controller\MerchantSecurityController::class);
    setRequest(['username' => Db::table('merchant_admin')->where('id', $extra)->value('username'), 'password' => 'S4-fixture-password123']);
    \Hyperf\Context\ResponseContext::set(new \Hyperf\HttpMessage\Server\Response());
    $response = $loginController->login();
    $challenge = json_decode((string) $response->getBody(), true)['data'];
    check($response->getHeaderLine('Cache-Control') === 'no-store' && !isset($challenge['token']), 'S4 login controller returns non-cacheable restricted challenge');
    setRequest(['challengeToken' => $challenge['challengeToken']]);
    $response = $securityController->setup();
    $extraSetup = json_decode((string) $response->getBody(), true)['data'];
    check($response->getHeaderLine('Cache-Control') === 'no-store', 'S4 enrollment controller disables secret caching');
    Db::table('merchant_admin')->where('id', $extra)->update(['status' => 2]);
    rejects(40101, fn () => $security->verify($challenge['challengeToken'], s4Code($extraSetup['manualKey']), ''), 'S4 disabled account cannot complete pending challenge');
    Db::table('merchant_admin')->where('id', $extra)->update(['status' => 1]);
    setRequest(['challengeToken' => $challenge['challengeToken'], 'twoFaCode' => s4Code($extraSetup['manualKey'])]);
    $response = $securityController->verify();
    $extraSession = json_decode((string) $response->getBody(), true)['data'];
    check($response->getHeaderLine('Cache-Control') === 'no-store' && isset($extraSession['token']), 'S4 OTP controller issues non-cacheable session');
    $legacy = s4Claims($extraSession['token']); unset($legacy['auth_version']);
    rejects(40101, fn () => s4Request(JwtHelper::issue($legacy, (string) $config->get('mtrip.jwt_secret'), 300)), 'S4 legacy JWT without account version rejected');
    $outstanding = s4Login($extra);
    MerchantContext::set(['admin_id' => $extra, 'admin_name' => 'S4 Account', 'site_id' => 991, 'merchant_id' => $extraMerchant, 'account_type' => 2]);
    $auth->updatePassword($extra, 'S4-fixture-password123', 'New-S4-password456');
    rejects(40101, fn () => s4Request($extraSession['token']), 'S4 password change revokes existing business JWT');
    rejects(40101, fn () => $security->verify($outstanding['challengeToken'], '123456', ''), 'S4 password change revokes outstanding challenge');
    check(s4Request($groupSession['token'])['context']['admin_id'] === $groupAccount, 'S4 password change leaves other account session intact');
    s4Actor();
    foreach (['access_code_generated', 'code_regenerated'] as $action) Db::table('merchant_verify_timeline')->insert(['site_id' => 991, 'merchant_id' => $extraMerchant, 'action' => $action, 'note' => 'S4-HISTORICAL-SECRET', 'operator_name' => 'Fixture']);
    Db::table('merchant_info')->where('id', $extraMerchant)->update(['access_code' => 'S4-HISTORICAL-SECRET']);
    setRequest(['id' => $extraMerchant]);
    $detail = $container->get(\App\Controller\VerifyController::class)->detail()['data'];
    check(!str_contains(json_encode($detail), 'S4-HISTORICAL-SECRET') && $detail['access_grant']['access_code_configured'], 'S4 normal verification detail masks current and historical access codes');
    setRequest(['source' => 'verification', 'merchantId' => $extraMerchant, 'export' => 1]);
    $history = $container->get(\App\Controller\MerchantActivityController::class)->history()['data'];
    check(!str_contains(json_encode($history), 'S4-HISTORICAL-SECRET') && count($history['list']) === 2, 'S4 verification history export masks legacy access codes');
    setRequest(['id' => $extraMerchant, 'reason' => 'No account selected']);
    rejects(40001, fn () => $container->get(\App\Controller\MerchantController::class)->resetTwoFa(), 'S4 reset controller requires explicit target account');
    $revoked = $support->start($extraMerchant, $extra, 'Authority revoked before exchange');
    Db::connection('system')->table('sys_admin')->where('id', $operators[0])->update(['is_super' => 0]);
    rejects(40301, fn () => $support->exchange($revoked['exchangeCode']), 'S4 exchange rechecks current super authority');
    Db::connection('system')->table('sys_admin')->where('id', $operators[0])->update(['is_super' => 1]);
    $support->end($revoked['session_id']);
    $fault = 's4_audit_' . bin2hex(random_bytes(4));
    Db::unprepared("ALTER TABLE merchant_activity_log ADD CONSTRAINT {$fault} CHECK (description <> 'started: audit-start-failure')");
    $before = Db::table('merchant_impersonation_session')->where('target_account_id', $extra)->count();
    try { $support->start($extraMerchant, $extra, 'audit-start-failure'); throw new RuntimeException('Expected audit failure'); }
    catch (\Hyperf\Database\Exception\QueryException $e) {}
    check(Db::table('merchant_impersonation_session')->where('target_account_id', $extra)->count() === $before, 'S4 start audit failure rolls back session creation');
    Db::unprepared("ALTER TABLE merchant_activity_log DROP CHECK {$fault}"); $fault = null;
    Db::table('merchant_admin')->where('id', $extra)->update(['is_owner' => 0]);
    $role = (int) Db::table('merchant_role')->insertGetId(['site_id' => 991, 'merchant_id' => $extraMerchant, 'role_name' => 'S4 fixture role', 'status' => 1]);
    $fixtureMenu = random_int(900000000, 999999999);
    Db::table('merchant_menu')->insert(['id' => $fixtureMenu, 'menu_name' => 'S4 fixture', 'perm_key' => 'mch:s4:fixture', 'status' => 1, 'account_scope' => '2']);
    $menu = Db::table('merchant_menu')->where('id', $fixtureMenu)->first();
    Db::table('merchant_admin_role')->insert(['admin_id' => $extra, 'role_id' => $role]);
    Db::table('merchant_role_menu')->insert(['role_id' => $role, 'menu_id' => $menu->id]);
    $limited = $support->start($extraMerchant, $extra, 'Current target permissions');
    setRequest(['exchangeCode' => $limited['exchangeCode']]);
    $response = $securityController->exchange();
    $limitedSession = json_decode((string) $response->getBody(), true)['data'];
    check($response->getHeaderLine('Cache-Control') === 'no-store', 'S4 exchange controller disables caching');
    check(in_array($menu->perm_key, s4Request($limitedSession['token'])['context']['permissions'], true), 'S4 target current role grants retained');
    Db::table('merchant_role')->where('id', $role)->update(['status' => 2]);
    check(s4Request($limitedSession['token'])['context']['permissions'] === [], 'S4 role revocation removes support permissions on next request');
    $profile = $loginController->me()['data'];
    check(!$profile['isOwner'] && $profile['permissions'] === [] && isset($profile['impersonation']), 'S4 profile reload keeps read-only support identity');
    check($loginController->menus()['data']['perms'] === [], 'S4 support menus never expose write buttons');
    $loginController->logout();
    rejects(40101, fn () => s4Request($limitedSession['token']), 'S4 merchant logout ends only current support session');
    echo "S4 authentication and impersonation suite complete\n";
} finally {
    if ($fault) Db::unprepared("ALTER TABLE merchant_activity_log DROP CHECK {$fault}");
    if ($accounts) Db::table('merchant_activity_log')->whereIn('target_account_id', $accounts)->delete();
    if ($merchants) {
        foreach (['merchant_impersonation_session', 'merchant_blacklist', 'merchant_activity_log', 'merchant_verify_timeline'] as $table) Db::table($table)->whereIn('merchant_id', $merchants)->delete();
        $roles = Db::table('merchant_role')->whereIn('merchant_id', $merchants)->pluck('id')->all();
        if ($roles) {
            Db::table('merchant_admin_role')->whereIn('role_id', $roles)->delete();
            Db::table('merchant_role_menu')->whereIn('role_id', $roles)->delete();
            Db::table('merchant_role')->whereIn('id', $roles)->delete();
        }
        Db::table('merchant_info')->whereIn('id', $merchants)->delete();
    }
    if ($accounts) Db::table('merchant_admin')->whereIn('id', $accounts)->delete();
    if ($operators) Db::connection('system')->table('sys_admin')->whereIn('id', $operators)->delete();
    if ($stores) Db::table('merchant_store')->whereIn('id', $stores)->delete();
    if ($groups) Db::table('merchant_group')->whereIn('id', $groups)->delete();
    if ($fixtureMenu) Db::table('merchant_menu')->where('id', $fixtureMenu)->delete();
}
