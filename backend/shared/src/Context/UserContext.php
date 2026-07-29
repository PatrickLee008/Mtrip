<?php

declare(strict_types=1);

namespace Mtrip\Shared\Context;

use Hyperf\Context\Context;

/**
 * 当前登录C端用户上下文(协程级),由 UserAuthMiddleware 注入
 * 站点隔离:登录后以 Token 内 site_id 为准,游客接口从 X-Site-Id 请求头取
 */
class UserContext
{
    private const KEY = 'mtrip.user';

    public static function set(array $user): void
    {
        Context::set(self::KEY, $user);
    }

    public static function get(): array
    {
        return Context::get(self::KEY, []);
    }

    public static function userId(): int
    {
        return (int) (self::get()['user_id'] ?? 0);
    }

    public static function siteId(): int
    {
        return (int) (self::get()['site_id'] ?? 0);
    }

    public static function isLogin(): bool
    {
        return self::userId() > 0;
    }
}
