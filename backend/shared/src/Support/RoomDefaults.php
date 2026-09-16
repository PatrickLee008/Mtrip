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

    public static function stock(array $room): int
    {
        return max(0, (int) ($room['launch_stock'] ?? $room['base_stock'] ?? 0));
    }
}
