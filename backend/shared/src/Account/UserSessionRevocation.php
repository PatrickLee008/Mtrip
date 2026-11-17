<?php

declare(strict_types=1);

namespace Mtrip\Shared\Account;

/**
 * C 端会话吊销标记(账户注销后让已签发的 JWT 立即失效)。
 *
 * App JWT 是无状态的(默认 7 天),注销只改库的话,旧 Token 在各服务里仍然能下单 / 发消息。
 * 注销成功后在共享 Redis(各服务同一个 db)写 `mtrip:user:revoked:{userId}`,寿命不短于 JWT 有效期;
 * `UserAuthMiddleware` 见到标记一律按未登录拒绝。用户 id 不复用,所以标记无需按签发时间区分。
 */
final class UserSessionRevocation
{
    public static function key(int $userId): string
    {
        return 'mtrip:user:revoked:' . $userId;
    }
}
