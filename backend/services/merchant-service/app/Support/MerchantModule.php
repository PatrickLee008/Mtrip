<?php

declare(strict_types=1);

namespace App\Support;

use Hyperf\DbConnection\Db;

/**
 * 商户功能模块(管理端开通商户时授予,决定 merchant-web 可见的业务菜单)
 *
 * 数据落在 merchant_module_grant(商户→模块)与 merchant_menu.module_key(菜单→模块)。
 * 可见性口径见 database/merchant/35-merchant-module-grant.sql 注释:
 *   商户无授权行 = 全模块开通(向后兼容);有授权行 = 公共菜单 + 已授权模块菜单。
 */
class MerchantModule
{
    /** 模块目录:key => 中文名(前端多语言另走词条,此处仅作后端校验与兜底展示) */
    public const CATALOG = [
        'hotel' => '酒店',
        'restaurant' => '餐饮',
    ];

    /** 过滤出目录内的合法模块 key(去重、去空、保持目录顺序) */
    public static function sanitize(array $keys): array
    {
        $keys = array_map(static fn ($k) => trim((string) $k), $keys);
        return array_values(array_filter(array_keys(self::CATALOG), static fn (string $k) => in_array($k, $keys, true)));
    }

    /** 某商户已授权的模块 key 列表 */
    public static function granted(int $merchantId): array
    {
        if ($merchantId <= 0) {
            return [];
        }
        return Db::table('merchant_module_grant')->where('merchant_id', $merchantId)
            ->pluck('module_key')->map(static fn ($k) => (string) $k)->all();
    }

    /**
     * 当前账号可见的模块过滤条件是否需要施加。
     * 返回 null 表示不裁剪(全模块);返回数组表示只允许这些模块(公共菜单另行放行)。
     */
    public static function visibleModules(int $accountType, int $merchantId): ?array
    {
        // 集团账号跨多个商户,不按单商户模块裁剪
        if ($accountType === 1) {
            return null;
        }
        $granted = self::granted($merchantId);
        // 无授权行 = 未做过模块管控,视为全开通
        return $granted === [] ? null : $granted;
    }
}
