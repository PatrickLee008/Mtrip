<?php

declare(strict_types=1);

use function Hyperf\Support\env;

/**
 * 数据库连接:
 * - default:mtrip_business(用户/商品/订单等业务表)
 * - system:mtrip_system(shared 中间件写审计日志/查客户端配置统一走该连接名)
 * 时间统一 UTC(文档 9.8),站点本地时间由前端按站点时区渲染
 */
$pool = [
    'min_connections' => 1,
    'max_connections' => (int) env('DB_MAX_CONNECTIONS', 10),
    'connect_timeout' => 10.0,
    'wait_timeout' => 3.0,
    'heartbeat' => -1,
    'max_idle_time' => 60.0,
];
$options = [
    PDO::ATTR_STRINGIFY_FETCHES => false,
    PDO::ATTR_EMULATE_PREPARES => false,
];
$base = [
    'driver' => 'mysql',
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => (int) env('DB_PORT', 3306),
    'username' => env('DB_USERNAME', 'mtrip'),
    'password' => env('DB_PASSWORD', ''),
    'charset' => 'utf8mb4',
    'collation' => 'utf8mb4_bin',
    'prefix' => '',
    'timezone' => '+00:00',
    'pool' => $pool,
    'options' => $options,
];

return [
    'default' => array_merge($base, ['database' => env('DB_BUSINESS_DATABASE', 'mtrip_business')]),
    'system' => array_merge($base, ['database' => env('DB_SYSTEM_DATABASE', 'mtrip_system')]),
];
