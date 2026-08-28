<?php
declare(strict_types=1);
require __DIR__ . '/M12Bootstrap.php';

use App\Service\MerchantComplianceService;
use App\Service\PlatformRuleService;
use App\Controller\PlatformRuleController;
use App\Controller\MerchantActivityController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;

$super = ['admin_id' => 906, 'admin_name' => 'S6 Tester', 'site_id' => 0, 'is_super' => true];
AdminContext::set($super);
$service = new MerchantComplianceService();
$rules = new PlatformRuleService();
if (($argv[1] ?? '') === '--execute') {
    $args = json_decode($argv[2], true);
    try { $service->execute($args['action'], $args['input']); echo 'S6-WON'; }
    catch (\Mtrip\Shared\Exception\BusinessException $e) { if ($e->getCode() !== 40901) throw $e; echo 'S6-CONFLICT'; }
    exit;
}
$merchants = $ruleIds = [];
$fault = null;
$key = 's6-' . bin2hex(random_bytes(5));
$request = fn () => $key . '-' . bin2hex(random_bytes(5));
$draft = ['title' => 'S6 hotel policy', 'category' => 'Booking', 'severity' => 2, 'body' => 'Accurate booking information', 'siteId' => 0, 'expectedVersion' => 0, 'note' => 'S6 initial draft'];
try {
    $m = $merchants[] = merchantFixture();
    $foreign = $merchants[] = merchantFixture(992);
    rejects(40001, fn () => $rules->save(array_replace($draft, ['id' => []])), 'S6 malformed rule ID rejected');
    rejects(40001, fn () => $rules->save(array_replace($draft, ['effectiveAt' => []])), 'S6 malformed effective date rejected');
    foreach (['note', 'body', 'title', 'category'] as $field) rejects(40001, fn () => $rules->save(array_replace($draft, [$field => ''])), 'S6 rule required ' . $field);
    rejects(40001, fn () => $rules->save(array_replace($draft, ['category' => 'Invented'])), 'S6 predefined rule categories');
    $r = $rules->save($draft); $ruleIds[] = $r['id'];
    check($rules->effective($r['id']) === null, 'S6 draft not effective');
    $record = ['merchantId' => $m, 'ruleId' => $r['id'], 'ruleRevisionId' => $r['revision_id'], 'details' => 'Incorrect hotel booking details', 'expectedVersion' => 0, 'note' => 'S6 record', 'requestId' => $request()];
    rejects(40901, fn () => $service->execute('record', $record), 'S6 unpublished rule cannot enforce');
    $r = $rules->save(['id' => $r['id'], 'expectedVersion' => 1, 'note' => 'publish'], 'publish');
    $record['ruleRevisionId'] = $r['revision_id'];
    rejects(40001, fn () => $service->execute('record', array_replace($record, ['merchantId' => []])), 'S6 malformed merchant ID rejected');
    rejects(40901, fn () => $service->execute('record', array_replace($record, ['ruleRevisionId' => 999999])), 'S6 stale selected rule revision rejected');
    check($rules->effective($r['id'])['version'] === 2, 'S6 immediate publication');
    $saved = $rules->save(array_replace($draft, ['id' => $r['id'], 'expectedVersion' => 2, 'body' => 'Changed draft']));
    check($rules->effective($r['id'])['body'] === $draft['body'], 'S6 draft edit preserves live policy');
    rejects(40901, fn () => $rules->save(['id' => $r['id'], 'expectedVersion' => 2, 'note' => 'stale'], 'publish'), 'S6 stale rule version');
    rejects(40001, fn () => $rules->save(['id' => $r['id'], 'expectedVersion' => 3, 'note' => 'bad date', 'effectiveAt' => '2027-01-01 12:00:00'], 'publish'), 'S6 rule timezone required');
    $scheduled = $rules->save(['id' => $r['id'], 'expectedVersion' => 3, 'note' => 'future', 'effectiveAt' => gmdate('Y-m-d\TH:i:s\Z', time() + 86400)], 'publish');
    check($rules->effective($r['id'])['version'] === 2, 'S6 future revision leaves current policy intact');
    $case = $service->execute('record', $record);
    check($case == $service->execute('record', $record), 'S6 record replay exactly once');
    rejects(40901, fn () => $service->execute('record', array_replace($record, ['note' => 'different'])), 'S6 replay payload conflict');
    $originalCase = (array) Db::table('merchant_violation')->where('id', $case['id'])->first();
    check($originalCase['category_code'] === 'Booking' && (int) $originalCase['rule_revision_id'] === $r['revision_id'], 'S6 categorized immutable rule snapshot');
    $act = ['id' => $case['id'], 'expectedVersion' => 1, 'requestId' => $request(), 'note' => 'S6 warn', 'reason' => 'Correct the booking description', 'level' => 1];
    $warning = $service->execute('warn', $act);
    $originalWarning = (array) Db::table('merchant_warning')->where('id', $warning['warning_id'])->first();
    check($warning == $service->execute('warn', $act), 'S6 warning replay without duplicate delivery');
    check(Db::table('merchant_notify_delivery')->where('notify_id', $warning['notification_id'])->where('status', 'delivered')->exists(), 'S6 real in-app warning receipt');
    rejects(40901, fn () => $service->execute('resolve', array_replace($act, ['requestId' => $request()])), 'S6 stale case rejects');
    $suspend = ['id' => $case['id'], 'expectedVersion' => 2, 'expectedMerchantVersion' => 0, 'requestId' => $request(), 'note' => 'S6 suspend', 'confirmed' => true];
    rejects(40001, fn () => $service->execute('suspend', array_replace($suspend, ['confirmed' => false])), 'S6 suspension confirmation required');
    $state = $service->execute('suspend', $suspend);
    check($state['merchant_state']['status'] === 4 && (int) Db::table('merchant_info')->where('id', $m)->value('status') === 4, 'S6 suspension through authoritative state service');
    check($state == $service->execute('suspend', $suspend), 'S6 suspension replay');
    check(Db::table('merchant_notify')->where('merchant_id', $m)->count() === 3, 'S6 one notification per compliance action, no duplicate status notice');
    $ctl = $container->get(PlatformRuleController::class);
    setRequest(['merchantId' => $m]);
    $row = $ctl->violations()['data']['list'][0];
    check((int) $row['version'] === 3 && (int) $row['can_restore'] === 1, 'S6 current case and linked suspension projection');
    $restore = ['id' => $case['id'], 'expectedVersion' => 3, 'expectedMerchantVersion' => 1, 'requestId' => $request(), 'note' => 'S6 reviewed', 'confirmed' => true];
    rejects(40901, fn () => $service->execute('restore', array_replace($restore, ['expectedMerchantVersion' => 0])), 'S6 stale merchant state version rejected');
    AdminContext::set(['admin_id' => 907, 'site_id' => 991, 'is_super' => false, 'permissions' => ['platform:violation:handle']]);
    rejects(40301, fn () => $service->execute('restore', $restore), 'S6 handling permission alone cannot restore');
    AdminContext::set($super);
    $state = $service->execute('restore', $restore);
    check($state['merchant_state']['status'] === 3, 'S6 reviewed restore');
    $revoke = ['id' => $warning['warning_id'], 'expectedVersion' => 4, 'requestId' => $request(), 'note' => 'S6 correction'];
    $service->execute('revoke', $revoke);
    check($originalWarning === (array) Db::table('merchant_warning')->where('id', $warning['warning_id'])->first(), 'S6 revocation never edits warning original');
    setRequest(['merchantId' => $m, 'status' => 2]);
    check($ctl->warnings()['data']['total'] === 1, 'S6 revocation derived from appended event');
    rejects(40901, fn () => $service->execute('revoke', array_replace($revoke, ['expectedVersion' => 5, 'requestId' => $request()])), 'S6 second revoke rejected');
    $resolve = ['id' => $case['id'], 'expectedVersion' => 5, 'requestId' => $request(), 'note' => 'S6 resolved'];
    $service->execute('resolve', $resolve);
    check($originalCase === (array) Db::table('merchant_violation')->where('id', $case['id'])->first(), 'S6 resolution leaves original violation intact');
    setRequest(['merchantId' => $m, 'status' => 2]);
    check($ctl->violations()['data']['total'] === 1, 'S6 current resolved projection');
    rejects(40901, fn () => $service->execute('warn', array_replace($act, ['expectedVersion' => 6, 'requestId' => $request()])), 'S6 resolved case cannot warn');
    $service->execute('reopen', array_replace($resolve, ['expectedVersion' => 6, 'requestId' => $request()]));
    foreach (['', str_repeat('x', 501)] as $note) rejects(40001, fn () => $service->execute('resolve', array_replace($resolve, ['note' => $note])), 'S6 every action requires bounded note');
    AdminContext::set(['admin_id' => 908, 'site_id' => 992, 'is_super' => false, 'permissions' => ['platform:violation:handle', 'platform:warning:revoke', 'platform:rule:publish', 'platform:rule:list']]);
    rejects(40302, fn () => $service->execute('resolve', $resolve), 'S6 case ID cross-site rejected');
    rejects(40302, fn () => $service->execute('revoke', $revoke), 'S6 warning ID cross-site rejected');
    rejects(40301, fn () => $rules->save(['id' => $r['id'], 'expectedVersion' => 4, 'note' => 'forged'], 'publish'), 'S6 central rule publishing super only');
    setRequest(['merchantId' => $m, 'siteId' => 991]);
    check($ctl->warnings()['data']['total'] === 0 && $ctl->violations()['data']['total'] === 0 && $ctl->complianceHistory()['data']['total'] === 0, 'S6 all lists enforce actor site');
    setRequest([]);
    $global = array_values(array_filter($ctl->rules()['data']['list'], fn ($x) => $x['id'] == $r['id']))[0];
    check($global['body'] === $draft['body'] && $global['scheduled_at'] === null && $global['exception_merchant_ids'] === [], 'S6 global published read excludes draft and future changes');
    AdminContext::set(['admin_id' => 908, 'site_id' => 0, 'is_super' => false]);
    setRequest(['merchantId' => $m]);
    check($ctl->complianceHistory()['data']['total'] === 0, 'S6 site zero does not imply super');
    AdminContext::set($super);
    $exceptions = $rules->save(array_replace($draft, ['id' => $r['id'], 'expectedVersion' => 4, 'exceptionMerchantIds' => [$m]]));
    $rules->save(['id' => $r['id'], 'expectedVersion' => 5, 'note' => 'exception publish'], 'publish');
    rejects(40901, fn () => $service->execute('warn', array_replace($act, ['expectedVersion' => 7, 'requestId' => $request()])), 'S6 explicit exception blocks new enforcement');
    setRequest(['merchantId' => $m]);
    check($ctl->rules()['data']['total'] === 0, 'S6 applicable picker excludes exception');
    $rules->save(['id' => $r['id'], 'expectedVersion' => 6, 'note' => 'withdraw'], 'unpublish');
    // Advance only this isolated scheduled fixture, not the machine clock or application history.
    Db::table('platform_rule_revision')->where('id', $scheduled['revision_id'])->update(['effective_at' => gmdate('Y-m-d H:i:s', time() - 1)]);
    check($rules->effective($r['id']) === null, 'S6 withdrawal supersedes earlier scheduled publish');
    $rules->save(array_replace($draft, ['id' => $r['id'], 'expectedVersion' => 7]));
    $rules->save(['id' => $r['id'], 'expectedVersion' => 8, 'note' => 'republish'], 'publish');
    // Simulate a reached future date in an isolated fixture only; application never updates revisions.
    $r2 = $rules->save($draft); $ruleIds[] = $r2['id'];
    $future = $rules->save(['id' => $r2['id'], 'expectedVersion' => 1, 'note' => 'scheduled', 'effectiveAt' => gmdate('Y-m-d\TH:i:s\Z', time() + 86400)], 'publish');
    Db::table('platform_rule_revision')->where('id', $future['revision_id'])->update(['effective_at' => gmdate('Y-m-d H:i:s', time() - 1)]);
    check($rules->effective($r2['id'])['version'] === 2, 'S6 scheduled rule becomes effective without scheduler');
    // Faults must roll back notification, warning, event, and status together.
    $beforeEvents = Db::table('compliance_history')->where('merchant_id', $m)->count();
    $beforeNotify = Db::table('merchant_notify')->where('merchant_id', $m)->count();
    Db::statement("ALTER TABLE compliance_history ADD CONSTRAINT s6_event_fault CHECK (note <> 'S6 FAIL')"); $fault = 'compliance_history';
    foreach (['warn', 'suspend'] as $action) {
        try { $service->execute($action, array_replace($act, ['expectedVersion' => 7, 'expectedMerchantVersion' => 2, 'confirmed' => true, 'requestId' => $request(), 'note' => 'S6 FAIL'])); throw new RuntimeException('Expected fault'); }
        catch (\Hyperf\Database\Exception\QueryException) {}
        check(Db::table('compliance_history')->where('merchant_id', $m)->count() === $beforeEvents && Db::table('merchant_notify')->where('merchant_id', $m)->count() === $beforeNotify, 'S6 audit fault atomic ' . $action);
        check((int) Db::table('merchant_info')->where('id', $m)->value('status') === 3 && Db::table('merchant_warning')->where('merchant_id', $m)->count() === 1, 'S6 no orphan state/warning ' . $action);
    }
    Db::statement('ALTER TABLE compliance_history DROP CHECK s6_event_fault'); $fault = null;
    Db::statement("ALTER TABLE merchant_notify ADD CONSTRAINT s6_notice_fault CHECK (message NOT LIKE '%S6 NOTICE FAIL%')");
    try {
        try { $service->execute('warn', array_replace($act, ['expectedVersion' => 7, 'requestId' => $request(), 'note' => 'S6 NOTICE FAIL'])); throw new RuntimeException('Expected notification fault'); }
        catch (\Hyperf\Database\Exception\QueryException) {}
        check(Db::table('merchant_warning')->where('merchant_id', $m)->count() === 1 && Db::table('compliance_history')->where('merchant_id', $m)->count() === $beforeEvents, 'S6 notification fault rolls back warning and case event');
    } finally { Db::statement('ALTER TABLE merchant_notify DROP CHECK s6_notice_fault'); }
    Db::statement("ALTER TABLE platform_rule_revision ADD CONSTRAINT s6_rule_fault CHECK (note <> 'S6 RULE FAIL')");
    try {
        try { $rules->save(array_replace($draft, ['id' => $r['id'], 'expectedVersion' => 9, 'note' => 'S6 RULE FAIL', 'body' => 'Must roll back'])); throw new RuntimeException('Expected rule audit fault'); }
        catch (\Hyperf\Database\Exception\QueryException) {}
        check((int) Db::table('platform_rule')->where('id', $r['id'])->value('version') === 9 && $rules->effective($r['id'])['body'] === $draft['body'], 'S6 rule audit failure rolls back draft and version');
    } finally { Db::statement('ALTER TABLE platform_rule_revision DROP CHECK s6_rule_fault'); }
    $workers = [];
    for ($i = 0; $i < 2; $i++) {
        $args = json_encode(['action' => 'resolve', 'input' => array_replace($resolve, ['expectedVersion' => 7, 'requestId' => $request()])]);
        $pipes = []; $process = proc_open([PHP_BINARY, __FILE__, '--execute', $args], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes); $workers[] = [$process, $pipes];
    }
    $outputs = [];
    foreach ($workers as [$process, $pipes]) { $outputs[] = stream_get_contents($pipes[1]); $error = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]); check(proc_close($process) === 0, 'S6 concurrent worker ' . $error); }
    check(count(array_filter($outputs, fn ($x) => str_contains($x, 'S6-WON'))) === 1 && count(array_filter($outputs, fn ($x) => str_contains($x, 'S6-CONFLICT'))) === 1, 'S6 one concurrent case edit wins');
    $legacy = (int) Db::table('merchant_warning')->insertGetId(['merchant_id' => $m, 'site_id' => 991, 'reason' => 'Legacy original']);
    $service->execute('revoke', ['id' => $legacy, 'expectedVersion' => 0, 'requestId' => $request(), 'note' => 'S6 legacy correction']);
    check((int) Db::table('merchant_warning')->where('id', $legacy)->value('status') === 1, 'S6 legacy revocation also append-only');
    setRequest(['merchantId' => $m, 'source' => 'warning_events', 'export' => 1, 'pageSize' => 1]);
    $history = $container->get(MerchantActivityController::class)->history()['data'];
    check($history['total'] === 3 && $history['nextBeforeId'] !== null, 'S6 warning event source export pagination');
    setRequest(['merchantId' => $m, 'category' => 'Booking', 'action' => 'suspend']);
    check($ctl->complianceHistory()['data']['total'] === 1, 'S6 category/action filters');
    setRequest(['id' => $r['id'], 'pageSize' => 1]);
    check($ctl->ruleHistory()['data']['total'] === 9, 'S6 all policy revisions retained');
    // Scope, expiry, legacy compatibility and blacklist bypass checks use only captured fixture IDs.
    rejects(40302, fn () => $rules->save(array_replace($draft, ['siteId' => 991, 'exceptionMerchantIds' => [$foreign]])), 'S6 site exception cannot target another site');
    $siteRule = $rules->save(array_replace($draft, ['siteId' => 991])); $ruleIds[] = $siteRule['id'];
    $rules->save(['id' => $siteRule['id'], 'expectedVersion' => 1, 'note' => 'site publish'], 'publish');
    rejects(40901, fn () => $rules->applicable($siteRule['id'], $service->merchant($foreign)), 'S6 site policy not applicable elsewhere');
    AdminContext::set(['admin_id' => 908, 'site_id' => 992, 'is_super' => false, 'permissions' => ['platform:rule:list']]);
    setRequest(['siteId' => 991, 'pageSize' => 200]);
    check(!in_array($siteRule['id'], array_column($ctl->rules()['data']['list'], 'id')), 'S6 site policy list ignores forged site');
    rejects(40301, fn () => $ctl->ruleHistory(), 'S6 global policy drafts inaccessible by history ID');
    rejects(40301, fn () => $service->execute('record', $record), 'S6 record endpoint requires explicit permission');
    AdminContext::set($super);
    $expired = (int) Db::table('merchant_warning')->insertGetId(['merchant_id' => $m, 'site_id' => 991, 'reason' => 'Expired original', 'expires_at' => gmdate('Y-m-d', time() - 86400)]);
    setRequest(['merchantId' => $m, 'status' => 3]);
    check($ctl->warnings()['data']['total'] === 1 && (int) Db::table('merchant_warning')->where('id', $expired)->value('status') === 1, 'S6 expiration is read projection, not a history rewrite');
    $foreignCase = $service->execute('record', array_replace($record, ['merchantId' => $foreign, 'ruleRevisionId' => $rules->effective($r['id'])['revision_id'], 'requestId' => $request()]));
    $service->execute('suspend', ['id' => $foreignCase['id'], 'expectedVersion' => 1, 'expectedMerchantVersion' => 0, 'confirmed' => true, 'requestId' => $request(), 'note' => 'S6 foreign suspension']);
    $statusService = new \App\Service\MerchantStatusService();
    $statusService->change($foreign, 'blacklist', ['expectedVersion' => 1, 'requestId' => $request(), 'note' => 'S6 blacklist']);
    $foreignRestore = ['id' => $foreignCase['id'], 'expectedVersion' => 2, 'expectedMerchantVersion' => 2, 'confirmed' => true, 'requestId' => $request(), 'note' => 'S6 bypass attempt'];
    rejects(40901, fn () => $service->execute('restore', $foreignRestore), 'S6 compliance cannot bypass active blacklist');
    $statusService->change($foreign, 'unblacklist', ['expectedVersion' => 2, 'requestId' => $request(), 'note' => 'S6 unblacklist']);
    rejects(40901, fn () => $service->execute('restore', array_replace($foreignRestore, ['expectedMerchantVersion' => 3])), 'S6 compliance cannot bypass post-blacklist super reactivation');
    check((int) Db::table('merchant_info')->where('id', $foreign)->value('status') === 4, 'S6 blacklist bypass attempts leave merchant suspended');
    setRequest($record);
    check($ctl->violationRecord()['data']['id'] == $case['id'], 'S6 record controller forwards request and replays');
    setRequest($act);
    check($ctl->warningIssue()['data']['warning_id'] == $warning['warning_id'], 'S6 warning controller forwards case version');
    setRequest($revoke);
    check($ctl->warningRevoke()['data']['warning_id'] == $warning['warning_id'], 'S6 revoke controller preserves idempotency');
    setRequest($resolve + ['action' => 'resolve']);
    check($ctl->violationHandle()['data']['version'] === 6, 'S6 handle controller returns original replay version');
    setRequest(['id' => $siteRule['id'], 'expectedVersion' => 2, 'note' => 'S6 archive legacy endpoint']);
    $ctl->ruleDelete();
    check(Db::table('platform_rule')->where('id', $siteRule['id'])->value('deleted_at') === null && $rules->effective($siteRule['id']) === null, 'S6 legacy delete route only archives and preserves rule history');
} finally {
    if ($fault) Db::statement('ALTER TABLE compliance_history DROP CHECK s6_event_fault');
    $notifications = Db::table('merchant_notify')->whereIn('merchant_id', $merchants)->pluck('id')->all();
    Db::table('merchant_notify_delivery')->whereIn('notify_id', $notifications)->delete();
    foreach (['merchant_notify', 'merchant_status_history', 'merchant_activity_log', 'compliance_history', 'merchant_warning', 'merchant_violation', 'merchant_blacklist'] as $table) Db::table($table)->whereIn('merchant_id', $merchants)->delete();
    Db::table('merchant_info')->whereIn('id', $merchants)->delete();
    Db::table('platform_rule_revision')->whereIn('rule_id', $ruleIds)->delete();
    Db::table('platform_rule')->whereIn('id', $ruleIds)->delete();
}
