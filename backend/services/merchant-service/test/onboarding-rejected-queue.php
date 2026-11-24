<?php
declare(strict_types=1);
require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\OnboardingController;
use App\Controller\Admin\VerifyController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Constants\ErrorCode;

$onboarding = $container->get(OnboardingController::class);
$verify = $container->get(VerifyController::class);
$call = static function (object $controller, string $method, array $input = []): mixed {
    setRequest($input);
    return $controller->$method()['data'];
};
$permissions = ['merchant:onboarding:list', 'merchant:onboarding:reject', 'merchant:list:audit'];
AdminContext::set(['admin_id' => 94001, 'admin_name' => 'Queue Reviewer', 'site_id' => 7, 'is_super' => false, 'permissions' => $permissions]);
Db::beginTransaction();
try {
    $active = (int) Db::table('merchant_application')->insertGetId(['site_id' => 7, 'app_no' => 'QUEUE-ACTIVE', 'company_name' => 'Correction Company', 'state_model_version' => 1, 'registration_status' => 4]);
    $rejected = (int) Db::table('merchant_application')->insertGetId(['site_id' => 7, 'app_no' => 'QUEUE-REJECTED', 'company_name' => 'Rejected Registration', 'country' => 'Myanmar', 'state_model_version' => 1, 'registration_status' => 2, 'stage' => 1, 'reg_number' => 'QUEUE-REG-123', 'submitted_at' => '2026-11-23 10:00:00']);
    Db::table('merchant_application_business')->insert(['site_id' => 7, 'application_id' => $rejected, 'business_name' => 'Rejected Hotel', 'business_type' => 'hotel', 'city' => 'Yangon']);
    $before = $call($verify, 'queues');
    $call($onboarding, 'reject', ['id' => $rejected, 'reasonCode' => 4, 'note' => 'Registration verification failed']);
    $defaultRows = $call($onboarding, 'index')['list'];
    check(!in_array($rejected, array_column($defaultRows, 'id')), 'rejected base registration leaves the default onboarding list');
    check(in_array($active, array_column($defaultRows, 'id')), 'registration correction remains in onboarding');
    $after = $call($verify, 'queues');
    check($after['onboarding'] === $before['onboarding'] - 1 && $after['rejected'] === $before['rejected'] + 1, 'rejection moves exactly one queue count from onboarding to rejected');
    $rows = $call($verify, 'index', ['tab' => 'rejected', 'keyword' => 'QUEUE-REJECTED']);
    check($rows['total'] === 1 && (int) $rows['list'][0]['application_id'] === $rejected && $rows['list'][0]['record_type'] === 'application', 'rejected list contains unconverted applications searchable by lead number');
    check($rows['list'][0]['merchant_short_name'] === 'Rejected Hotel' && $rows['list'][0]['credit_code'] === 'QUEUE-REG-123', 'rejected application row keeps business and registration information');
    check($call($verify, 'index', ['tab' => 'rejected', 'keyword' => 'QUEUE-REG-123'])['total'] === 1, 'rejected application is searchable by registration number');
    $formal = merchantFixture(7, 2);
    Db::table('merchant_info')->where('id', $formal)->update(['id' => $rejected, 'merchant_name' => 'Rejected Formal Merchant']);
    $formal = $rejected;
    Db::table('merchant_application')->insert(['site_id' => 7, 'app_no' => 'QUEUE-FORMAL-REJECTED', 'company_name' => 'Formal Source', 'merchant_id' => $formal, 'stage' => 5, 'state_model_version' => 1, 'registration_status' => 3]);
    $formalRows = $call($verify, 'index', ['tab' => 'rejected', 'keyword' => 'QUEUE-FORMAL-REJECTED']);
    check($formalRows['total'] === 1 && $formalRows['list'][0]['record_type'] === 'merchant', 'formal lead-number search does not match an unrelated application with the same numeric ID');
    $legacy = (int) Db::table('merchant_application')->insertGetId(['site_id' => 7, 'app_no' => 'QUEUE-LEGACY', 'company_name' => 'Legacy Closed Lead', 'state_model_version' => 0, 'stage' => 6]);
    $deleted = (int) Db::table('merchant_application')->insertGetId(['site_id' => 7, 'app_no' => 'QUEUE-DELETED', 'company_name' => 'Deleted Closed Lead', 'state_model_version' => 1, 'registration_status' => 5, 'deleted_at' => gmdate('Y-m-d H:i:s')]);
    $foreign = (int) Db::table('merchant_application')->insertGetId(['site_id' => 8, 'app_no' => 'QUEUE-FOREIGN', 'company_name' => 'Foreign Closed Lead', 'state_model_version' => 1, 'registration_status' => 5]);
    $all = $call($verify, 'index', ['tab' => 'rejected', 'pageSize' => 200]);
    check($all['total'] === 3 && count(array_unique(array_column($all['list'], 'row_key'))) === 3, 'rejected queue combines legacy closed leads and formal rejections with unique row keys');
    check($call($verify, 'queues')['rejected'] === 3, 'combined rejected list total matches navigation count');
    $page1 = $call($verify, 'index', ['tab' => 'rejected', 'page' => 1, 'pageSize' => 1]);
    $page2 = $call($verify, 'index', ['tab' => 'rejected', 'page' => 2, 'pageSize' => 1]);
    check($page1['total'] === 3 && count($page1['list']) === 1 && $page1['list'][0]['row_key'] !== $page2['list'][0]['row_key'], 'combined rejected queue paginates on the server without duplicates');
    check($call($verify, 'index', ['tab' => 'rejected', 'keyword' => 'QUEUE-FOREIGN'])['total'] === 0 && $call($verify, 'index', ['tab' => 'rejected', 'keyword' => 'QUEUE-DELETED'])['total'] === 0, 'rejected queue excludes other sites and deleted leads');
    AdminContext::set(['admin_id' => 94002, 'site_id' => 7, 'is_super' => false, 'permissions' => ['merchant:list:audit']]);
    $detail = $call($onboarding, 'detail', ['id' => $rejected]);
    check($detail['application']['reject_note'] === 'Registration verification failed' && $detail['timeline'][0]['operator_name'] === 'Queue Reviewer', 'audit reader sees rejection reason and reviewer history');
    rejects(ErrorCode::FORBIDDEN, fn () => $call($onboarding, 'detail', ['id' => $active]), 'audit-only reader cannot use rejected detail access for an active lead');
    rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $call($onboarding, 'detail', ['id' => $foreign]), 'rejected detail preserves site isolation');
    check(!Db::table('merchant_admin')->where('merchant_id', $formal)->exists() && (int) Db::table('merchant_application')->where('id', $rejected)->value('merchant_id') === 0, 'queue repair never creates a merchant account for rejected registration');
} finally {
    Db::rollBack();
}
