<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

/**
 * App 版本号比较与更新判定(Consumer App PRD 19.1 App 更新与强制更新)。
 *
 * 版本格式:数字段以点分隔,1~4 段(1 / 1.2 / 1.2.3 / 1.2.3.4),允许前缀 v 与 -/+ 后缀(后缀忽略)。
 * 缺失段按 0 补齐:1.2 == 1.2.0。非法版本号一律视为「无法判定」—— 不强更、不提示,避免误伤用户。
 */
final class AppVersion
{
    private const PATTERN = '/^v?(\d{1,6}(?:\.\d{1,6}){0,3})(?:[-+].*)?$/i';

    /** 解析为数字段数组;非法返回 null */
    public static function parse(?string $version): ?array
    {
        $version = trim((string) $version);
        if ($version === '' || ! preg_match(self::PATTERN, $version, $m)) {
            return null;
        }
        return array_map('intval', explode('.', $m[1]));
    }

    public static function isValid(?string $version): bool
    {
        return self::parse($version) !== null;
    }

    /** 比较:a<b 返回 -1,相等 0,a>b 返回 1;任一非法返回 null */
    public static function compare(?string $a, ?string $b): ?int
    {
        $pa = self::parse($a);
        $pb = self::parse($b);
        if ($pa === null || $pb === null) {
            return null;
        }
        $len = max(count($pa), count($pb));
        for ($i = 0; $i < $len; ++$i) {
            $x = $pa[$i] ?? 0;
            $y = $pb[$i] ?? 0;
            if ($x !== $y) {
                return $x < $y ? -1 : 1;
            }
        }
        return 0;
    }

    /**
     * 更新判定。
     * forceUpdate:已安装 < 最低支持版本;hasUpdate:已安装 < 最新版本(强更时恒为 true)。
     * 最低/最新版本留空 = 该项不启用。
     *
     * @return array{forceUpdate: bool, hasUpdate: bool}
     */
    public static function evaluate(?string $installed, ?string $minVersion, ?string $latestVersion): array
    {
        $force = self::compare($installed, $minVersion) === -1;
        $has = $force || self::compare($installed, $latestVersion) === -1;
        return ['forceUpdate' => $force, 'hasUpdate' => $has];
    }
}
