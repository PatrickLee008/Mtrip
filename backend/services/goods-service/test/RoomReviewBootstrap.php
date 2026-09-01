<?php

declare(strict_types=1);

! defined('BASE_PATH') && define('BASE_PATH', dirname(__DIR__));
require BASE_PATH . '/vendor/autoload.php';
Hyperf\Di\ClassLoader::init();
$container = require BASE_PATH . '/config/container.php';

function check(bool $ok, string $name): void
{
    if (! $ok) throw new RuntimeException('FAIL: ' . $name);
    echo "OK: {$name}\n";
}
