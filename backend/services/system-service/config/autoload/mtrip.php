<?php

declare(strict_types=1);

use function Hyperf\Support\env;

/**
 * Mtrip 平台级配置(shared 组件与本服务共用)
 */
return [
    // 后台 JWT 签名密钥(全部微服务一致,便于网关透传)
    'jwt_secret' => env('MTRIP_JWT_SECRET', ''),
    // AccessToken 有效期(秒),与 sys_config.jwt_expire_minutes 初始一致
    'jwt_ttl' => (int) env('MTRIP_JWT_TTL', 7200),
    // 密钥类字段 AES-256-GCM 加密密钥(存储AK/SK、支付密钥、ClientSecret 等)
    'aes_key' => env('MTRIP_AES_KEY', ''),
    // 登录失败锁定策略(可被 sys_config 覆盖)
    'login_fail_limit' => (int) env('MTRIP_LOGIN_FAIL_LIMIT', 5),
    'login_lock_minutes' => (int) env('MTRIP_LOGIN_LOCK_MINUTES', 30),
];
