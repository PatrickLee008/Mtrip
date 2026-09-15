<?php

declare(strict_types=1);

if (getenv('DB_BUSINESS_DATABASE') !== 'mtrip_m12_s1_test' || getenv('DB_SYSTEM_DATABASE') !== 'mtrip_m12_s1_test') {
    throw new RuntimeException('Set both DB databases to mtrip_m12_s1_test before running room review tests.');
}
! defined('BASE_PATH') && define('BASE_PATH', dirname(__DIR__));
require BASE_PATH . '/vendor/autoload.php';
Hyperf\Di\ClassLoader::init();
$container = require BASE_PATH . '/config/container.php';
$config = $container->get(Hyperf\Contract\ConfigInterface::class);
if ($config->get('databases.default.database') !== 'mtrip_m12_s1_test') {
    throw new RuntimeException('Unsafe database configuration');
}

function check(bool $ok, string $name): void
{
    if (! $ok) throw new RuntimeException('FAIL: ' . $name);
    echo "OK: {$name}\n";
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
    Hyperf\Context\RequestContext::set((new Hyperf\HttpMessage\Server\Request('POST', '/room-review-test'))->withParsedBody($input));
}
