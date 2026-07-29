<?php

declare(strict_types=1);

use App\Middleware\CorsMiddleware;
use Mtrip\Shared\Middleware\ClientSignMiddleware;
use Mtrip\Shared\Middleware\PayloadDecryptMiddleware;
use Mtrip\Shared\Middleware\RequestLogMiddleware;

return [
    'http' => [
        // CORS 允许 admin-web 本机开发调试跨域访问
        CorsMiddleware::class,
        // 全量请求日志(MTRIP_REQUEST_LOG=true 时启用,写 request.log)
        RequestLogMiddleware::class,
        // 客户端签名鉴权(仅 /api/v1/app/* 生效,MTRIP_CLIENT_SIGN 开关)
        ClientSignMiddleware::class,
        // 敏感接口传输加密解密(X-Encrypted 密文还原,MTRIP_PAYLOAD_ENCRYPT 控制强制名单)
        PayloadDecryptMiddleware::class,
    ],
];
