<?php

declare(strict_types=1);

// 只允许显式隔离库；禁止在开发业务库/生产库运行夹具写入。
if (getenv('DB_BUSINESS_DATABASE') !== 'mtrip_m12_s1_test' || getenv('DB_SYSTEM_DATABASE') !== 'mtrip_m12_s1_test') {
    throw new RuntimeException('Set both DB databases to mtrip_m12_s1_test before running M12 integration tests.');
}
define('BASE_PATH', '/opt/www');
require BASE_PATH . '/vendor/autoload.php';
// 运行前先启动/重启对应服务生成扫描缓存；并行测试进程只读缓存，避免并发重建代理文件。
putenv('SCAN_CACHEABLE=true');
Hyperf\Di\ClassLoader::init();
$container = require BASE_PATH . '/config/container.php';
$config = $container->get(Hyperf\Contract\ConfigInterface::class);
if ($config->get('databases.default.database') !== 'mtrip_m12_s1_test') {
    throw new RuntimeException('Unsafe database configuration');
}

function check(bool $condition, string $name): void
{
    if (! $condition) {
        throw new RuntimeException('FAIL: ' . $name);
    }
    echo 'PASS: ' . $name . PHP_EOL;
}
function rejects(int $code, Closure $call, string $name): void
{
    try {
        $call();
    } catch (Mtrip\Shared\Exception\BusinessException $e) {
        check($e->getCode() === $code, $name . ' code=' . $e->getCode());
        return;
    }
    throw new RuntimeException('FAIL: expected rejection: ' . $name);
}
function setRequest(array $input): void
{
    Hyperf\Context\Context::destroy('http.request.parsedData');
    Hyperf\Context\RequestContext::set((new Hyperf\HttpMessage\Server\Request('POST', '/m12-test'))->withParsedBody($input));
}
/** Test-only login adapter for pre-S4 regression fixtures. Never used in application code. */
function merchantFixtureLogin(object $auth, string $username, string $password, string $ip): array
{
    $pending = $auth->login($username, $password, $ip);
    $security = new \App\Service\MerchantAccountSecurityService();
    $claims = \Mtrip\Shared\Support\JwtHelper::verify($pending['challengeToken'], (string) \Hyperf\Config\config('mtrip.jwt_secret'));
    $account = (array) \Hyperf\DbConnection\Db::table('merchant_admin')->where('id', $claims['admin_id'])->first();
    $secret = $pending['requiresEnrollment'] ? $security->setup($pending['challengeToken'])['manualKey']
        : \Mtrip\Shared\Support\CryptoHelper::decrypt($account['two_fa_secret_enc'], (string) \Hyperf\Config\config('mtrip.aes_key'));
    // S1/S3 may log the same synthetic account in twice within 30s; replay itself is tested separately in S4.
    \Hyperf\DbConnection\Db::table('merchant_admin')->where('id', $account['id'])->update(['last_accepted_totp_step' => -1]);
    return $security->verify($pending['challengeToken'], \Mtrip\Shared\Merchant\Totp::code($secret, intdiv(time(), 30)), $ip);
}

function merchantFixture(int $site = 991, int $status = 3): int
{
    return (int) Hyperf\DbConnection\Db::table('merchant_info')->insertGetId([
        'site_id' => $site, 'merchant_name' => 'M12 isolated hotel', 'credit_code' => 'M12-' . bin2hex(random_bytes(8)),
        'legal_person' => 'Fixture', 'contact_name' => 'Fixture', 'contact_phone' => '', 'status' => $status,
    ]);
}
