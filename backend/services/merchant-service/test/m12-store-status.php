<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\StoreController;
use App\Service\PropertyProfileService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Merchant\MerchantAccessGuard;

function storeStatusCall(string $method, array $input): array
{
    global $container;
    setRequest($input);
    return $container->get(StoreController::class)->{$method}()['data'];
}

AdminContext::set(['admin_id' => 907, 'admin_name' => 'Store status tester', 'site_id' => 991, 'is_super' => true]);
Db::beginTransaction();
try {
    $merchant = merchantFixture();
    $fixture = ['merchant_id' => $merchant, 'site_id' => 991, 'store_name' => 'M12 store status fixture',
        'status' => 1, 'business_type' => 'hotel', 'operating_status' => 1, 'publish_status' => 1,
        'kyc_status' => 1, 'content_status' => 2, 'content_approved_version' => 1];
    $store = (int) Db::table('merchant_store')->insertGetId($fixture);
    $sibling = (int) Db::table('merchant_store')->insertGetId($fixture);
    $id = ['id' => $store];
    $pause = $id + ['action' => 'suspend', 'expectedVersion' => 0, 'reason' => 'Platform inspection'];
    $restore = $id + ['action' => 'restore', 'expectedVersion' => 1, 'reason' => 'Inspection cleared'];
    rejects(40001, fn () => storeStatusCall('toggleStatus', $id), 'store status requires an explicit action and reason');
    rejects(40001, fn () => storeStatusCall('toggleStatus', array_replace($pause, ['reason' => '  '])), 'store status requires a nonblank reason');
    AdminContext::set(['admin_id' => 908, 'site_id' => 991, 'permissions' => ['merchant:store:status']]);
    rejects(40301, fn () => storeStatusCall('toggleStatus', $pause), 'store suspension is limited to super administrators');
    AdminContext::set(['admin_id' => 907, 'admin_name' => 'Store status tester', 'site_id' => 992, 'is_super' => true]);
    rejects(40302, fn () => storeStatusCall('toggleStatus', $pause), 'site-scoped administrator cannot suspend a foreign store');
    rejects(40302, fn () => storeStatusCall('statusHistory', $id), 'site-scoped administrator cannot read foreign store status history');
    AdminContext::set(['admin_id' => 907, 'admin_name' => 'Store status tester', 'site_id' => 991, 'is_super' => true]);
    storeStatusCall('toggleStatus', $pause);
    $row = Db::table('merchant_store')->where('id', $store)->first();
    check((int) $row->operating_status === 3 && (int) $row->status === 1 && (int) $row->publish_status === 1,
        'platform suspension preserves account access and publication flags');
    check((int) Db::table('merchant_store')->where('id', $sibling)->value('operating_status') === 1
        && (int) Db::table('merchant_info')->where('id', $merchant)->value('status') === 3, 'store suspension affects only the selected store');
    MerchantAccessGuard::assertSubject(['account_type' => 3, 'site_id' => 991, 'merchant_id' => $merchant, 'store_id' => $store]);
    check(true, 'a suspended store still passes the store account access check');
    $paused = storeStatusCall('index', ['merchantId' => $merchant, 'status' => 3]);
    check($paused['total'] === 1 && (int) $paused['list'][0]['id'] === $store, 'store list can filter platform suspensions');
    rejects(40901, fn () => storeStatusCall('toggleStatus', $pause), 'stale repeat cannot create a second suspension');
    MerchantContext::set(['site_id' => 991, 'merchant_id' => $merchant, 'account_type' => 2, 'is_owner' => true]);
    rejects(40901, fn () => $container->get(PropertyProfileService::class)->publish($store, true), 'merchant publication cannot lift platform suspension');
    storeStatusCall('toggleStatus', $restore);
    $history = storeStatusCall('statusHistory', $id);
    check($history['total'] === 2 && array_column($history['list'], 'action') === ['restore', 'suspend'], 'history records both transitions in order');
    $first = $history['list'][1];
    check((int) $first['store_id'] === $store && (int) $first['actor_id'] === 907
        && $first['reason'] === 'Platform inspection' && $first['effective_at'] !== null, 'store history records scope, actor, reason and effective time');
    check((int) Db::table('merchant_store')->where('id', $store)->value('operating_status') === 1, 'restore returns an operating store to service');
    $closed = (int) Db::table('merchant_store')->insertGetId(array_replace($fixture, ['operating_status' => 2, 'publish_status' => 2]));
    storeStatusCall('toggleStatus', array_replace($pause, ['id' => $closed]));
    storeStatusCall('toggleStatus', array_replace($restore, ['id' => $closed]));
    $row = Db::table('merchant_store')->where('id', $closed)->first();
    check((int) $row->operating_status === 2 && (int) $row->publish_status === 2, 'restore preserves a previously closed and unpublished store');
} finally {
    Db::rollBack();
}
