<?php
declare(strict_types=1);

// Run ONLY inside the dedicated mtrip-s7 container. No developer/production database fixtures.
if (getenv('MTRIP_S7_ISOLATED') !== '1' || getenv('APP_ENV') !== 'testing'
    || getenv('MYSQL_PASSWORD') !== false
    || getenv('DB_PASSWORD') !== 'mtrip-s7-database-only') {
    throw new RuntimeException('S7 isolated environment required');
}
define('BASE_PATH', '/opt/www');
require BASE_PATH . '/vendor/autoload.php';
putenv('SCAN_CACHEABLE=true');
Hyperf\Di\ClassLoader::init();
$container = require BASE_PATH . '/config/container.php';
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\TransportCipher;
use Mtrip\Shared\Merchant\Totp;

const PASSWORD = 'S7-only-test123!';
const CLIENT_SECRET = 's7-client-only-not-production';
$count = 0;
function check(bool $ok, string $name): void {
    global $count;
    if (!$ok) throw new RuntimeException('FAIL: ' . $name);
    ++$count;
    echo "PASS: $name\n";
}
function request(string $path, ?array $data = null, string $token = '', bool $encrypt = false, bool $client = false): array {
    global $fixture;
    $method = $data === null ? 'GET' : 'POST';
    $headers = ['Accept: application/json'];
    if ($token !== '') $headers[] = 'Authorization: Bearer ' . $token;
    if ($client) {
        $timestamp = (string) time(); $nonce = bin2hex(random_bytes(12));
        $headers = array_merge($headers, ['X-Site-Id: 991', 'X-Client-Id: ' . $fixture['client'],
            'X-Timestamp: ' . $timestamp, 'X-Nonce: ' . $nonce,
            'X-Sign: ' . hash_hmac('sha256', $fixture['client'] . $method . explode('?', $path)[0] . $timestamp . $nonce, CLIENT_SECRET)]);
    }
    $curl = curl_init('http://gateway' . $path);
    if ($data !== null) {
        if ($encrypt) {
            $data = ['payload' => TransportCipher::encrypt(json_encode($data), (string) getenv('MTRIP_ADMIN_AES_KEY'))];
            $headers[] = 'X-Encrypted: 1';
        }
        if (isset($data['file'])) curl_setopt($curl, CURLOPT_POSTFIELDS, $data);
        else {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($data));
        }
    }
    curl_setopt_array($curl, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_TIMEOUT => 15]);
    $raw = curl_exec($curl);
    if ($raw === false) throw new RuntimeException('Gateway transport failed: ' . curl_error($curl));
    $headerSize = curl_getinfo($curl, CURLINFO_HEADER_SIZE);
    $result = ['status' => curl_getinfo($curl, CURLINFO_HTTP_CODE), 'headers' => substr($raw, 0, $headerSize),
        'body' => substr($raw, $headerSize)];
    $result['json'] = json_decode($result['body'], true);
    return $result;
}
function api(string $path, ?array $data = null, string $token = '', int $expected = 0, bool $encrypt = false, bool $client = false): mixed {
    $r = request($path, $data, $token, $encrypt, $client);
    check(($r['json']['code'] ?? null) === $expected, "$path expected=$expected actual=" . ($r['json']['code'] ?? $r['status']));
    return $r['json']['data'] ?? null;
}
function rid(): string { return 's7-' . bin2hex(random_bytes(12)); }
/** $password 为 null 时用夹具默认密码;重置 2FA 会换密码,之后须传返回的新明文 */
function login(string $name, bool $admin = false, ?string $password = null): array {
    return api('/api/v1/' . ($admin ? 'admin' : 'merchant') . '/auth/login', ['username' => $name, 'password' => $password ?? PASSWORD], '', 0, true);
}
function enroll(string $name, ?string $password = null): array {
    $challenge = login($name, false, $password);
    check($challenge['requiresEnrollment'] && !isset($challenge['token']), 'password alone cannot issue business session');
    $setup = api('/api/v1/merchant/auth/2fa/setup', ['challengeToken' => $challenge['challengeToken']]);
    check(strlen($setup['manualKey']) === 32 && str_starts_with($setup['otpauthUri'], 'otpauth://totp/'), 'authenticator-compatible enrollment');
    $usedCode = Totp::code($setup['manualKey'], intdiv(time(), 30));
    $session = api('/api/v1/merchant/auth/2fa/verify', ['challengeToken' => $challenge['challengeToken'], 'twoFaCode' => $usedCode]);
    return [$session['token'], $setup['manualKey'], $challenge['challengeToken'], $usedCode];
}

$key = 's7-' . bin2hex(random_bytes(5));
$fixture = ['key' => $key, 'client' => $key . '-web', 'admins' => [], 'accounts' => [], 'goods' => [], 'properties' => []];
Db::connection('system')->transaction(function () use (&$fixture, $key) {
    foreach (['super' => [1, 0], 'ops' => [0, 991], 'reader' => [0, 991], 'foreign' => [0, 992], 'zero' => [0, 0]] as $name => [$super, $site]) {
        $username = $key . '-' . $name;
        $id = Db::connection('system')->table('sys_admin')->insertGetId(['username' => $username, 'password' => password_hash(PASSWORD, PASSWORD_BCRYPT), 'real_name' => 'S7 ' . $name, 'site_id' => $site, 'is_super' => $super]);
        $fixture['admins'][$name] = $username;
        if ($super) continue;
        $role = Db::connection('system')->table('sys_role')->insertGetId(['role_name' => $username, 'site_id' => $site]);
        Db::connection('system')->table('sys_admin_role')->insert(['admin_id' => $id, 'role_id' => $role]);
        $menus = Db::connection('system')->table('sys_menu')->whereNull('deleted_at')->get();
        foreach ($menus as $menu) {
            $allowed = $name !== 'reader' || in_array($menu->perm_key, ['merchant:list:list', 'merchant:list:detail', 'merchant:doc:list']);
            if ($menu->menu_type !== 3 || ($allowed && (str_starts_with($menu->perm_key, 'merchant:') || str_starts_with($menu->perm_key, 'platform:')))) {
                Db::connection('system')->table('sys_role_menu')->insert(['role_id' => $role, 'menu_id' => $menu->id]);
            }
        }
    }
    Db::connection('system')->table('sys_client')->insert(['site_id' => 991, 'client_id' => $fixture['client'], 'client_name' => 'S7 local web',
        'client_secret' => CryptoHelper::encrypt(CLIENT_SECRET, (string) getenv('MTRIP_AES_KEY')), 'client_type' => 3, 'qps_limit' => 0]);
});
Db::transaction(function () use (&$fixture, $key) {
    $m = $fixture['merchant'] = (int) Db::table('merchant_info')->insertGetId(['site_id' => 991, 'merchant_name' => 'S7 Acceptance Hotel ' . $key, 'credit_code' => strtoupper($key), 'legal_person' => 'Synthetic', 'contact_name' => 'Synthetic', 'contact_phone' => '', 'status' => 3]);
    foreach (['one', 'two', 'browser'] as $name) {
        $fixture['accounts'][$name] = ['name' => $key . '-' . $name, 'id' => (int) Db::table('merchant_admin')->insertGetId([
            'site_id' => 991, 'merchant_id' => $m, 'account_type' => 2, 'username' => $key . '-' . $name, 'password' => password_hash(PASSWORD, PASSWORD_BCRYPT), 'real_name' => 'S7 ' . $name, 'is_owner' => 1, 'status' => 1])];
    }
    $app = Db::table('merchant_application')->insertGetId(['site_id' => 991, 'merchant_id' => $m, 'app_no' => $key, 'company_name' => 'S7 Synthetic Hotel', 'country' => 'Myanmar']);
    for ($i = 0; $i < 3; ++$i) {
        $b = Db::table('merchant_application_business')->insertGetId(['site_id' => 991, 'application_id' => $app, 'business_name' => 'S7 Hotel ' . $i, 'business_type' => 'hotel', 'kyc_status' => 1]);
        $fixture['properties'][] = (int) Db::table('merchant_store')->insertGetId(['site_id' => 991, 'merchant_id' => $m, 'source_business_id' => $b, 'store_name' => 'S7 Property ' . $i, 'business_type' => 'hotel', 'country_code' => 'MM', 'city_key' => $key, 'status' => 1]);
        $g = $fixture['goods'][] = (int) Db::table('goods_info')->insertGetId(['site_id' => 991, 'merchant_id' => $m, 'goods_name' => 'S7 Hotel ' . $i . ' ' . $key, 'goods_type' => 1, 'status' => 3]);
        Db::table('hotel_room_type')->insert(['site_id' => 991, 'goods_id' => $g, 'room_name' => 'S7 Room', 'base_price' => 100 + $i, 'status' => 1]);
    }
    $fixture['document'] = (int) Db::table('merchant_verify_document')->insertGetId(['site_id' => 991, 'merchant_id' => $m, 'doc_type' => 'hotel_license', 'name' => 'S7 hotel license', 'status' => 2]);
});
// Dedicated container-local evidence; no real credentials or session tokens are persisted.
file_put_contents('/tmp/m12-s7-fixture.json', json_encode($fixture, JSON_PRETTY_PRINT));
echo 'FIXTURE ' . json_encode($fixture) . "\n";
if (($argv[1] ?? '') === '--seed') exit;

$super = login($fixture['admins']['super'], true)['token'];
$ops = login($fixture['admins']['ops'], true)['token'];
$reader = login($fixture['admins']['reader'], true)['token'];
$foreign = login($fixture['admins']['foreign'], true)['token'];
$zero = login($fixture['admins']['zero'], true)['token'];
$m = $fixture['merchant'];
api('/api/v1/admin/merchant/list', null, '', 40101);
api('/api/v1/admin/merchant/detail?id=' . $m, null, $ops);
api('/api/v1/admin/merchant/detail?id=' . $m, null, $foreign, 40302);
api('/api/v1/admin/merchant/detail?id=' . $m, null, $zero, 40302);
api('/api/v1/admin/merchant/suspend', ['id' => $m], $reader, 40301);

[$one, $secret, $consumed, $usedCode] = enroll($fixture['accounts']['one']['name']);
[$two, $secretTwo] = enroll($fixture['accounts']['two']['name']);
check($secret !== $secretTwo, 'independent account authenticator secrets');
api('/api/v1/merchant/auth/me', null, $one);
api('/api/v1/merchant/stats/dashboard', null, $one);
api('/api/v1/merchant/auth/me', null, $consumed, 40101);
api('/api/v1/merchant/auth/2fa/verify', ['challengeToken' => $consumed, 'twoFaCode' => Totp::code($secret, intdiv(time(), 30))], '', 40101);
$returning = login($fixture['accounts']['one']['name']);
check(!$returning['requiresEnrollment'], 'returning login requires existing authenticator');
api('/api/v1/merchant/auth/2fa/setup', ['challengeToken' => $returning['challengeToken']], '', 40901);
api('/api/v1/merchant/auth/2fa/verify', ['challengeToken' => $returning['challengeToken'], 'twoFaCode' => $usedCode], '', 40001);
$reset = ['merchantId' => $m, 'accountId' => $fixture['accounts']['one']['id'], 'expectedVersion' => 1, 'reason' => 'S7 lost authenticator'];
api('/api/v1/admin/merchant/reset-2fa', $reset, $ops, 40301);
$resetCredentials = api('/api/v1/admin/merchant/reset-2fa', $reset, $super);
check(($resetCredentials['username'] ?? '') === $fixture['accounts']['one']['name'] && strlen($resetCredentials['password'] ?? '') >= 12, 'reset returns one-time credentials for the target account');
api('/api/v1/merchant/auth/login', ['username' => $fixture['accounts']['one']['name'], 'password' => PASSWORD], '', 40101, true);
api('/api/v1/merchant/auth/me', null, $one, 40101);
api('/api/v1/merchant/auth/me', null, $two);
[$one, $newSecret] = enroll($fixture['accounts']['one']['name'], $resetCredentials['password']);
check($secret !== $newSecret, 'reset creates fresh secret');
$security = api('/api/v1/admin/merchant/security/accounts?merchantId=' . $m, null, $super);
check(!str_contains(json_encode($security), 'secret') && !str_contains(json_encode($security), 'password'), 'admin account list never exposes secrets');
$support = api('/api/v1/admin/merchant/impersonate/start', ['merchantId' => $m, 'accountId' => $fixture['accounts']['one']['id'], 'reason' => 'S7 support check'], $super);
$exchange = api('/api/v1/merchant/auth/impersonation/exchange', ['exchangeCode' => $support['exchangeCode']]);
api('/api/v1/merchant/auth/impersonation/exchange', ['exchangeCode' => $support['exchangeCode']], '', 40101);
api('/api/v1/merchant/stats/dashboard', null, $exchange['token']);
api('/api/v1/merchant/notifications/read', ['id' => 1], $exchange['token'], 40301);
api('/api/v1/merchant/account/list', null, $exchange['token'], 40301);
api('/api/v1/merchant/earnings/overview', null, $exchange['token'], 40301);
api('/api/v1/admin/merchant/impersonate/end', ['sessionId' => $support['session_id']], $super);
api('/api/v1/merchant/auth/me', null, $exchange['token'], 40101);

$notice = ['merchantId' => $m, 'requestId' => rid(), 'title' => 'S7 real in-app receipt', 'message' => 'Synthetic local acceptance', 'channels' => ['inapp'], 'deepLinkType' => 'page', 'deepLinkValue' => '/dashboard'];
$sent = api('/api/v1/admin/merchant/notification/send', $notice, $ops);
$again = api('/api/v1/admin/merchant/notification/send', $notice, $ops);
check($sent['id'] === $again['id'], 'notification idempotency across gateway');
$inbox = api('/api/v1/merchant/notifications/list', null, $one);
check(in_array($sent['id'], array_column($inbox['list'], 'id')), 'actual merchant inbox receives message');
api('/api/v1/merchant/notifications/read', ['id' => $sent['id']], $one);
$otherInbox = api('/api/v1/merchant/notifications/list', null, $two);
check(!array_column($otherInbox['list'], 'is_read', 'id')[$sent['id']], 'second account keeps independent unread state');
$destination = api('/api/v1/merchant/notifications/destination?id=' . $sent['id'], null, $one);
check($destination['path'] === '/dashboard', 'controlled deep link resolves');
api('/api/v1/admin/merchant/notification/send', array_replace($notice, ['requestId' => rid(), 'channels' => ['email']]), $ops, 40901);
$scheduled = api('/api/v1/admin/merchant/notification/send', array_replace($notice, ['requestId' => rid(), 'sendType' => 2, 'sendAt' => gmdate('Y-m-d\TH:i:s\Z', time() + 15)]), $super);
check(!in_array($scheduled['id'], array_column(api('/api/v1/merchant/notifications/list', null, $one)['list'], 'id')), 'scheduled notice not prematurely visible');

$pdf = "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n";
$file = tempnam('/tmp', 's7-pdf-');
file_put_contents($file, $pdf);
$doc = $fixture['document'];
api('/api/v1/admin/merchant/document/replace', ['docId' => $doc, 'expectedVersion' => 0, 'reason' => 'S7 gateway upload', 'file' => new CURLFile($file, 'application/pdf', 's7-license.pdf')], $super);
$download = api('/api/v1/admin/merchant/document/download?docId=' . $doc, null, $super);
check(hash('sha256', $pdf) === $download['sha256'] && base64_decode($download['content']) === $pdf, 'gateway download roundtrip and digest');
api('/api/v1/admin/merchant/document/download?docId=' . $doc, null, $foreign, 40302);
api('/api/v1/admin/merchant/document/download?docId=' . $doc, null, $reader, 40301);
$url = (string) Db::table('merchant_verify_document')->where('id', $doc)->value('file_url');
check(in_array(request($url)['status'], [403, 404], true), 'public KYC URL blocked by gateway');
api('/api/v1/admin/merchant/document/review', ['docId' => $doc, 'expectedVersion' => 1, 'action' => 'verify', 'reason' => 'S7 checked'], $super);
api('/api/v1/admin/merchant/document/replace', ['docId' => $doc, 'expectedVersion' => 1, 'reason' => 'S7 second version', 'file' => new CURLFile($file, 'application/pdf', 's7-license-v2.pdf')], $super);
api('/api/v1/admin/merchant/document/review', ['docId' => $doc, 'expectedVersion' => 1, 'action' => 'verify'], $super, 40901);
$oldRevision = (int) Db::table('merchant_verify_document_revision')->where('doc_id', $doc)->where('lifecycle_version', 1)->value('id');
check(api('/api/v1/admin/merchant/document/download?docId=' . $doc . '&revisionId=' . $oldRevision, null, $super)['sha256'] === hash('sha256', $pdf), 'old file revision remains downloadable');
unlink($file); // Only this run's tempnam-created synthetic file.

$market = ['siteId' => 991, 'businessType' => 'hotel', 'countryCode' => 'MM', 'cityKey' => $key];
$version = 0; $listingIds = [];
foreach ($fixture['properties'] as $i => $property) {
    api('/api/v1/admin/merchant/ranking/property-display', $market + ['propertyId' => $property, 'expectedPropertyVersion' => 0, 'displayEnabled' => 1, 'note' => 'S7 display'], $super);
    $listing = api('/api/v1/admin/merchant/ranking/listing/add', $market + ['propertyId' => $property, 'goodsId' => $fixture['goods'][$i], 'expectedVersion' => $version, 'note' => 'S7 mapping'], $super);
    $version = $listing['version']; $listingIds[] = $listing['id'];
}
$search = '/api/v1/app/goods/list?' . http_build_query(['goodsType' => 1, 'countryCode' => 'MM', 'cityKey' => $key]);
check(api($search, null, '', 0, false, true)['total'] === 0, 'ranking draft absent from signed consumer search');
$listing = api('/api/v1/admin/merchant/ranking/pin', $market + ['id' => $listingIds[2], 'pinned' => 1, 'expectedVersion' => $version, 'note' => 'S7 pin'], $super);
$version = $listing['version'];
api('/api/v1/admin/merchant/ranking/publish', $market + ['expectedVersion' => $version, 'note' => 'S7 publish'], $ops, 40301);
api('/api/v1/admin/merchant/ranking/publish', $market + ['expectedVersion' => $version, 'note' => 'S7 publish'], $super);
$live = api($search, null, '', 0, false, true);
check(array_column($live['list'], 'id') === [$fixture['goods'][2], $fixture['goods'][0], $fixture['goods'][1]], 'consumer default order follows published pinned ranking');
check(array_column(api($search . '&sortBy=price_asc', null, '', 0, false, true)['list'], 'id') === $fixture['goods'], 'consumer explicit price ordering preserved');
api('/api/v1/app/goods/detail?id=' . $fixture['goods'][0], null, '', 0, false, true);

$rule = api('/api/v1/admin/compliance/rule/save', ['title' => 'S7 hotel policy ' . $key, 'category' => 'Booking', 'severity' => 2, 'body' => 'Keep booking descriptions accurate', 'siteId' => 991, 'expectedVersion' => 0, 'note' => 'S7 draft'], $super);
$rule = api('/api/v1/admin/compliance/rule/publish', ['id' => $rule['id'], 'expectedVersion' => 1, 'action' => 'publish', 'note' => 'S7 publish'], $super);
$case = api('/api/v1/admin/compliance/violation/record', ['merchantId' => $m, 'ruleId' => $rule['id'], 'ruleRevisionId' => $rule['revision_id'], 'details' => 'S7 synthetic mismatch', 'expectedVersion' => 0, 'requestId' => rid(), 'note' => 'S7 record'], $ops);
$warning = api('/api/v1/admin/compliance/warning/issue', ['id' => $case['id'], 'expectedVersion' => 1, 'requestId' => rid(), 'note' => 'S7 warn', 'reason' => 'Correct synthetic description', 'level' => 1], $ops);
api('/api/v1/admin/compliance/violation/handle', ['id' => $case['id'], 'action' => 'suspend', 'expectedVersion' => 2, 'expectedMerchantVersion' => 0, 'requestId' => rid(), 'note' => 'S7 suspend', 'confirmed' => true], $ops);
check(api($search, null, '', 0, false, true)['total'] === 0, 'suspension immediately removes consumer hotels');
api('/api/v1/merchant/auth/me', null, $one);
api('/api/v1/admin/compliance/violation/handle', ['id' => $case['id'], 'action' => 'restore', 'expectedVersion' => 3, 'expectedMerchantVersion' => 1, 'requestId' => rid(), 'note' => 'S7 restore', 'confirmed' => true], $ops);
check(api($search, null, '', 0, false, true)['total'] === 3, 'reviewed restoration restores live eligibility');
api('/api/v1/admin/compliance/warning/revoke', ['id' => $warning['warning_id'], 'expectedVersion' => 4, 'requestId' => rid(), 'note' => 'S7 corrected'], $ops);
check((int) Db::table('merchant_warning')->where('id', $warning['warning_id'])->value('status') === 1, 'warning original not overwritten by revocation');
api('/api/v1/admin/compliance/violation/handle', ['id' => $case['id'], 'action' => 'resolve', 'expectedVersion' => 5, 'requestId' => rid(), 'note' => 'S7 resolved'], $ops);
api('/api/v1/admin/merchant/blacklist', ['id' => $m, 'expectedVersion' => 2, 'requestId' => rid(), 'note' => 'S7 blacklist'], $super);
api('/api/v1/merchant/auth/me', null, $one, 40301);
api('/api/v1/admin/merchant/unblacklist', ['id' => $m, 'expectedVersion' => 3, 'requestId' => rid(), 'note' => 'S7 unblacklist'], $super);
check(api($search, null, '', 0, false, true)['total'] === 0, 'unblacklisting alone does not restore business');
api('/api/v1/admin/merchant/reactivate', ['id' => $m, 'expectedVersion' => 4, 'requestId' => rid(), 'note' => 'S7 final reactivation'], $super);
check(api($search, null, '', 0, false, true)['total'] === 3, 'explicit privileged reactivation');
$dest = ['siteId' => 991, 'region' => $key, 'entityType' => 'destination'];
$destinationRow = api('/api/v1/admin/merchant/ranking/destination/add', $dest + ['name' => 'S7 destination ' . $key, 'destinationCountry' => 'MM', 'destinationCity' => $key, 'expectedVersion' => 0, 'note' => 'S7 destination'], $super);
check(!in_array($destinationRow['id'], array_column(api('/api/v1/app/goods/home', null, '', 0, false, true)['destinations'], 'id')), 'destination draft absent from homeconsumer');
api('/api/v1/admin/merchant/ranking/publish', $dest + ['expectedVersion' => 1, 'note' => 'S7 publish destination'], $super);
check(in_array($destinationRow['id'], array_column(api('/api/v1/app/goods/home', null, '', 0, false, true)['destinations'], 'id')), 'published destination reaches consumer home');

// More than one export page; the only seeded history is explicitly synthetic and local.
for ($i = 0; $i < 255; ++$i) Db::table('compliance_history')->insert(['site_id' => 991, 'merchant_id' => $m, 'event' => 'S7 export ' . $key . ' ' . $i, 'reviewer' => 'S7 scale fixture']);
$exportUrl = '/api/v1/admin/merchant/activities/history?' . http_build_query(['source' => 'compliance', 'merchantId' => $m, 'keyword' => 'S7 export ' . $key, 'export' => 1, 'pageSize' => 200]);
$first = api($exportUrl, null, $ops);
$last = api($exportUrl . '&snapshotId=' . $first['snapshotId'] . '&beforeId=' . $first['nextBeforeId'], null, $ops);
check(count($first['list']) === 200 && count($last['list']) === 55 && count(array_unique(array_merge(array_column($first['list'], 'id'), array_column($last['list'], 'id')))) === 255, 'export all 255 rows exactly once with fixed snapshot');
check(api($exportUrl, null, $foreign)['total'] === 0, 'export denies foreign site data');
api($exportUrl, null, $reader, 40301);
$timings = [];
for ($i = 0; $i < 10; ++$i) {
    $started = microtime(true);
    $response = request('/api/v1/admin/merchant/list?pageSize=20', null, $ops);
    if (($response['json']['code'] ?? -1) !== 0) throw new RuntimeException('Directory scale probe failed');
    $timings[] = round((microtime(true) - $started) * 1000, 2);
}
sort($timings);
echo 'BASELINE directory rows=' . Db::table('merchant_info')->count() . ' runs=10 median_ms=' . $timings[4] . ' max_ms=' . end($timings) . "\n";

$future = api('/api/v1/admin/compliance/rule/save', ['title' => 'S7 future ' . $key, 'category' => 'Booking', 'severity' => 2, 'body' => 'Scheduled synthetic policy', 'siteId' => 991, 'expectedVersion' => 0, 'note' => 'S7 future draft'], $super);
api('/api/v1/admin/compliance/rule/publish', ['id' => $future['id'], 'expectedVersion' => 1, 'action' => 'publish', 'effectiveAt' => gmdate('Y-m-d\TH:i:s\Z', time() + 3), 'note' => 'S7 future publish'], $super);
$rulesUrl = '/api/v1/admin/compliance/rule/list?merchantId=' . $m . '&keyword=' . urlencode('S7 future ' . $key);
check(api($rulesUrl, null, $ops)['total'] === 0, 'future policy not prematurely applicable');
// Real clock only, no DB date edits or host time changes. Scheduler ticks once per minute.
$deadline = time() + 80;
do {
    if ((int) Db::table('merchant_notify')->where('id', $scheduled['id'])->value('status') === 1
        && api($rulesUrl, null, $ops)['total'] === 1) break;
    sleep(1);
} while (time() < $deadline);
check(api($rulesUrl, null, $ops)['total'] === 1, 'future policy becomes applicable on actual clock');
check(in_array($scheduled['id'], array_column(api('/api/v1/merchant/notifications/list', null, $one)['list'], 'id')), 'actual scheduler delivers due notice to merchant inbox');
check((int) Db::table('merchant_notify_delivery')->where('notify_id', $scheduled['id'])->value('attempts') === 1, 'scheduled delivery completed exactly once');
$audit = json_encode(Db::table('merchant_activity_log')->where('merchant_id', $m)->get());
foreach ([PASSWORD, $secret, $secretTwo, $newSecret, $support['exchangeCode']] as $sensitive) check(!str_contains($audit, $sensitive), 'activity audit excludes synthetic secret');
// Module 11 -> M12 handoff only: real hotel template gate, controlled credentials and first 2FA.
$handoffMerchant = (int) Db::table('merchant_info')->insertGetId(['site_id' => 991, 'merchant_name' => 'S7 handoff ' . $key,
    'credit_code' => 'HANDOFF-' . $key, 'legal_person' => 'Synthetic', 'contact_name' => 'Synthetic', 'contact_phone' => '', 'status' => 0]);
$handoffApp = Db::table('merchant_application')->insertGetId(['site_id' => 991, 'merchant_id' => $handoffMerchant, 'app_no' => 'handoff-' . $key, 'company_name' => 'S7 handoff', 'stage' => 5]);
$template = Db::table('merchant_kyc_template')->where('business_type', 'hotel')->where('status', 1)->orderBy('sort')->first();
check($template !== null, 'real hotel KYC template exists after empty initialization');
$handoffBusiness = Db::table('merchant_application_business')->insertGetId(['site_id' => 991, 'application_id' => $handoffApp,
    'business_name' => 'S7 handoff hotel', 'business_type' => 'hotel', 'kyc_template_id' => $template->id, 'kyc_status' => 3]);
$credentials = api('/api/v1/admin/merchant/verify/approval-credentials', ['id' => $handoffMerchant], $super);
api('/api/v1/admin/merchant/verify/approval-credentials', ['id' => $handoffMerchant], $reader, 40301);
$approval = ['id' => $handoffMerchant, 'channels' => ['inapp'], 'accessCode' => $credentials['access_code'], 'oneTimePassword' => $credentials['one_time_password'], 'remark' => 'S7 controlled handoff'];
api('/api/v1/admin/merchant/verify/approve', $approval, $super, 40901);
$requiredTypes = array_column(array_filter(json_decode($template->docs, true), static fn ($item) => ($item['required'] ?? true) !== false), 'doc_type');
check(count($requiredTypes) > 0, 'hotel approval requires actual template documents');
foreach ($requiredTypes as $type) {
    $handoffDoc = Db::table('merchant_verify_document')->insertGetId(['site_id' => 991, 'merchant_id' => $handoffMerchant,
        'application_id' => $handoffApp, 'biz_unit' => (string) $handoffBusiness, 'doc_type' => $type, 'name' => 'S7 synthetic ' . $type, 'file_url' => $url]);
    api('/api/v1/admin/merchant/document/review', ['docId' => $handoffDoc, 'expectedVersion' => 0, 'action' => 'verify', 'reason' => 'S7 template review'], $super);
}
$issued = api('/api/v1/admin/merchant/verify/approve', $approval, $super);
check($issued['access_code'] === $credentials['access_code'] && $issued['one_time_password'] === $credentials['one_time_password'], 'controlled approval returns issued credentials');
$safeProfile = json_encode(api('/api/v1/admin/merchant/detail?id=' . $handoffMerchant, null, $super));
check(!str_contains($safeProfile, $credentials['access_code']) && !str_contains($safeProfile, $credentials['one_time_password']), 'ordinary profile does not repeat handoff secrets');
$firstLogin = api('/api/v1/merchant/auth/login', ['username' => $issued['access_code'], 'password' => $issued['one_time_password']], '', 0, true);
check($firstLogin['requiresEnrollment'] && !isset($firstLogin['token']), 'newly approved access code enters 2FA enrollment');
$firstSetup = api('/api/v1/merchant/auth/2fa/setup', ['challengeToken' => $firstLogin['challengeToken']]);
$firstSession = api('/api/v1/merchant/auth/2fa/verify', ['challengeToken' => $firstLogin['challengeToken'], 'twoFaCode' => Totp::code($firstSetup['manualKey'], intdiv(time(), 30))]);
api('/api/v1/merchant/stats/dashboard', null, $firstSession['token']);
$handoffAudit = json_encode(Db::table('merchant_activity_log')->where('merchant_id', $handoffMerchant)->get());
check(!str_contains($handoffAudit, $issued['access_code']) && !str_contains($handoffAudit, $issued['one_time_password']), 'handoff activity never contains issued secrets');
echo "HANDOFF merchant=$handoffMerchant application=$handoffApp business=$handoffBusiness (synthetic credentials omitted)\n";
echo "S7 HTTP CHECKS PASSED: $count\n";
