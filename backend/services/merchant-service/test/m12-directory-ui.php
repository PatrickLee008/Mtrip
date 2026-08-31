<?php
declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\MerchantController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;

$directory = $container->get(MerchantController::class);
function directoryCall(string $method, array $params = []): array {
    global $directory;
    setRequest($params);
    return $directory->$method();
}
AdminContext::set(['admin_id' => 902, 'admin_name' => 'Directory tester', 'site_id' => 991, 'is_super' => true]);
Db::beginTransaction();
try {
    $prefix = 'Directory-UI-' . bin2hex(random_bytes(5));
    $ids = [];
    foreach ([3, 4, 0, 6, 2, 5] as $status) {
        $id = $ids[$status] = merchantFixture(991, $status);
        Db::table('merchant_info')->where('id', $id)->update(['merchant_name' => $prefix . '-' . $status]);
    }
    $foreign = merchantFixture(992);
    Db::table('merchant_info')->where('id', $foreign)->update(['merchant_name' => $prefix . '-foreign']);
    $blocked = merchantFixture(991, 4);
    Db::table('merchant_info')->where('id', $blocked)->update(['merchant_name' => $prefix . '-blocked']);
    Db::table('merchant_blacklist')->insert(['merchant_id' => $blocked, 'site_id' => 991, 'reason' => 'Synthetic UI test', 'status' => 1]);
    $app = Db::table('merchant_application')->insertGetId([
        'merchant_id' => $ids[3], 'site_id' => 991, 'app_no' => $prefix, 'company_name' => $prefix,
        'business_types' => 'hotel,restaurant',
    ]);
    foreach (['hotel', 'hotel', 'restaurant'] as $type) {
        Db::table('merchant_application_business')->insert([
            'application_id' => $app, 'site_id' => 991, 'business_name' => $prefix, 'business_type' => $type,
        ]);
    }
    // Invalid cross-site business must neither display nor match the type filter.
    Db::table('merchant_application_business')->insert([
        'application_id' => $app, 'site_id' => 992, 'business_name' => $prefix, 'business_type' => 'airline',
    ]);
    $filter = ['keyword' => $prefix, 'siteId' => 991];
    foreach ([[991, '2026-08-01 10:00:00'], [991, '2026-08-02 11:00:00'], [992, '2026-08-03 12:00:00']] as $index => [$site, $login]) {
        Db::table('merchant_admin')->insert([
            'merchant_id' => $ids[3], 'site_id' => $site, 'username' => $prefix . $index,
            'password' => 'synthetic-not-a-login-hash', 'last_login_at' => $login,
        ]);
    }
    $all = directoryCall('index', $filter)['data'];
    check($all['total'] === 7, 'directory scoped total without duplicate businesses');
    check($all['stats'] === ['total' => 7, 'active' => 1, 'suspended' => 1, 'blacklisted' => 1], 'directory mutually exclusive account cards');
    $active = directoryCall('index', $filter + ['status' => '3', 'pageSize' => 1])['data'];
    check($active['total'] === 1 && $active['stats'] === $all['stats'], 'directory cards independent of selected status and pagination');
    $row = $active['list'][0];
    check($row['business_types'] === ['hotel', 'restaurant'], 'directory multi-business type de-duplicated from application');
    check($row['commission_plan'] === null, 'directory unknown legacy plan is not guessed');
    check($row['last_login_at'] === '2026-08-02 11:00:00', 'directory latest successful account login excludes foreign site');
    check($row['verification_status'] === 'approved' && $row['account_status'] === 'active', 'directory independent approved and active states');
    $suspended = directoryCall('index', $filter + ['status' => '4'])['data']['list'][0];
    check($suspended['verification_status'] === 'approved' && $suspended['account_status'] === 'suspended', 'directory suspension does not reject verification');
    $blacklisted = directoryCall('index', $filter + ['status' => 'blacklisted'])['data']['list'][0];
    check($blacklisted['account_status'] === 'blacklisted' && $blacklisted['verification_status'] === 'approved', 'directory blacklist overlays account only');
    foreach ([0 => 'pending', 6 => 'resubmission', 2 => 'rejected'] as $status => $verification) {
        $row = directoryCall('index', $filter + ['status' => (string) $status])['data']['list'][0];
        check($row['verification_status'] === $verification && $row['account_status'] === 'inactive', 'directory verification ' . $verification);
    }
    $restaurant = directoryCall('index', $filter + ['category' => 'restaurant'])['data'];
    check($restaurant['total'] === 1 && $restaurant['list'][0]['business_types'] === ['hotel', 'restaurant'], 'directory restaurant lookup without enabling restaurant operations');
    check(directoryCall('index', $filter + ['category' => 'airline'])['data']['total'] === 0, 'directory excludes foreign business types');
    $profile = directoryCall('detail', ['id' => $ids[3]])['data']['merchant'];
    check($profile['business_types'] === ['hotel', 'restaurant'] && $profile['commission_plan'] === null, 'directory profile matches list fields');
    check($profile['last_login_at'] === '2026-08-02 11:00:00', 'directory profile and list use same last login');
    Db::table('merchant_info')->where('id', $ids[3])->update(['remark' => 'Preserve existing note']);
    check(directoryCall('detail', ['id' => $ids[3]])['data']['merchant']['remark'] === 'Preserve existing note', 'directory drawer editing receives existing remark');
    foreach (['vip', 'premium', 'standard'] as $plan) {
        directoryCall('commission', ['id' => $ids[3], 'commissionPlan' => $plan, 'commissionRate' => 12.5, 'settlementCycle' => 15]);
        $saved = directoryCall('detail', ['id' => $ids[3]])['data']['merchant'];
        check($saved['commission_plan'] === $plan && (float) $saved['commission_rate'] === 12.5, 'directory saves independent plan ' . $plan);
    }
    rejects(40001, fn () => directoryCall('commission', ['id' => $ids[3], 'commissionPlan' => 'invalid', 'commissionRate' => 12.5]), 'directory rejects invalid plan');
    directoryCall('commission', ['id' => $ids[4], 'commissionRate' => 10]);
    check(Db::table('merchant_info')->where('id', $ids[4])->value('commission_plan') === null, 'directory old rate-only API preserves unset plan');
    $credit = (string) Db::table('merchant_info')->where('id', $ids[3])->value('credit_code');
    check(directoryCall('index', ['keyword' => $credit])['data']['total'] === 1, 'directory registration search');
    AdminContext::set(['admin_id' => 902, 'site_id' => 991, 'is_super' => false, 'permissions' => ['merchant:list:list']]);
    check(directoryCall('index', ['keyword' => $prefix, 'siteId' => 992])['data']['stats']['total'] === 7, 'directory forged site cannot affect card scope');
    rejects(40301, fn () => directoryCall('commission', ['id' => $ids[3], 'commissionPlan' => 'vip', 'commissionRate' => 10]), 'directory plan change requires edit permission');
    AdminContext::set(['admin_id' => 902, 'site_id' => 991, 'is_super' => false, 'permissions' => ['merchant:list:edit']]);
    rejects(40302, fn () => directoryCall('commission', ['id' => $foreign, 'commissionPlan' => 'vip', 'commissionRate' => 10]), 'directory cannot update foreign plan');
} finally {
    Db::rollBack();
}
echo "Directory UI integration passed; synthetic transaction rolled back.\n";
