<?php

declare(strict_types=1);

use App\Middleware\CorsMiddleware;

return [
    'http' => [
        // CORS 允许 admin-web 本机开发调试跨域访问;生产由 OpenResty 网关统一处理
        CorsMiddleware::class,
    ],
];
