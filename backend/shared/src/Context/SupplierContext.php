<?php

declare(strict_types=1);

namespace Mtrip\Shared\Context;

use Hyperf\Context\Context;

/**
 * 当前登录供应商账号上下文(协程级),由 SupplierAuthMiddleware 注入
 * 供应商为单层主体(无集团/门店/账号类型):数据范围恒为本 supplier_id。
 * 主账号 is_owner=1 拥有全部权限;子账号按角色授权。
 */
class SupplierContext
{
    private const KEY = 'mtrip.supplier';

    public static function set(array $ctx): void
    {
        Context::set(self::KEY, $ctx);
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

    /** 当前账号所属供应商ID(数据范围核心) */
    public static function supplierId(): int
    {
        return (int) (self::get()['supplier_id'] ?? 0);
    }

    /** 是否供应商主账号(拥有全部权限) */
    public static function isOwner(): bool
    {
        return (bool) (self::get()['is_owner'] ?? false);
    }

    /** 按钮/接口权限标识集合 */
    public static function permissions(): array
    {
        return (array) (self::get()['permissions'] ?? []);
    }

    public static function hasPermission(string $perm): bool
    {
        return self::isOwner() || in_array($perm, self::permissions(), true);
    }

    /** 多键任一匹配 */
    public static function hasAnyPermission(array $perms): bool
    {
        if (self::isOwner()) {
            return true;
        }
        foreach ($perms as $perm) {
            if (in_array($perm, self::permissions(), true)) {
                return true;
            }
        }
        return false;
    }
}
