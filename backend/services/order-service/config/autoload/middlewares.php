<?php

declare(strict_types=1);

use App\Middleware\CorsMiddleware;

return [
    'http' => [
        // CORS 允许 Expo Web(H5) 本机开发调试跨域访问
        CorsMiddleware::class,
    ],
];
