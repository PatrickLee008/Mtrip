<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\MerchantStatusService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
use Mtrip\Shared\Support\JwtHelper;

$service = new MerchantStatusService();
if (($argv[1] ?? '') === '--expire') {
    $service->expireDue();
    exit(0);
}
function actor(bool $super = true, int $site = 991, array $permissions = []): void
{
    AdminContext::set(['admin_id' => 901, 'admin_name' => 'M12 Tester', 'site_id' => $site, 'is_super' => $super, 'permissions' => $permissions]);
}
function command(int $id, string $note = 'M12 test'): array
{
    return ['note' => $note, 'requestId' => 'test-' . bin2hex(random_bytes(8)), 'expectedVersion' => (int) Db::table('merchant_info')->where('id', $id)->value('status_version')];
}
$ids = [];
$triggers = [];
$groupId = 0;
try {
    actor();
    $id = $ids[] = merchantFixture();
    $goodsId = Db::table('goods_info')->insertGetId(['site_id' => 991, 'merchant_id' => $id, 'goods_name' => 'M12 fixture', 'status' => 3]);
    $cmd = command($id);
    $cmd['suspendedUntil'] = gmdate('Y-m-d\TH:i:s\Z', time() + 3600);
    $result = $service->change($id, 'suspend', $cmd);
    check($result['status'] === 4 && $result['statusVersion'] === 1, 'T01 suspension + version');
    foreach (['merchant_status_history', 'merchant_activity_log', 'merchant_notify'] as $table) {
        check(Db::table($table)->where('merchant_id', $id)->count() === 1, 'T01 atomic event ' . $table);
    }
    check($service->change($id, 'suspend', $cmd) == $result && Db::table('merchant_status_history')->where('merchant_id', $id)->count() === 1, 'T04 retry returns original result (JSON object key order ignored)');
    rejects(40901, fn () => $service->change($id, 'suspend', array_replace($cmd, ['note' => 'changed'])), 'T05 conflicting requestId');
    rejects(40901, fn () => $service->change($id, 'activate', array_replace(command($id), ['expectedVersion' => 0])), 'T03 stale version');
    foreach (['suspend', 'activate', 'blacklist', 'unblacklist', 'reactivate'] as $action) {
        rejects(40001, fn () => $service->change($id, $action, array_replace(command($id), ['note' => ' '])), 'T02 missing note ' . $action);
    }
    actor(false, 992, ['merchant:status:activate']);
    rejects(40302, fn () => $service->change($id, 'activate', command($id)), 'T07 cross-site');
    actor(false, 991, ['merchant:status:blacklist', 'merchant:status:unblacklist']);
    foreach (['blacklist', 'unblacklist'] as $action) {
        rejects(40301, fn () => $service->change($id, $action, command($id)), 'T06 privileged action ' . $action);
    }
    actor();
    $service->change($id, 'blacklist', command($id));
    check(Db::table('merchant_info')->where('id', $id)->value('active_suspension_id') === null, 'T08 blacklist clears expiry instance');
    $service->change($id, 'unblacklist', command($id));
    check((int) Db::table('merchant_info')->where('id', $id)->value('status') === 4, 'T09 unblacklist remains suspended');
    actor(false, 991, ['merchant:status:activate']);
    rejects(40301, fn () => $service->change($id, 'activate', command($id)), 'T10 ordinary activation cannot bypass reactivation');
    actor();
    $service->expireDue();
    check((int) Db::table('merchant_info')->where('id', $id)->value('status') === 4, 'T14 old expiry cannot restore after unblacklist');
    $service->change($id, 'reactivate', command($id));
    check((int) Db::table('merchant_info')->where('id', $id)->value('status') === 3, 'T11 separate super reactivation');
    check((int) Db::table('goods_info')->where('id', $goodsId)->value('status') === 3, 'T36 no goods off-shelf side effect');
    foreach ([0, 1, 2, 5, 6] as $status) {
        $invalidId = $ids[] = merchantFixture(991, $status);
        rejects(40901, fn () => $service->change($invalidId, 'activate', command($invalidId)), 'T12 invalid operating state ' . $status);
    }
    foreach (['2020-01-01T00:00:00Z', '2035-01-01 00:00:00', '2035-02-30T00:00:00Z'] as $date) {
        rejects(40001, fn () => $service->change($id, 'suspend', array_replace(command($id), ['suspendedUntil' => $date])), 'T16 invalid deadline');
    }
    $service->change($id, 'suspend', array_replace(command($id), ['suspendedUntil' => gmdate('Y-m-d\TH:i:s\Z', time() + 3600)]));
    Db::table('merchant_info')->where('id', $id)->update(['suspended_until' => gmdate('Y-m-d H:i:s', time() - 1)]);
    $before = Db::table('merchant_status_history')->where('merchant_id', $id)->count();
    $workers = [];
    for ($i = 0; $i < 2; ++$i) {
        $workers[] = proc_open([PHP_BINARY, __FILE__, '--expire'], [0 => ['pipe', 'r'], 1 => STDOUT, 2 => STDERR], $pipes);
        fclose($pipes[0]);
    }
    foreach ($workers as $worker) check(proc_close($worker) === 0, 'T15 expiry worker completed');
    check((int) Db::table('merchant_info')->where('id', $id)->value('status') === 3
        && Db::table('merchant_status_history')->where('merchant_id', $id)->count() === $before + 1, 'T13/T15 one recovery event across two processes');
    foreach (['merchant_status_history', 'merchant_notify'] as $table) {
        $constraint = 'm12_fault_' . bin2hex(random_bytes(4));
        $column = $table === 'merchant_status_history' ? 'note' : 'message';
        $value = $table === 'merchant_status_history' ? 'M12 fault' : 'suspend: M12 fault';
        Db::unprepared("ALTER TABLE {$table} ADD CONSTRAINT {$constraint} CHECK ({$column} <> '{$value}')");
        $triggers[] = [$table, $constraint];
        $before = Db::table('merchant_status_history')->where('merchant_id', $id)->count();
        try { $service->change($id, 'suspend', command($id, 'M12 fault')); throw new RuntimeException('Expected database failure'); }
        catch (\Hyperf\Database\Exception\QueryException $e) {
            check((int) Db::table('merchant_info')->where('id', $id)->value('status') === 3
                && Db::table('merchant_status_history')->where('merchant_id', $id)->count() === $before, 'T31 rollback on ' . $table . ' failure');
        }
        Db::unprepared("ALTER TABLE {$table} DROP CHECK {$constraint}");
        array_pop($triggers);
    }
    $accountId = Db::table('merchant_admin')->insertGetId(['site_id' => 991, 'merchant_id' => $id, 'username' => 'm12-' . bin2hex(random_bytes(5)),
        'password' => password_hash('M12-Only-Test-Password', PASSWORD_BCRYPT), 'account_type' => 2, 'is_owner' => 1, 'status' => 1]);
    $account = (array) Db::table('merchant_admin')->where('id', $accountId)->first();
    $alias = 'M12-ACCESS-' . $id;
    Db::table('merchant_info')->where('id', $id)->update(['access_code' => $alias]);
    $service->change($id, 'suspend', command($id));
    $auth = new App\Service\Merchant\MerchantAuthService();
    foreach ([$account['username'], $alias] as $username) {
        $login = $auth->login($username, 'M12-Only-Test-Password', '127.0.0.1');
        check($login['admin']['bookingRestricted'] === true, 'T24/T29 suspended login including access_status=0');
    }
    $claims = JwtHelper::verify($login['token'], (string) $config->get('mtrip.jwt_secret'));
    MerchantAccessGuard::assertSession($claims);
    $service->change($id, 'blacklist', command($id));
    rejects(40301, fn () => $auth->login($account['username'], 'M12-Only-Test-Password', '127.0.0.1'), 'T25 blacklist login');
    rejects(40301, fn () => MerchantAccessGuard::assertSession($claims), 'T25 existing JWT denied');
    $groupId = (int) Db::table('merchant_group')->insertGetId(['site_id' => 991, 'group_name' => 'M12 Test Group', 'contact_name' => 'Fixture', 'contact_phone' => '']);
    $visibleId = $ids[] = merchantFixture();
    Db::table('merchant_info')->whereIn('id', [$id, $visibleId])->update(['group_id' => $groupId]);
    MerchantContext::set(['site_id' => 991, 'account_type' => 1, 'group_id' => $groupId]);
    check(MerchantContext::scopeMerchantIds() === [$visibleId], 'T27 group excludes blacklisted merchants');
    $service->change($id, 'unblacklist', command($id));
    $service->change($id, 'reactivate', command($id));
    Db::table('merchant_admin')->where('id', $accountId)->update(['status' => 2]);
    rejects(40301, fn () => MerchantAccessGuard::assertSession($claims), 'T26 account disabled');
    Db::table('merchant_admin')->where('id', $accountId)->update(['status' => 1, 'deleted_at' => gmdate('Y-m-d H:i:s')]);
    rejects(40301, fn () => MerchantAccessGuard::assertSession($claims), 'T26 account deleted');
    foreach (['suspend', 'activate', 'toggleStatus'] as $method) {
        actor();
        setRequest(array_replace(command($id), ['id' => $id]));
        $response = $container->get(App\Controller\MerchantController::class)->{$method}();
        check($response['code'] === 0, 'T30 legacy controller delegates ' . $method);
    }
    foreach (['blacklist', 'unblacklist'] as $method) {
        actor();
        setRequest(array_replace(command($id), ['id' => $id]));
        check($container->get(App\Controller\VerifyController::class)->{$method}()['code'] === 0, 'T30 legacy verify delegates ' . $method);
    }
    actor(false, 991, ['merchant:status:activate', 'merchant:status:suspend', 'merchant:status:reactivate']);
    setRequest(array_replace(command($id), ['id' => $id]));
    rejects(40301, fn () => $container->get(App\Controller\MerchantController::class)->toggleStatus(), 'T30 toggle cannot bypass super reactivation');
    actor(false, 992, ['merchant:status:history']);
    setRequest(['id' => $id]);
    rejects(40302, fn () => $container->get(App\Controller\MerchantController::class)->statusHistory(), 'T07 history cross-site');
    actor();
    $service->change($id, 'reactivate', command($id));
    $before = Db::table('merchant_status_history')->where('merchant_id', $id)->count();
    $constraint = 'm12_sys_fault_' . bin2hex(random_bytes(4));
    Db::connection('system')->unprepared("ALTER TABLE sys_operation_log ADD CONSTRAINT {$constraint} CHECK (admin_id <> 901)");
    $triggers[] = ['sys_operation_log', $constraint];
    $handler = new class($id) implements Psr\Http\Server\RequestHandlerInterface {
        public function __construct(private int $id) {}
        public function handle(Psr\Http\Message\ServerRequestInterface $request): Psr\Http\Message\ResponseInterface
        {
            (new MerchantStatusService())->change($this->id, 'suspend', command($this->id));
            return new Hyperf\HttpMessage\Server\Response();
        }
    };
    (new Mtrip\Shared\Middleware\OperationLogMiddleware())->process(new Hyperf\HttpMessage\Server\Request('POST', '/api/v1/admin/merchant/suspend'), $handler);
    check(Db::table('merchant_status_history')->where('merchant_id', $id)->count() === $before + 1, 'T32 cross-connection audit failure preserves strong business audit and emits warning');
    Db::connection('system')->unprepared("ALTER TABLE sys_operation_log DROP CHECK {$constraint}");
    array_pop($triggers);
    MerchantContext::set(['site_id' => 991, 'account_type' => 3, 'merchant_id' => $id, 'store_id' => 1]);
    check(MerchantContext::scopeMerchantIds() === [-1], 'T28 store never inherits merchant-wide goods/order/finance scope');
    MerchantContext::set(['site_id' => 991, 'account_type' => 1, 'group_id' => 0]);
    check(MerchantContext::scopeMerchantIds() === [-1], 'T27 empty group scope never falls back to merchant_id=0');
    echo "M12 STATUS INTEGRATION PASSED\n";
} finally {
    foreach ($triggers as [$table, $constraint]) Db::unprepared("ALTER TABLE {$table} DROP CHECK {$constraint}");
    foreach (['merchant_notify', 'merchant_activity_log', 'merchant_status_history', 'merchant_blacklist', 'merchant_admin', 'goods_info'] as $table) {
        Db::table($table)->whereIn('merchant_id', $ids)->delete();
    }
    Db::table('merchant_info')->whereIn('id', $ids)->delete();
    if ($groupId > 0) Db::table('merchant_group')->where('id', $groupId)->delete();
}
