<?php
declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\MerchantController;
use App\Controller\MerchantPropertyController;
use App\Service\MerchantPhoneIndexService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Merchant\MerchantPhoneIndex;
use Mtrip\Shared\Support\CryptoHelper;

function s2Actor(bool $super = true, int $site = 991, array $permissions = []): void {
    AdminContext::set(['admin_id' => 902, 'admin_name' => 'S2 Tester', 'site_id' => $site, 'is_super' => $super, 'permissions' => $permissions]);
}
$directory = $container->get(MerchantController::class);
$property = $container->get(MerchantPropertyController::class);
function requestCall(object $controller, string $method, array $params = []): mixed {
    setRequest($params);
    return $controller->$method()['data'];
}
s2Actor();
if (($argv[1] ?? '') === '--bind') {
    try {
        requestCall($property, 'bind', json_decode($argv[2], true));
        echo 'BOUND';
    } catch (\Mtrip\Shared\Exception\BusinessException $e) {
        echo 'REJECT:' . $e->getCode();
    }
    exit(0);
}
$ids = [];
$apps = [];
$businessIds = [];
$constraint = false;
try {
    $key = (string) $config->get('mtrip.aes_key');
    $id = $ids[] = merchantFixture();
    Db::table('merchant_info')->where('id', $id)->update([
        'merchant_name' => 'S2 Alpha', 'merchant_code' => 'S2-' . $id, 'contact_email' => 's2@hotel.test',
        'contact_phone' => CryptoHelper::encrypt('+95 912-345-6789', $key),
        'access_code' => 'NEVER-EXPOSE-S2', 'two_fa_secret_enc' => 'NEVER-EXPOSE-SECRET',
        'created_at' => '2026-01-15 23:59:59',
    ]);
    $foreign = $ids[] = merchantFixture(992);
    Db::table('merchant_info')->where('id', $foreign)->update(['merchant_name' => 'S2 Foreign']);
    $app = $apps[] = Db::table('merchant_application')->insertGetId([
        'merchant_id' => $id, 'site_id' => 991, 'app_no' => 'S2-' . bin2hex(random_bytes(6)),
        'company_name' => 'S2 Company', 'country' => 'Myanmar',
    ]);
    foreach ([['Hotel One', 'hotel', 1], ['Hotel Two', 'hotel', 1], ['Restaurant deferred', 'restaurant', 1], ['Hotel Pending', 'hotel', 2]] as [$name, $type, $kyc]) {
        $businessIds[] = Db::table('merchant_application_business')->insertGetId([
            'site_id' => 991, 'application_id' => $app, 'business_name' => $name, 'business_type' => $type,
            'kyc_status' => $kyc, 'city' => 'Yangon', 'contact_phone' => CryptoHelper::encrypt('+95 9987654321', $key),
        ]);
    }
    $indexer = $container->get(MerchantPhoneIndexService::class);
    $dry = $indexer->run();
    check($dry['indexed'] >= 5 && Db::table('merchant_info')->where('id', $id)->value('contact_phone_index') === null, 'S2 dry-run does not write');
    $indexer->run(true);
    check($indexer->run(true)['indexed'] === 0, 'S2 phone backfill replay no duplicate');
    foreach (['S2 Alpha', 'S2-' . $id, (string) $id, 's2@hotel.test', 'Hotel One', 'S2 Company', '00959123456789', '+95 9987654321'] as $keyword) {
        $result = requestCall($directory, 'index', ['keyword' => $keyword, 'siteId' => 991]);
        check($result['total'] === 1 && (int) $result['list'][0]['id'] === $id, 'S2 search ' . (str_contains($keyword, '95') ? 'full phone' : 'field'));
    }
    check(requestCall($directory, 'index', ['keyword' => '123456789', 'siteId' => 991])['total'] === 0, 'S2 no partial phone search');
    check(requestCall($directory, 'index', ['keyword' => '%', 'siteId' => 991])['total'] === 0, 'S2 literal percent does not match all');
    check(requestCall($directory, 'index', ['keyword' => 'S2 Alpha', 'registeredFrom' => '2026-01-15', 'registeredTo' => '2026-01-15'])['total'] === 1, 'S2 inclusive registration end date');
    foreach ([['registeredFrom' => '2026-02-30'], ['registeredFrom' => '2026-02-02', 'registeredTo' => '2026-02-01'], ['sortField' => 'id desc;DROP'], ['sortOrder' => 'bad'], ['status' => 'garbage'], ['category' => 'invalid']] as $invalid) {
        rejects(40001, fn () => requestCall($directory, 'index', $invalid), 'S2 reject invalid filter');
    }
    s2Actor(false, 991);
    check(requestCall($directory, 'index', ['siteId' => 992, 'keyword' => 'S2 Foreign'])['total'] === 0, 'S2 forged site filter denied');
    rejects(40302, fn () => requestCall($directory, 'detail', ['id' => $foreign]), 'S2 foreign profile denied');
    s2Actor(false, 0);
    check(requestCall($directory, 'index', ['keyword' => 'S2 Alpha'])['total'] === 0, 'S2 site zero without super is not global');
    s2Actor();
    $created = requestCall($directory, 'create', [
        'siteId' => 991, 'merchantName' => 'S2 Created', 'creditCode' => 'S2-' . bin2hex(random_bytes(6)),
        'legalPerson' => 'Fixture', 'contactName' => 'Fixture', 'contactPhone' => '+95 9555000111',
    ]);
    $newId = $ids[] = (int) $created['id'];
    check(requestCall($directory, 'index', ['keyword' => '00959555000111'])['total'] === 1, 'S2 merchant create writes phone index');
    requestCall($directory, 'update', ['id' => $newId, 'contactPhone' => '+95 9555000222']);
    check(requestCall($directory, 'index', ['keyword' => '00959555000111'])['total'] === 0
        && requestCall($directory, 'index', ['keyword' => '+95 9555000222'])['total'] === 1, 'S2 phone update removes old search match');
    $profile = requestCall($directory, 'detail', ['id' => $id]);
    $encoded = json_encode($profile);
    check(!str_contains($encoded, 'NEVER-EXPOSE') && !str_contains($encoded, 'contact_phone_index') && !array_key_exists('access_code', $profile['merchant']), 'S2 profile credentials and hashes hidden');
    check($profile['merchant']['access_code_configured'] === true && count($profile['businesses']) === 4 && count($profile['applications']) === 1, 'S2 profile aggregates company and KYC sources');
    $onboarding = requestCall($container->get(\App\Controller\OnboardingController::class), 'detail', ['id' => $app]);
    check(!str_contains(json_encode($onboarding), 'contact_phone_index'), 'S2 legacy onboarding does not expose phone index');
    $verify = requestCall($container->get(\App\Controller\VerifyController::class), 'detail', ['id' => $id]);
    check(!str_contains(json_encode($verify), 'contact_phone_index'), 'S2 legacy verification does not expose phone index');
    $listRow = requestCall($directory, 'index', ['keyword' => 'S2 Alpha'])['list'][0];
    check(!array_key_exists('access_code', $listRow) && !array_key_exists('two_fa_secret_enc', $listRow), 'S2 directory credential whitelist');

    $legacy = Db::table('merchant_store')->insertGetId(['site_id' => 991, 'merchant_id' => $id, 'store_name' => 'Legacy main', 'is_main' => 1]);
    $base = ['merchantId' => $id, 'businessId' => $businessIds[0], 'storeId' => 0, 'expectedVersion' => 0, 'countryCode' => 'mm', 'cityKey' => '  Yangon  ', 'note' => 'S2 explicit link'];
    s2Actor(false, 991);
    rejects(40301, fn () => requestCall($property, 'bind', $base), 'S2 binding permission required');
    s2Actor(false, 992, ['merchant:property:bind']);
    rejects(40302, fn () => requestCall($property, 'bind', $base), 'S2 cross-site bind denied');
    s2Actor(false, 991, ['merchant:property:bind']);
    foreach ([['businessId' => $businessIds[2]], ['businessId' => $businessIds[3]], ['merchantId' => $foreign]] as $override) {
        rejects($override['merchantId'] ?? 0 ? 40302 : 40901, fn () => requestCall($property, 'bind', array_replace($base, $override)), 'S2 invalid business association denied');
    }
    foreach ([['note' => ' '], ['expectedVersion' => -1], ['countryCode' => 'MMX'], ['cityKey' => ' ']] as $override) {
        rejects(40001, fn () => requestCall($property, 'bind', array_replace($base, $override)), 'S2 required mapping fields validated');
    }
    $bound = requestCall($property, 'bind', $base);
    $storeId = (int) $bound['store_id'];
    check($storeId !== (int) $legacy && Db::table('merchant_store')->where('id', $legacy)->value('source_business_id') === null, 'S2 no inferred legacy main-store binding');
    $store = Db::table('merchant_store')->where('id', $storeId)->first();
    check($store->country_code === 'MM' && $store->city_key === 'yangon' && (int) $store->display_enabled === 0, 'S2 explicit normalized location with display off');
    check(Db::table('merchant_property_history')->where('store_id', $storeId)->count() === 1, 'S2 property audit persisted');
    rejects(40901, fn () => requestCall($property, 'bind', $base), 'S2 duplicate business denied');
    rejects(40901, fn () => requestCall($property, 'bind', array_replace($base, ['storeId' => $storeId])), 'S2 stale property version denied');
    rejects(40901, fn () => requestCall($property, 'bind', array_replace($base, ['storeId' => $storeId, 'expectedVersion' => 1, 'businessId' => $businessIds[1]])), 'S2 cannot reassign linked property');
    requestCall($property, 'bind', array_replace($base, ['storeId' => $storeId, 'expectedVersion' => 1, 'cityKey' => 'Mandalay']));
    $history = requestCall($property, 'history', ['merchantId' => $id, 'pageSize' => 1]);
    check($history['total'] === 2 && count($history['list']) === 1 && $history['list'][0]['before_json']['city_key'] === 'yangon', 'S2 paged history includes before and after');
    check(requestCall($directory, 'index', ['country' => 'mm', 'city' => 'MANDALAY', 'category' => 'hotel'])['total'] === 1, 'S2 property location filter');
    check(requestCall($directory, 'index', ['country' => 'TH', 'city' => 'Mandalay'])['total'] === 0, 'S2 location fields match same property');

    Db::statement("ALTER TABLE merchant_property_history ADD CONSTRAINT s2_fail_history CHECK (note <> 'S2-FAIL')");
    $constraint = true;
    try {
        requestCall($property, 'bind', array_replace($base, ['businessId' => $businessIds[1], 'note' => 'S2-FAIL']));
        throw new RuntimeException('Expected audit write failure');
    } catch (\Hyperf\Database\Exception\QueryException) {}
    check(!Db::table('merchant_store')->where('source_business_id', $businessIds[1])->exists(), 'S2 audit failure rolls back property creation');
    Db::statement('ALTER TABLE merchant_property_history DROP CHECK s2_fail_history');
    $constraint = false;

    $processes = [];
    $race = array_replace($base, ['businessId' => $businessIds[1]]);
    for ($n = 0; $n < 2; ++$n) {
        $pipes = [];
        $process = proc_open([PHP_BINARY, __FILE__, '--bind', json_encode($race)], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        fclose($pipes[0]);
        $processes[] = [$process, $pipes];
    }
    $outputs = [];
    foreach ($processes as [$process, $pipes]) {
        $outputs[] = stream_get_contents($pipes[1]);
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        check(proc_close($process) === 0 && $error === '', 'S2 concurrent worker success');
    }
    sort($outputs);
    check($outputs === ['BOUND', 'REJECT:40901'], 'S2 concurrent binding one success one conflict');

    s2Actor();
    $secondStore = (int) Db::table('merchant_store')->where('source_business_id', $businessIds[1])->value('id');
    requestCall($property, 'bind', array_replace($base, ['businessId' => $businessIds[1], 'storeId' => $secondStore, 'expectedVersion' => 1, 'countryCode' => 'TH', 'cityKey' => 'Bangkok']));
    check(requestCall($directory, 'index', ['country' => 'MM', 'city' => 'Bangkok'])['total'] === 0, 'S2 cannot stitch country and city across properties');
    Db::table('merchant_store')->where('id', $secondStore)->update(['deleted_at' => date('Y-m-d H:i:s')]);
    $archived = requestCall($directory, 'detail', ['id' => $id]);
    check(count(array_filter($archived['properties'], static fn ($s) => !empty($s['deleted_at']))) === 1, 'S2 archived link remains visible in profile');
    rejects(40901, fn () => requestCall($property, 'bind', array_replace($base, ['businessId' => $businessIds[1]])), 'S2 archived business cannot be silently reused');
    check(requestCall($directory, 'index', ['country' => 'TH', 'city' => 'Bangkok'])['total'] === 0, 'S2 archived property excluded from location filter');
    s2Actor(false, 992);
    rejects(40302, fn () => requestCall($property, 'history', ['merchantId' => $id]), 'S2 cross-site property history denied');
    s2Actor();
    Db::table('merchant_blacklist')->insert(['site_id' => 991, 'merchant_id' => $id, 'reason' => 'S2 test', 'status' => 1]);
    Db::table('merchant_info')->where('id', $id)->update(['status' => 4]);
    check(requestCall($directory, 'index', ['keyword' => 'S2 Alpha', 'status' => 4])['total'] === 0, 'S2 suspended excludes blacklist');
    check(requestCall($directory, 'index', ['keyword' => 'S2 Alpha', 'status' => 'blacklisted'])['total'] === 1, 'S2 blacklist filter');
    check(requestCall($directory, 'index', ['keyword' => 'S2 Alpha', 'excludeBlacklisted' => 1])['total'] === 0, 'S2 legacy excludeBlacklisted honored');

    for ($n = 0; $n < 22; ++$n) {
        $fixture = $ids[] = merchantFixture();
        Db::table('merchant_info')->where('id', $fixture)->update(['merchant_name' => 'S2 Pagination', 'created_at' => '2026-01-01 00:00:00']);
    }
    $p1 = requestCall($directory, 'index', ['keyword' => 'S2 Pagination', 'page' => 1, 'pageSize' => 20, 'sortField' => 'registeredAt', 'sortOrder' => 'asc']);
    $p2 = requestCall($directory, 'index', ['keyword' => 'S2 Pagination', 'page' => 2, 'pageSize' => 20, 'sortField' => 'registeredAt', 'sortOrder' => 'asc']);
    check($p1['total'] === 22 && count($p2['list']) === 2 && !array_intersect(array_column($p1['list'], 'id'), array_column($p2['list'], 'id')), 'S2 tied sort stable across pages');
    $reverse = requestCall($directory, 'index', ['keyword' => 'S2 Pagination', 'sortField' => 'id', 'sortOrder' => 'desc']);
    check($reverse['list'][0]['id'] === end($ids), 'S2 descending sort');
    check(requestCall($directory, 'index', ['pageSize' => 999])['pageSize'] === 200, 'S2 maximum page size');
} finally {
    if ($constraint) Db::statement('ALTER TABLE merchant_property_history DROP CHECK s2_fail_history');
    foreach (['merchant_property_history', 'merchant_activity_log', 'merchant_blacklist', 'merchant_store'] as $table) {
        if ($ids) Db::table($table)->whereIn('merchant_id', $ids)->delete();
    }
    if ($businessIds) Db::table('merchant_application_business')->whereIn('id', $businessIds)->delete();
    if ($apps) Db::table('merchant_application')->whereIn('id', $apps)->delete();
    if ($ids) Db::table('merchant_info')->whereIn('id', $ids)->delete();
}
echo "S2 directory/property integration complete\n";
