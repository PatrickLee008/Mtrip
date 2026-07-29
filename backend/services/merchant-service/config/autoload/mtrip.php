<?php

declare(strict_types=1);

use function Hyperf\Support\env;

/**
 * Mtrip 平台级配置(shared 组件与本服务共用)
 */
return [
    // 全平台统一 JWT 签名密钥(后台与C端共用,claims.aud 区分)
    'jwt_secret' => env('MTRIP_JWT_SECRET', ''),
    // 后台 AccessToken 有效期(秒)
    'jwt_ttl' => (int) env('MTRIP_JWT_TTL', 7200),
    // C端 App Token 有效期(秒,默认7天)
    'app_jwt_ttl' => (int) env('MTRIP_APP_JWT_TTL', 604800),
    // 密钥类字段 AES-256-GCM 加密密钥(手机号/邮箱/身份证等加密存储)
    'aes_key' => env('MTRIP_AES_KEY', ''),
];
