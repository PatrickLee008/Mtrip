<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

/** Used only when a date has no explicit inventory record. */
final class RoomDefaults
{
    public static function price(array $room, string $date): float
    {
        $weekend = in_array((int) date('w', strtotime($date)), [5, 6], true);
        return $weekend && (float) ($room['weekend_price'] ?? 0) > 0
            ? (float) $room['weekend_price'] : (float) $room['base_price'];
    }

    /**
     * 无日库存记录时的默认可售配额(文档 13/20:launch_stock 优先,未设置则回退物理房量 base_stock)
     *
     * 必须用 `> 0` 判断而不是 `??`:merchant-web 新建房型时 launch_stock 初值就是 0,
     * 而 `0 ?? base_stock` 得到的是 0(null 合并只在键为 null/缺失时回退),
     * 会让"填了客房总数、没填默认可售配额"的房型所有日期都判定库存不足(409)。
     * 0 / null / 键缺失一律视为"未设置";真要不卖请用停售(status=2)或单日 is_closed。
     */
    public static function stock(array $room): int
    {
        $launch = (int) ($room['launch_stock'] ?? 0);
        return max(0, $launch > 0 ? $launch : (int) ($room['base_stock'] ?? 0));
    }
}
