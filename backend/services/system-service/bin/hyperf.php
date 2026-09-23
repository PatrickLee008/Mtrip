<?php

declare(strict_types=1);

/**
 * Mtrip system-service 入口
 */
ini_set('display_errors', 'on');
ini_set('display_startup_errors', 'on');
ini_set('memory_limit', '1G');

error_reporting(E_ALL);

! defined('BASE_PATH') && define('BASE_PATH', dirname(__DIR__, 1));

require BASE_PATH . '/vendor/autoload.php';

! defined('SWOOLE_HOOK_FLAGS') && define('SWOOLE_HOOK_FLAGS', Hyperf\Engine\DefaultOption::hookFlags());

(function () {
    // 无 pcntl 环境(Windows 原生 / Swow)改用 ProcScanHandler;Linux 生产有 pcntl,仍走默认 PcntlScanHandler,行为不变
    Hyperf\Di\ClassLoader::init(null, null, extension_loaded('pcntl') ? null : new Hyperf\Di\ScanHandler\ProcScanHandler());
    /** @var Psr\Container\ContainerInterface $container */
    $container = require BASE_PATH . '/config/container.php';

    $application = $container->get(Hyperf\Contract\ApplicationInterface::class);
    $application->run();
})();
