<?php

declare(strict_types=1);

use App\Middleware\CorsMiddleware;
use Mtrip\Shared\Middleware\RequestLogMiddleware;

return [
    'http' => [
        // CORS 允许 admin-web 本机开发调试跨域访问
        CorsMiddleware::class,
        // 全量请求日志(MTRIP_REQUEST_LOG=true 时启用,写 request.log)
        RequestLogMiddleware::class,
    ],
];
