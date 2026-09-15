<?php
declare(strict_types=1);
require __DIR__ . '/M12Bootstrap.php';

use App\Service\MarketplaceService;
use App\Controller\Admin\RankingController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Merchant\MarketplaceReader as Reader;

$service = new MarketplaceService();
AdminContext::set(['admin_id' => 905, 'admin_name' => 'S5 Tester', 'site_id' => 0, 'is_super' => true]);
if (($argv[1] ?? '') === '--reorder') {
    $args = json_decode($argv[2], true);
    try { $service->reorder($args['scope'], $args['input']); echo 'S5-WON'; }
    catch (\Mtrip\Shared\Exception\BusinessException $e) { if ($e->getCode() !== 40901) throw $e; echo 'S5-CONFLICT'; }
    exit;
}
$merchants = $properties = $rooms = $markets = [];
$constraint = false;
$key = 's5-' . bin2hex(random_bytes(5));
$input = ['siteId' => 991, 'businessType' => 'hotel', 'countryCode' => 'MM', 'cityKey' => $key];
$scope = $service->scope($input, 'listing');
$version = 0;
$change = function (string $method, array $data = []) use ($service, $scope, &$version) {
    $result = $service->$method($scope, $data + ['expectedVersion' => $version, 'note' => 'S5 fixture']);
    $version = $result['version'];
    return $result;
};
try {
    $m = $merchants[] = merchantFixture();
    for ($i = 0; $i < 4; $i++) {
        $p = $properties[] = (int) Db::table('merchant_store')->insertGetId([
            'site_id' => 991, 'merchant_id' => $m, 'source_business_id' => null,
            'store_name' => 'S5 Property ' . $i, 'business_type' => 'hotel',
            'country_code' => 'MM', 'city_key' => $key, 'status' => 1,
            'kyc_status' => 1, 'content_status' => 2, 'content_approved_version' => 1, 'publish_status' => 1,
            'operating_status' => 1, 'display_enabled' => 0,
        ]);
        $rooms[] = (int) Db::table('hotel_room_type')->insertGetId([
            'site_id' => 991, 'property_id' => $p,
            'room_name' => 'S5 Room', 'base_price' => 100 - $i,
            'status' => 1, 'publish_status' => 2, 'approved_version' => 1,
        ]);
    }
    check($service->read($scope)['list'] === [], 'S5 ignores legacy demo rows');
    foreach ([array_replace($input, ['siteId' => 0]), array_replace($input, ['cityKey' => '']), array_replace($input, ['countryCode' => '']), array_replace($input, ['businessType' => 'restaurant'])] as $bad) {
        rejects(40001, fn () => $service->scope($bad, 'listing'), 'S5 explicit valid hotel market required');
    }
    rejects(40901, fn () => $change('addListing', ['propertyId' => $properties[0]]), 'S5 display eligibility starts disabled');
    $candidate = Reader::properties($scope)[$properties[0]] ?? [];
    check(Reader::qualified($candidate, false), 'S5 property satisfies live gates before display');
    $listingIds = [];
    foreach ($properties as $p) {
        $service->propertyDisplay($scope, ['propertyId' => $p, 'expectedPropertyVersion' => 0, 'displayEnabled' => 1, 'note' => 'S5 enable']);
        $listingIds[] = (int) $change('addListing', ['propertyId' => $p])['id'];
    }
    $markets[] = (int) Db::table('ranking_market')->where($scope)->value('id');
    check(count($service->read($scope)['list']) === 4, 'S5 real properties mapped without per-room ranking');
    check(Reader::published(991, 'listing', 'MM', $key) === [], 'S5 never publishes draft automatically');
    check(count($service->preview($scope, false)['list']) === 4, 'S5 draft consumer projection reads real entities');
    rejects(40901, fn () => $change('addListing', ['propertyId' => $properties[0]]), 'S5 duplicate property rejected');
    rejects(40901, fn () => $service->reorder($scope, ['ids' => $listingIds, 'expectedVersion' => 0, 'note' => 'stale']), 'S5 optimistic conflict');
    foreach ([[], [$listingIds[0]], [$listingIds[0], $listingIds[0]], [999999999]] as $ids) {
        rejects($ids === [] ? 40001 : 40901, fn () => $change('reorder', ['ids' => $ids]), 'S5 partial/duplicate/unknown reorder rejected atomically');
    }
    $change('flags', ['id' => $listingIds[1], 'featured' => 1]);
    $change('flags', ['id' => $listingIds[2], 'pinned' => 1, 'featured' => 1]);
    check(array_column($service->preview($scope, false)['list'], 'id') === [$properties[2], $properties[1], $properties[0], $properties[3]], 'S5 pinned > featured > normal, dual flag shown once');
    rejects(40901, fn () => $change('reorder', ['ids' => $listingIds]), 'S5 cross-group drag rejected');
    $change('reorder', ['ids' => [$listingIds[3], $listingIds[0]]]);
    $change('publish');
    $live = Reader::published(991, 'listing', 'MM', $key);
    check(array_column($live, 'id') === [$properties[2], $properties[1], $properties[3], $properties[0]], 'S5 group-local order published');
    check($live === $service->preview($scope, true)['list'], 'S5 live and published preview match exactly');
    check(!isset($live[0]['merchant_id'], $live[0]['kyc_status'], $live[0]['status']), 'S5 consumer whitelist excludes internal data');
    $publishedJson = (string) Db::table('ranking_market')->where($scope)->value('published_json');
    check(! str_contains($publishedJson, 'goods_id') && ! str_contains($publishedJson, 'business_id'), 'S5 published snapshot contains Property IDs only');
    check(Reader::published(992, 'listing', 'MM', $key) === [], 'S5 published site isolation');
    check(Reader::published(991, 'listing', 'TH', $key) === [], 'S5 published country isolation');
    $change('flags', ['id' => $listingIds[2], 'pinned' => 0, 'featured' => 0]);
    check($live === Reader::published(991, 'listing', 'MM', $key), 'S5 edits after publish do not leak');
    foreach ([['merchant_info', $m, 'status', 4, 3], ['merchant_store', $properties[0], 'status', 0, 1],
        ['merchant_store', $properties[0], 'kyc_status', 0, 1], ['merchant_store', $properties[0], 'content_status', 1, 2],
        ['merchant_store', $properties[0], 'content_approved_version', 0, 1],
        ['merchant_store', $properties[0], 'publish_status', 0, 1], ['merchant_store', $properties[0], 'operating_status', 0, 1],
        ['merchant_store', $properties[0], 'display_enabled', 0, 1], ['hotel_room_type', $rooms[0], 'publish_status', 1, 2],
        ['hotel_room_type', $rooms[0], 'approved_version', 0, 1],
        ['merchant_store', $properties[0], 'merchant_id', 0, $m]] as [$table, $id, $column, $bad, $good]) {
        Db::table($table)->where('id', $id)->update([$column => $bad]);
        check(!in_array($properties[0], array_column(Reader::published(991, 'listing', 'MM', $key), 'id')), 'S5 live exclusion ' . $table . '.' . $column);
        rejects(40901, fn () => $change('publish'), 'S5 publishing visible ineligible hotel rejected');
        Db::table($table)->where('id', $id)->update([$column => $good]);
    }
    $blacklist = (int) Db::table('merchant_blacklist')->insertGetId(['site_id' => 991, 'merchant_id' => $m, 'reason' => 'S5', 'status' => 1]);
    check(Reader::published(991, 'listing', 'MM', $key) === [], 'S5 blacklist immediately excludes all properties');
    Db::table('merchant_blacklist')->where('id', $blacklist)->delete();
    Db::table('merchant_store')->where('id', $properties[0])->update(['store_name' => 'S5 Renamed']);
    $names = array_column($service->read($scope)['list'], 'property_name');
    check(in_array('S5 Renamed', $names), 'S5 current property name, not ranking snapshot');
    $service->propertyDisplay($scope, ['propertyId' => $properties[0], 'expectedPropertyVersion' => 1, 'displayEnabled' => 0, 'note' => 'S5 revoke']);
    check(count(Reader::published(991, 'listing', 'MM', $key)) === 3, 'S5 explicit live display revoke');
    rejects(40901, fn () => $service->propertyDisplay($scope, ['propertyId' => $properties[0], 'expectedPropertyVersion' => 1, 'displayEnabled' => 1, 'note' => 'stale']), 'S5 property display version conflict');
    $change('flags', ['id' => $listingIds[0], 'status' => 2]);
    $change('publish');
    check(count(Reader::published(991, 'listing', 'MM', $key)) === 3, 'S5 hidden disqualified draft allows other hotels publish');

    $other = $service->scope(array_replace($input, ['cityKey' => $key . '-other']), 'listing');
    rejects(40901, fn () => $service->addListing($other, ['propertyId' => $properties[1], 'expectedVersion' => 0, 'note' => 'cross city']), 'S5 no cross-city property mapping');
    AdminContext::set(['site_id' => 992, 'is_super' => false, 'permissions' => ['merchant:ranking:save', 'merchant:ranking:publish']]);
    check($service->scope($input, 'listing')['site_id'] === 992, 'S5 forged site forced to actor site');
    rejects(40301, fn () => $change('publish'), 'S5 non-super cannot publish even with button permission');
    AdminContext::set(['admin_id' => 905, 'admin_name' => 'S5 Tester', 'site_id' => 0, 'is_super' => true]);

    $destScope = $service->scope(['siteId' => 991, 'region' => $key], 'destination');
    $destInput = ['name' => 'S5 Destination', 'destinationCountry' => 'MM', 'destinationCity' => $key, 'expectedVersion' => 0, 'note' => 'S5 dest'];
    $d1 = $service->destination($destScope, $destInput, true)['id'];
    $markets[] = (int) Db::table('ranking_market')->where($destScope)->value('id');
    $d2 = $service->destination($destScope, array_replace($destInput, ['name' => 'S5 Two', 'expectedVersion' => 1]), true)['id'];
    check(Reader::published(991, 'destination', '', $key) === [], 'S5 destination drafts isolated');
    $service->reorder($destScope, ['ids' => [(int) $d2, (int) $d1], 'expectedVersion' => 2, 'note' => 'S5 dest reorder']);
    $service->publish($destScope, ['expectedVersion' => 3, 'note' => 'S5 dest publish']);
    $destLive = Reader::published(991, 'destination', '', $key);
    check(array_column($destLive, 'id') === [$d2, $d1], 'S5 destination reorder persists');
    check($destLive === $service->preview($destScope, true)['list'], 'S5 destination preview/live parity');
    check((int) $service->read($scope)['market']['version'] === $version, 'S5 destination publish does not touch hotels');
    $service->destination($destScope, array_replace($destInput, ['id' => $d1, 'name' => 'S5 Draft Name', 'expectedVersion' => 4]), false);
    check($destLive === Reader::published(991, 'destination', '', $key), 'S5 destination name edit does not leak before publish');
    $service->flags($destScope, ['id' => (int) $d1, 'featured' => 1, 'expectedVersion' => 5, 'note' => 'S5 featured']);
    check($service->preview($destScope, false)['list'][0]['id'] === $d1, 'S5 popular destination priority');
    $service->flags($destScope, ['id' => (int) $d1, 'status' => 2, 'expectedVersion' => 6, 'note' => 'S5 hide']);
    check(count($service->preview($destScope, false)['list']) === 1 && count(Reader::published(991, 'destination', '', $key)) === 2, 'S5 destination hide requires publishing');
    foreach (['javascript:alert(1)', 'data:text/html,hello'] as $url) rejects(40001, fn () => $service->destination($destScope, array_replace($destInput, ['imageUrl' => $url, 'expectedVersion' => 7]), true), 'S5 unsafe destination URL rejected');

    $before = $service->read($scope);
    $historyCount = Db::table('ranking_history')->whereIn('market_id', $markets)->count();
    Db::statement("ALTER TABLE ranking_history ADD CONSTRAINT s5_audit_fault CHECK (note <> 'S5 FAIL')");
    $constraint = true;
    try { $service->publish($scope, ['expectedVersion' => $version, 'note' => 'S5 FAIL']); throw new RuntimeException('Expected audit failure'); }
    catch (\Hyperf\Database\Exception\QueryException) {}
    check($before === $service->read($scope) && $historyCount === Db::table('ranking_history')->whereIn('market_id', $markets)->count(), 'S5 audit failure rolls back publish and version');
    Db::statement('ALTER TABLE ranking_history DROP CHECK s5_audit_fault'); $constraint = false;
    $ids = [$listingIds[0], $listingIds[2], $listingIds[3]];
    $args = json_encode(['scope' => $scope, 'input' => ['ids' => $ids, 'expectedVersion' => $version, 'note' => 'S5 concurrent']]);
    $workers = [];
    for ($i = 0; $i < 2; $i++) { $pipes = []; $process = proc_open([PHP_BINARY, __FILE__, '--reorder', $args], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes); $workers[] = [$process, $pipes]; }
    $outputs = [];
    foreach ($workers as [$process, $pipes]) { $outputs[] = stream_get_contents($pipes[1]); $error = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); check(proc_close($process) === 0, 'S5 concurrent process completes ' . $error); }
    check(count(array_filter($outputs, static fn ($s) => str_contains($s, 'S5-WON'))) === 1 && count(array_filter($outputs, static fn ($s) => str_contains($s, 'S5-CONFLICT'))) === 1, 'S5 exactly one simultaneous editor wins');
    $version++;
    check((int) $service->read($scope)['market']['version'] === $version, 'S5 concurrent version increments once');
    $controller = $container->get(RankingController::class);
    setRequest($input);
    check(count($controller->listings()['data']['list']) === 4, 'S5 controller reads real market');
    setRequest($input + ['entityType' => 'listing', 'pageSize' => 1]);
    $history = $controller->history()['data'];
    check(count($history['list']) === 1 && $history['total'] > 1 && (int) $history['list'][0]['site_id'] === 991, 'S5 scoped audit pagination with actual site');
    $many = [];
    for ($i = 0; $i < 150; $i++) $many[] = ['id' => $i + 1, 'rank' => 1, 'featured' => 0, 'pinned' => 0];
    check(count(Reader::ordered($many)) === 150 && Reader::ordered(array_reverse($many))[0]['id'] === 1, 'S5 no fixed ranking cap and stable ID tie break');
} finally {
    if ($constraint) Db::statement('ALTER TABLE ranking_history DROP CHECK s5_audit_fault');
    // Captured fixture IDs only; all writes are in the bootstrap-verified isolated database.
    foreach (['ranking_history', 'ranking_listing', 'ranking_destination'] as $table) Db::table($table)->whereIn('market_id', $markets)->delete();
    Db::table('ranking_market')->whereIn('id', $markets)->delete();
    Db::table('merchant_property_history')->whereIn('store_id', $properties)->delete();
    Db::table('hotel_room_type')->whereIn('id', $rooms)->delete();
    Db::table('merchant_store')->whereIn('id', $properties)->delete();
    Db::table('merchant_blacklist')->whereIn('merchant_id', $merchants)->delete();
    Db::table('merchant_info')->whereIn('id', $merchants)->delete();
}
