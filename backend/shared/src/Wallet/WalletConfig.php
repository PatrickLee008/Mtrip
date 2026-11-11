<?php

declare(strict_types=1);

namespace Mtrip\Shared\Wallet;

use Hyperf\DbConnection\Db;

/**
 * mTrip 钱包配置(Super Admin PRD v1.0.14 模块 25「钱包配置」)
 *
 * 读全局 sys_config 的 wallet 分组,后台「全局配置 → wallet」页签直接维护(无需单独页面):
 *   wallet_credit_validity_days  新入账额度有效天数,0 = 永不过期(PRD 举例 6 个月 / 1 年,默认 365)
 *   wallet_auto_apply            结账时是否默认自动抵扣钱包(用户付款前可关闭),默认开
 *   wallet_max_use_hotel         酒店订单单笔最多可用钱包金额(MMK),0 = 不限
 *   wallet_max_use_car           汽车订单单笔最多可用钱包金额(MMK),0 = 不限
 * PRD 没有按站点区分的要求,只读全局;读库失败一律按默认值,不阻断下单 / 退款。
 */
final class WalletConfig
{
    public const DEFAULT_VALIDITY_DAYS = 365;

    /** 订单类型 → 最高可用限额配置键(order_main.order_type:1 酒店;汽车走商品单,按 goods_type 映射见 maxUseKey) */
    public const MAX_USE_KEYS = [
        'hotel' => 'wallet_max_use_hotel',
        'car' => 'wallet_max_use_car',
    ];

    /** @var array<string, string>|null 进程内缓存(配置改动后至多 60 秒生效) */
    private static ?array $cache = null;

    private static int $cachedAt = 0;

    public static function validityDays(): int
    {
        return self::parseValidityDays(self::raw('wallet_credit_validity_days'));
    }

    public static function autoApply(): bool
    {
        $v = self::raw('wallet_auto_apply');
        return $v === null || $v === '' ? true : ! in_array(strtolower(trim($v)), ['0', 'false', 'off', 'no'], true);
    }

    /** 某类交易单笔最多可用钱包金额;0 表示不限 */
    public static function maxUse(string $type): float
    {
        $key = self::MAX_USE_KEYS[$type] ?? null;
        return $key === null ? 0.0 : self::parseAmount(self::raw($key));
    }

    /** 有效天数:空 / 非数字 → 默认 365;负数按 0(永不过期);上限 3650 天 */
    public static function parseValidityDays(?string $value): int
    {
        if ($value === null || trim($value) === '' || ! is_numeric(trim($value))) {
            return self::DEFAULT_VALIDITY_DAYS;
        }
        return max(0, min(3650, (int) trim($value)));
    }

    /** 限额:空 / 非数字 / 负数 → 0(不限) */
    public static function parseAmount(?string $value): float
    {
        if ($value === null || ! is_numeric(trim($value))) {
            return 0.0;
        }
        return max(0.0, round((float) trim($value), 2));
    }

    /** 新入账额度的到期时间;有效天数 0 返回 null(永不过期) */
    public static function expiresAt(int $validityDays, ?\DateTimeImmutable $now = null): ?string
    {
        if ($validityDays <= 0) {
            return null;
        }
        return ($now ?? new \DateTimeImmutable())->modify("+{$validityDays} days")->format('Y-m-d H:i:s');
    }

    /** 测试 / 配置保存后清缓存 */
    public static function flush(): void
    {
        self::$cache = null;
    }

    private static function raw(string $key): ?string
    {
        if (self::$cache === null || time() - self::$cachedAt > 60) {
            try {
                self::$cache = Db::connection('system')->table('sys_config')
                    ->where('config_group', 'wallet')->whereNull('deleted_at')
                    ->pluck('config_value', 'config_key')->map(static fn ($v) => (string) $v)->all();
            } catch (\Throwable) {
                self::$cache = [];
            }
            self::$cachedAt = time();
        }
        return self::$cache[$key] ?? null;
    }
}
