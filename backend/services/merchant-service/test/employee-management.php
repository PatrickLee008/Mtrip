<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Merchant\AccountController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Merchant\MerchantAccessGuard;

$merchant = merchantFixture();
$otherMerchant = merchantFixture();
Db::table('merchant_info')->where('id', $merchant)->update(['sub_account_limit' => 50]);
$owner = (int) Db::table('merchant_admin')->insertGetId([
    'site_id' => 991, 'account_type' => 2, 'merchant_id' => $merchant,
    'username' => 'employee-owner', 'password' => password_hash('Fixture123', PASSWORD_BCRYPT), 'is_owner' => 1,
]);
$context = ['site_id' => 991, 'admin_id' => $owner, 'admin_name' => 'Employee QA', 'account_type' => 2,
    'merchant_id' => $merchant, 'group_id' => 0, 'store_id' => 0, 'is_owner' => true];
$permissions = ['mch:account:add', 'mch:account:delete', 'mch:role:grant'];
function employeeContext(array $changes = [], ?array $perms = null): void
{
    global $context, $permissions;
    $current = array_replace($context, $changes, ['permissions' => $perms ?? $permissions]);
    MerchantContext::set($current);
    AdminContext::set(['admin_id' => $current['admin_id'], 'site_id' => $current['site_id'],
        'is_super' => false, 'permissions' => $perms ?? $permissions]);
}
function employeeCall(string $method, array $input = []): mixed
{
    global $container;
    setRequest($input);
    return $container->get(AccountController::class)->$method()['data'];
}
function employeeRole(array $changes = []): int
{
    global $merchant;
    return (int) Db::table('merchant_role')->insertGetId(array_replace([
        'site_id' => 991, 'account_type' => 2, 'merchant_id' => $merchant,
        'role_name' => 'Employee role', 'role_code' => bin2hex(random_bytes(5)), 'is_builtin' => 0, 'status' => 1,
    ], $changes));
}
function createEmployee(string $username, array $roleIds = []): int
{
    return employeeCall('create', ['username' => $username, 'password' => 'Fixture123', 'roleIds' => $roleIds])['id'];
}

employeeContext();
$role = employeeRole();
$builtin = employeeRole(['site_id' => 0, 'merchant_id' => 0, 'is_builtin' => 1]);
$employee = createEmployee('employee-with-roles', [$role, $builtin, $role]);
$assigned = Db::table('merchant_admin_role')->where('admin_id', $employee)->pluck('role_id')->map(fn ($id) => (int) $id)->all();
sort($assigned);
$expected = [$role, $builtin]; sort($expected);
check($assigned === $expected, 'creation persists selected built-in/custom roles without duplicates');
check((int) Db::table('merchant_admin')->where('id', $employee)->value('is_owner') === 0, 'new employee never becomes owner');
$withoutRoles = createEmployee('employee-without-roles');
check(! Db::table('merchant_admin_role')->where('admin_id', $withoutRoles)->exists(), 'legacy creation without roles stays supported');

$invalidRoles = [
    'foreign merchant' => employeeRole(['merchant_id' => $otherMerchant]),
    'foreign site' => employeeRole(['site_id' => 992]),
    'wrong account type' => employeeRole(['account_type' => 1]),
    'disabled role' => employeeRole(['status' => 2]),
    'deleted role' => employeeRole(['deleted_at' => date('Y-m-d H:i:s')]),
];
foreach ($invalidRoles as $name => $invalidRole) {
    $before = Db::table('merchant_admin')->count();
    rejects(40302, fn () => createEmployee('invalid-' . $invalidRole, [$role, $invalidRole]), $name . ' rejected');
    check(Db::table('merchant_admin')->count() === $before, $name . ' leaves no partial account');
}
employeeContext(['is_owner' => false], ['mch:account:add']);
rejects(40301, fn () => createEmployee('grant-denied', [$role]), 'create permission does not imply role grant');
employeeContext(['is_owner' => false], []);
rejects(40301, fn () => createEmployee('create-denied'), 'create permission enforced by AOP');
employeeContext();

$before = [Db::table('merchant_admin')->count(), Db::table('merchant_admin_role')->count()];
Db::statement('RENAME TABLE merchant_activity_log TO employee_audit_fixture');
try {
    createEmployee('rollback-employee', [$role]);
    throw new RuntimeException('Expected audit failure');
} catch (\Hyperf\Database\Exception\QueryException $e) {
    check([Db::table('merchant_admin')->count(), Db::table('merchant_admin_role')->count()] === $before, 'audit failure rolls back both account and roles');
} finally {
    Db::statement('RENAME TABLE employee_audit_fixture TO merchant_activity_log');
}

rejects(40901, fn () => employeeCall('remove', ['id' => $owner]), 'owner cannot be deleted');
employeeContext(['admin_id' => $employee, 'is_owner' => false]);
rejects(40901, fn () => employeeCall('remove', ['id' => $employee]), 'current employee cannot delete self');
employeeContext(['merchant_id' => $otherMerchant]);
rejects(40401, fn () => employeeCall('remove', ['id' => $employee]), 'foreign merchant account cannot be deleted');
employeeContext(['site_id' => 992]);
rejects(40401, fn () => employeeCall('remove', ['id' => $employee]), 'foreign site account cannot be deleted');
employeeContext(['is_owner' => false], ['mch:account:add']);
rejects(40301, fn () => employeeCall('remove', ['id' => $employee]), 'delete permission enforced by AOP');
employeeContext();

Db::table('merchant_employee_property')->insert(['site_id' => 991, 'admin_id' => $employee, 'property_id' => 99101, 'created_by' => $owner]);
$account = (array) Db::table('merchant_admin')->where('id', $employee)->first();
$claims = array_merge($account, ['amr' => 'totp', 'admin_id' => $employee]);
MerchantAccessGuard::assertSession($claims);
$used = employeeCall('quota')['used'];
employeeCall('remove', ['id' => $employee]);
$removed = Db::table('merchant_admin')->where('id', $employee)->first();
check($removed !== null && $removed->deleted_at !== null && (int) $removed->status === 2, 'delete preserves account as disabled soft-deleted history');
check((int) $removed->auth_version === (int) $account['auth_version'] + 1, 'delete invalidates authentication version');
check(! Db::table('merchant_admin_role')->where('admin_id', $employee)->exists()
    && ! Db::table('merchant_employee_property')->where('admin_id', $employee)->exists(), 'delete revokes role/property grants');
check(employeeCall('quota')['used'] === $used - 1, 'deleted employee releases quota');
$listed = employeeCall('index')['list'];
check(! in_array($employee, array_column($listed, 'id'), true), 'deleted employee disappears from list');
rejects(40301, fn () => MerchantAccessGuard::assertSession($claims), 'deleted employee session rejected immediately');
rejects(40401, fn () => employeeCall('remove', ['id' => $employee]), 'repeated delete does not mutate historical account');
check(Db::table('merchant_activity_log')->where('target_account_id', $employee)->where('description', 'like', '%: deleted')->exists(), 'delete records account audit');
check(Db::table('merchant_menu')->where('perm_key', 'mch:account:delete')->count() === 1, 'delete permission migration is idempotent');

echo "Employee management integration complete\n";
