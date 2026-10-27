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
    // 密钥类字段 AES-256-GCM 加密密钥(手机号/邮箱/身份证等加密存储;收款账户 AppKey/证书解密)
    'aes_key' => env('MTRIP_AES_KEY', ''),
    // 服务间内部调用令牌(业务通知 outbox 推送时放入 X-Internal-Token;禁止写日志)
    'internal_token' => env('MTRIP_INTERNAL_TOKEN', ''),
    // KBZ 异步通知公网基地址(收款账户 notify_base_url 未配置时兜底;为空则拒绝下单,不在代码写死域名)
    'payment_notify_base_url' => env('PAYMENT_NOTIFY_BASE_URL', ''),
];