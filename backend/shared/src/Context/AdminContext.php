<?php

declare(strict_types=1);

namespace Mtrip\Shared\Context;

use Hyperf\Context\Context;

/**
 * 当前登录管理员上下文(协程级),由 AdminAuthMiddleware 注入
 * 站点数据隔离核心:site_id=0 为超级管理员(全平台),否则仅可操作本站点数据
 */
class AdminContext
{
    private const KEY = 'mtrip.admin';

    public static function set(array $admin): void
    {
        Context::set(self::KEY, $admin);
    }

    public static function get(): array
    {
        return Context::get(self::KEY, []);
    }

    public static function adminId(): int
    {
        return (int) (self::get()['admin_id'] ?? 0);
    }

    public static function adminName(): string
    {
        return (string) (self::get()['admin_name'] ?? '');
    }

    public static function siteId(): int
    {
        return (int) (self::get()['site_id'] ?? 0);
    }

    /** 是否超级管理员(site_id = 0 且标记 is_super) */
    public static function isSuper(): bool
    {
        return (bool) (self::get()['is_super'] ?? false);
    }

    /** 按钮/接口权限标识集合 */
    public static function permissions(): array
    {
        return (array) (self::get()['permissions'] ?? []);
    }

    public static function hasPermission(string $perm): bool
    {
        return self::isSuper() || in_array($perm, self::permissions(), true);
    }

    /** 多键任一匹配(酒店/门票共用接口等场景) */
    public static function hasAnyPermission(array $perms): bool
    {
        if (self::isSuper()) {
            return true;
        }
        foreach ($perms as $perm) {
            if (in_array($perm, self::permissions(), true)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 数据隔离:非超管强制返回自身站点ID;超管可指定查询站点(0=全部)
     */
    public static function scopeSiteId(?int $querySiteId = null): ?int
    {
        if (self::isSuper()) {
            return $querySiteId; // null/0 表示不过滤
        }
        return self::siteId();
    }
}
