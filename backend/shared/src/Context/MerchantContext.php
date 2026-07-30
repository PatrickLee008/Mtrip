<?php

declare(strict_types=1);

namespace Mtrip\Shared\Context;

use Hyperf\Context\Context;
use Hyperf\DbConnection\Db;

/**
 * 当前登录商户账号上下文(协程级),由 MerchantAuthMiddleware 注入
 * 账号类型 account_type:1集团 2商户 3门店
 * 数据范围:集团=本集团绑定商户及其门店;商户=本商户;门店=本门店
 */
class MerchantContext
{
    private const KEY = 'mtrip.merchant';

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

    /** 账号类型:1集团 2商户 3门店 */
    public static function accountType(): int
    {
        return (int) (self::get()['account_type'] ?? 0);
    }

    public static function groupId(): int
    {
        return (int) (self::get()['group_id'] ?? 0);
    }

    public static function merchantId(): int
    {
        return (int) (self::get()['merchant_id'] ?? 0);
    }

    public static function storeId(): int
    {
        return (int) (self::get()['store_id'] ?? 0);
    }

    /** 是否商户/集团/门店主账号(拥有本 account_type 全部权限) */
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

    /**
     * 当前账号可操作的商户ID集合(数据范围核心):
     * - 集团(1):本集团下全部绑定商户
     * - 商户(2)/门店(3):仅本商户
     * 返回空数组表示无任何可见商户(应拦截为空结果)。
     */
    public static function scopeMerchantIds(): array
    {
        $type = self::accountType();
        if ($type === 1) {
            $groupId = self::groupId();
            if ($groupId <= 0) {
                return [];
            }
            return Db::table('merchant_info')
                ->where('group_id', $groupId)
                ->whereNull('deleted_at')
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }
        $merchantId = self::merchantId();
        return $merchantId > 0 ? [$merchantId] : [];
    }

    /**
     * 门店范围:门店账号仅限本门店;集团/商户不限门店(返回 null 表示不按门店过滤)。
     */
    public static function scopeStoreId(): ?int
    {
        return self::accountType() === 3 ? self::storeId() : null;
    }
}
