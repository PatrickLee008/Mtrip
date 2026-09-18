<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\GlobalConfigController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;

function merchantTestModeRow(array $response): array
{
    foreach ($response['data']['security'] ?? [] as $row) {
        if (($row['config_key'] ?? '') === 'merchant_auth_test_mode') {
            return $row;
        }
    }
    throw new RuntimeException('Merchant auth test-mode config is missing');
}

$controller = $container->get(GlobalConfigController::class);

Db::table('sys_config')->insert([
    [
        'config_group' => 'security', 'config_key' => 'merchant_auth_test_mode', 'config_value' => '0',
        'value_type' => 3, 'config_name' => 'Merchant auth test mode', 'default_value' => '0',
    ],
    [
        'config_group' => 'security', 'config_key' => 'test_number', 'config_value' => '1',
        'value_type' => 2, 'config_name' => 'Test number', 'default_value' => '1',
    ],
]);

$config->set('app_env', 'staging');
$config->set('mtrip.merchant_auth_test_allowed', true);
AdminContext::set(['admin_id' => 11, 'admin_name' => 'Site Admin', 'site_id' => 7, 'is_super' => false]);
setRequest(['configs' => [['key' => 'merchant_auth_test_mode', 'value' => '1']]]);
rejects(ErrorCode::FORBIDDEN, fn () => $controller->save(), 'ordinary admin cannot enable merchant test mode');
check(Db::table('sys_config')->where('config_key', 'merchant_auth_test_mode')->value('config_value') === '0', 'rejected ordinary-admin save leaves test mode off');

AdminContext::set(['admin_id' => 1, 'admin_name' => 'Super Admin', 'site_id' => 0, 'is_super' => true]);
$config->set('mtrip.merchant_auth_test_allowed', false);
setRequest(['configs' => [['key' => 'merchant_auth_test_mode', 'value' => '1']]]);
rejects(ErrorCode::DATA_CONFLICT, fn () => $controller->save(), 'deployment capability gate blocks enabling test mode');

$config->set('mtrip.merchant_auth_test_allowed', true);
setRequest(['configs' => [['key' => 'merchant_auth_test_mode', 'value' => 'invalid']]]);
rejects(ErrorCode::PARAM_VALIDATE_FAIL, fn () => $controller->save(), 'test mode accepts only boolean database values');

setRequest(['configs' => [['key' => 'merchant_auth_test_mode', 'value' => '1']]]);
$saved = $controller->save();
check(($saved['data']['updated'] ?? 0) === 1, 'super admin can enable test mode in an allowed environment');
setRequest(['group' => 'security']);
$security = $controller->index();
$testMode = merchantTestModeRow($security);
check(($testMode['environment_allowed'] ?? false) === true && ($testMode['effective'] ?? false) === true, 'config response exposes allowed and effective test-mode state');

setRequest(['configs' => [
    ['key' => 'merchant_auth_test_mode', 'value' => '0'],
    ['key' => 'missing_config', 'value' => '1'],
]]);
rejects(ErrorCode::NOT_FOUND, fn () => $controller->save(), 'failed config batch is rejected');
check(Db::table('sys_config')->where('config_key', 'merchant_auth_test_mode')->value('config_value') === '1', 'failed config batch rolls back the test-mode change');

$config->set('app_env', 'production');
setRequest(['group' => 'security']);
$security = $controller->index();
$testMode = merchantTestModeRow($security);
check(($testMode['environment_allowed'] ?? true) === false && ($testMode['effective'] ?? true) === false, 'production reports test mode as blocked even when the database value is on');
setRequest(['configs' => [['key' => 'merchant_auth_test_mode', 'value' => '1']]]);
rejects(ErrorCode::DATA_CONFLICT, fn () => $controller->save(), 'production cannot enable test mode');

$config->set('app_env', 'staging');
AdminContext::set(['admin_id' => 11, 'admin_name' => 'Site Admin', 'site_id' => 7, 'is_super' => false]);
setRequest(['group' => 'security']);
rejects(ErrorCode::FORBIDDEN, fn () => $controller->reset(), 'ordinary admin cannot reset a group containing merchant test mode');
check(Db::table('sys_config')->where('config_key', 'merchant_auth_test_mode')->value('config_value') === '1', 'rejected ordinary-admin reset leaves test mode unchanged');

AdminContext::set(['admin_id' => 1, 'admin_name' => 'Super Admin', 'site_id' => 0, 'is_super' => true]);
setRequest(['group' => 'security']);
$reset = $controller->reset();
check(($reset['data']['reset'] ?? 0) === 2, 'super admin can reset the security group');
check(Db::table('sys_config')->where('config_key', 'merchant_auth_test_mode')->value('config_value') === '0', 'security reset restores merchant test mode to off');

echo "Global config merchant test-mode assertions passed\n";
