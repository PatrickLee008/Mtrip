<?php

declare(strict_types=1);

use App\Middleware\CorsMiddleware;
use Mtrip\Shared\Middleware\ClientSignMiddleware;
use Mtrip\Shared\Middleware\InternalAuthMiddleware;
use Mtrip\Shared\Middleware\PayloadDecryptMiddleware;
use Mtrip\Shared\Middleware\RequestLogMiddleware;

/*
 * 未注册 SubmitLockMiddleware(2026-10-27 阶段 4 移除):本服务的 /api/ 写入口只有三方渠道回调,
 * 其按「IP + UA」识别提交身份,会把 KBZ 对不同订单的并发通知判为重复提交(42902),导致通知被拒、
 * 只能靠重推/查单补单。回调幂等由流水行锁 + 状态条件更新保证;/internal/* 由调用方加锁与幂等键保证。
 */
return [
    'http' => [
        // CORS 允许 admin-web 本机开发调试跨域访问;生产由 OpenResty 网关统一处理
        CorsMiddleware::class,
        // 全量请求日志(MTRIP_REQUEST_LOG=true 时启用,写 request.log)
        RequestLogMiddleware::class,
        // 服务间内部接口鉴权(仅 /internal/* 生效:内网来源 + X-Internal-Token)
        InternalAuthMiddleware::class,
        // 客户端签名鉴权(仅 /api/v1/app/* 生效,MTRIP_CLIENT_SIGN 开关)
        ClientSignMiddleware::class,
        // 敏感接口传输加密解密(X-Encrypted 密文还原,MTRIP_PAYLOAD_ENCRYPT 控制强制名单)
        PayloadDecryptMiddleware::class,
    ],
];