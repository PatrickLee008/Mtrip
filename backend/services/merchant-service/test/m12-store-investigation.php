<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\StoreInvestigationController;
use App\Service\StoreInvestigationService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Merchant\MerchantAccessPolicy;

check(class_exists(StoreInvestigationService::class), 'investigation service exists');
$service = new StoreInvestigationService();
$merchant = merchantFixture();
$storeData = ['merchant_id' => $merchant, 'site_id' => 991, 'store_name' => 'Fixture hotel',
    'status' => 1, 'business_type' => 'hotel', 'operating_status' => 1, 'publish_status' => 1,
    'kyc_status' => 1, 'content_status' => 2];
$store = (int) Db::table('merchant_store')->insertGetId($storeData);
$sibling = (int) Db::table('merchant_store')->insertGetId($storeData);
$reporter = ['admin_id' => 908, 'admin_name' => 'Reporter', 'site_id' => 991, 'permissions' => ['merchant:store:flag', 'merchant:investigation:list', 'merchant:investigation:escalate']];
$reviewer = array_replace($reporter, ['admin_id' => 909, 'admin_name' => 'Reviewer', 'permissions' => ['merchant:investigation:review', 'merchant:investigation:list']]);
$flag = ['category' => 'suspected_fraud', 'reason' => 'Bookings require review', 'evidence' => 'Case reference 100'];
AdminContext::set(array_replace($reporter, ['permissions' => []]));
rejects(40301, fn () => $service->flag($store, $flag, ''), 'unprivileged administrator cannot flag');
AdminContext::set(array_replace($reporter, ['site_id' => 992]));
rejects(40302, fn () => $service->flag($store, $flag, ''), 'cannot flag a store from another site');
AdminContext::set($reporter);
rejects(40001, fn () => $service->flag($store, array_replace($flag, ['reason' => ' ']), ''), 'flag requires a reason');
$id = $service->flag($store, $flag, '');
rejects(40901, fn () => $service->flag($store, $flag, ''), 'a store can have only one open case');
check($service->detail($id)['case']['status'] === 'flagged', 'flag is recorded for the selected store');
rejects(40301, fn () => $service->transition($id, 'resolve', ['decision' => 'cleared', 'reason' => 'Done'], ''), 'reporter cannot decide');
$service->transition($id, 'escalate', ['reason' => 'Escalate for review'], '');
check($service->detail($id)['case']['status'] === 'investigating', 'escalation enters the merchant review queue');
rejects(40901, fn () => $service->transition($id, 'escalate', ['reason' => 'Duplicate'], ''), 'case cannot be escalated twice');
setRequest(['storeId' => $store, 'siteId' => 992, 'status' => 'investigating', 'keyword' => 'Fixture']);
$controller = $container->get(StoreInvestigationController::class);
// This CLI fixture can also run before the container regenerates its annotation proxies.
(new ReflectionProperty($controller, 'service'))->setValue($controller, $service);
$queue = $controller->index()['data'];
check($queue['total'] === 1 && (int) $queue['list'][0]->id === $id, 'queue filters and enforces site scope against request override');
check((int) Db::table('merchant_info')->where('id', $merchant)->value('status') === 3
    && (int) Db::table('merchant_store')->where('id', $store)->value('operating_status') === 1
    && (int) Db::table('merchant_store')->where('id', $sibling)->value('operating_status') === 1, 'flag and escalation keep merchant and stores operating');
AdminContext::set($reviewer);
rejects(40301, fn () => $service->transition($id, 'resolve', ['decision' => 'suspend_merchant', 'reason' => 'Confirmed', 'expectedVersion' => 0], ''), 'ordinary reviewer cannot suspend the merchant');
$service->transition($id, 'resolve', ['decision' => 'cleared', 'reason' => 'Insufficient evidence'], '');
$detail = $service->detail($id);
check($detail['case']['status'] === 'resolved' && $detail['case']['decision'] === 'cleared', 'review decision is stored');
check(array_column($detail['history'], 'action') === ['flag', 'escalate', 'resolve'], 'history retains all actions');
check((int) $detail['history'][0]->actor_id === 908 && $detail['history'][0]->evidence === 'Case reference 100'
    && (int) $detail['history'][2]->actor_id === 909 && $detail['history'][2]->reason === 'Insufficient evidence', 'audit captures author, evidence and final reason');
rejects(40901, fn () => $service->transition($id, 'resolve', ['decision' => 'cleared', 'reason' => 'Retry'], ''), 'case cannot be resolved twice');
AdminContext::set(array_replace($reviewer, ['site_id' => 992]));
rejects(40302, fn () => $service->detail($id), 'foreign site cannot view history');
AdminContext::set(array_replace($reviewer, ['is_super' => true, 'site_id' => 0]));
$second = $service->flag($store, array_replace($flag, ['category' => 'serious_violation']), '');
rejects(40901, fn () => $service->transition($second, 'resolve', ['decision' => 'cleared', 'reason' => 'Too early'], ''), 'merchant review requires escalation');
$service->transition($second, 'escalate', ['reason' => 'Investigate confirmed incident'], '');
rejects(40901, fn () => $service->transition($second, 'resolve', ['decision' => 'suspend_merchant', 'reason' => 'Confirmed', 'expectedVersion' => 9], ''), 'stale merchant status leaves the case open');
check($service->detail($second)['case']['status'] === 'investigating', 'failed suspension rolls back the decision');
$service->transition($second, 'resolve', ['decision' => 'suspend_merchant', 'reason' => 'Confirmed violation', 'expectedVersion' => 0], '');
check((int) Db::table('merchant_info')->where('id', $merchant)->value('status') === 4, 'authorized decision suspends the merchant');
check(Db::table('merchant_status_history')->where('merchant_id', $merchant)->where('action', 'suspend')->count() === 1, 'suspension reuses existing status history');
check((int) Db::table('merchant_store')->where('id', $sibling)->value('operating_status') === 1, 'merchant suspension does not rewrite individual store flags');
check(!MerchantAccessPolicy::canBook(4, false) && MerchantAccessPolicy::canAccess(4, false),
    'merchant suspension uses the existing new-booking and access rules');
check(Db::table('merchant_activity_log')->where('merchant_id', $merchant)->where('entity_type', 'store_investigation')->count() === 6,
    'merchant activity contains each investigation event exactly once');
