<?php

declare(strict_types=1);

/**
 * shared 包单测入口:php tests/run.php
 * 覆盖不依赖 Swoole/DB 的纯逻辑类;失败时退出码非 0
 */

require __DIR__ . '/bootstrap.php';

foreach (glob(__DIR__ . '/cases/*Test.php') as $case) {
    require $case;
}

exit(MiniTest::run() === 0 ? 0 : 1);
