<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\Merchant\MerchantAuthService;
use Hyperf\DbConnection\Db;
use Hyperf\HttpMessage\Server\Request;
use Hyperf\HttpMessage\Server\Response;
use Hyperf\HttpMessage\Stream\SwooleStream;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Middleware\MerchantAuthMiddleware;
use Mtrip\Shared\Support\JwtHelper;

$merchantIds = $propertyIds = $accountIds = [];
$groupId = 0;

function scopeAccount(int $siteId, int $type, int $merchantId, int $groupId, int $storeId, bool $owner): int
{
    global $accountIds;
    return $accountIds[] = (int) Db::table('merchant_admin')->insertGetId([
        'site_id' => $siteId, 'account_type' => $type, 'merchant_id' => $merchantId,
        'group_id' => $groupId, 'store_id' => $storeId,
        'username' => 'property-scope-' . bin2hex(random_bytes(6)),
        'password' => password_hash('PropertyScope123', PASSWORD_BCRYPT),
        'real_name' => 'Property Scope Tester', 'is_owner' => $owner ? 1 : 0,
        'two_fa_status' => 1, 'status' => 1,
    ]);
}

function scopeToken(int $adminId, array $permissions = []): string
{
    global $config;
    $account = (array) Db::table('merchant_admin')->where('id', $adminId)->first();
    return JwtHelper::issue([
        'admin_id' => $adminId, 'admin_name' => $account['real_name'], 'site_id' => (int) $account['site_id'],
        'aud' => 'merchant', 'account_type' => (int) $account['account_type'],
        'group_id' => (int) $account['group_id'], 'merchant_id' => (int) $account['merchant_id'],
        'store_id' => (int) $account['store_id'], 'is_owner' => (int) $account['is_owner'] === 1,
        'permissions' => $permissions, 'auth_version' => (int) $account['auth_version'], 'amr' => 'totp',
    ], (string) $config->get('mtrip.jwt_secret'), 600);
}

function scopedRequest(string $token, ?string $propertyHeader = null, string $path = '/api/v1/merchant/properties/list'): array
{
    global $config;
    $request = (new Request('GET', $path))->withHeader('Authorization', 'Bearer ' . $token);
    if ($propertyHeader !== null) $request = $request->withHeader('X-Mtrip-Property-Id', $propertyHeader);
    $handler = new class implements Psr\Http\Server\RequestHandlerInterface {
        public function handle(Psr\Http\Message\ServerRequestInterface $request): Psr\Http\Message\ResponseInterface
        {
            return (new Response())->withBody(new SwooleStream(json_encode(MerchantContext::get())));
        }
    };
    $response = (new MerchantAuthMiddleware($config))->process($request, $handler);
    return (array) json_decode((string) $response->getBody(), true);
}

try {
    $groupId = (int) Db::table('merchant_group')->insertGetId([
        'site_id' => 991, 'group_name' => 'Property Scope Group', 'contact_name' => 'Tester',
        'contact_phone' => '', 'status' => 1,
    ]);
    $merchantA = $merchantIds[] = merchantFixture(991);
    $merchantB = $merchantIds[] = merchantFixture(991);
    Db::table('merchant_info')->whereIn('id', [$merchantA, $merchantB])->update(['group_id' => $groupId]);
    $propertyA = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchantA, 'store_name' => 'Scope Property A',
        'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
    ]);
    $propertyB = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchantA, 'store_name' => 'Scope Property B',
        'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
    ]);
    $propertyC = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchantB, 'store_name' => 'Scope Property C',
        'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
    ]);

    $owner = scopeAccount(991, 2, $merchantA, 0, 0, true);
    $employee = scopeAccount(991, 2, $merchantA, 0, 0, false);
    $propertyAccount = scopeAccount(991, 3, $merchantA, 0, $propertyB, true);
    $groupOwner = scopeAccount(991, 1, 0, $groupId, 0, true);
    $groupEmployee = scopeAccount(991, 1, 0, $groupId, 0, false);
    Db::table('merchant_employee_property')->insert([
        ['site_id' => 991, 'admin_id' => $employee, 'property_id' => $propertyA, 'created_by' => $owner],
        ['site_id' => 991, 'admin_id' => $groupEmployee, 'property_id' => $propertyC, 'created_by' => $groupOwner],
    ]);

    $ownerContext = scopedRequest(scopeToken($owner));
    check($ownerContext['property_ids'] === [$propertyA, $propertyB], 'D merchant owner receives all merchant properties');
    $employeeContext = scopedRequest(scopeToken($employee));
    check($employeeContext['property_ids'] === [$propertyA] && $employeeContext['selected_property_id'] === 0,
        'D employee all-properties view contains only explicit assignments');
    $selected = scopedRequest(scopeToken($employee), (string) $propertyA);
    check($selected['selected_property_id'] === $propertyA, 'D valid property header selects assigned property');
    rejects(40302, fn () => scopedRequest(scopeToken($employee), (string) $propertyB), 'D forged unassigned property header denied');
    rejects(40001, fn () => scopedRequest(scopeToken($employee), 'abc'), 'D malformed property header denied');

    MerchantContext::set($employeeContext);
    rejects(40901, fn () => MerchantContext::assertPropertyAccess($propertyA, true), 'D single-property write rejects all-properties context');
    MerchantContext::set($selected);
    MerchantContext::assertPropertyAccess($propertyA, true);
    check(MerchantContext::scopePropertyIds() === [$propertyA], 'D selected property narrows downstream query scope');

    $propertyContext = scopedRequest(scopeToken($propertyAccount), (string) $propertyB);
    check($propertyContext['property_ids'] === [$propertyB], 'D property account is fixed to its own property');
    rejects(40302, fn () => scopedRequest(scopeToken($propertyAccount), (string) $propertyA), 'D property account cannot switch property');
    check(scopedRequest(scopeToken($groupOwner))['property_ids'] === [$propertyA, $propertyB, $propertyC],
        'D group owner aggregates properties across group merchants');
    check(scopedRequest(scopeToken($groupEmployee))['property_ids'] === [$propertyC],
        'D group employee sees only assigned group properties');

    $menuContext = scopedRequest(scopeToken($employee), (string) $propertyB, '/api/v1/merchant/auth/menus');
    check($menuContext['selected_property_id'] === 0 && $menuContext['property_ids'] === [$propertyA],
        'D menu bootstrap ignores stale selected property context');

    MerchantContext::set(scopedRequest(scopeToken($owner), (string) $propertyA));
    $switcher = (new MerchantAuthService())->menus($owner, 2, true, $merchantA, [$merchantA], null)['businesses'];
    check(array_column($switcher, 'id') === [$propertyA, $propertyB],
        'D switcher returns all authorized property IDs in selected context');
} finally {
    if ($accountIds) Db::table('merchant_employee_property')->whereIn('admin_id', $accountIds)->delete();
    if ($accountIds) Db::table('merchant_admin')->whereIn('id', $accountIds)->delete();
    if ($propertyIds) Db::table('merchant_store')->whereIn('id', $propertyIds)->delete();
    if ($merchantIds) Db::table('merchant_info')->whereIn('id', $merchantIds)->delete();
    if ($groupId > 0) Db::table('merchant_group')->where('id', $groupId)->delete();
}

echo "Property scope integration complete\n";
