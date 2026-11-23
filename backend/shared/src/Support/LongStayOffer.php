<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Hyperf\DbConnection\Db;

/** Active long-stay tiers used by discovery, the checkout quote and the order. */
final class LongStayOffer
{
    public const MAX_BOOKABLE_NIGHTS = 30;

    public static function activeTiers(int $siteId, array $propertyIds): array
    {
        if ($propertyIds === []) return [];
        $now = gmdate('Y-m-d H:i:s');
        return Db::table('marketing_longstay_tier')->where('site_id', $siteId)
            ->where('status', 1)->whereNull('deleted_at')
            ->whereIn('property_id', array_merge([0], $propertyIds))
            ->whereBetween('min_nights', [1, self::MAX_BOOKABLE_NIGHTS])
            ->where('discount_rate', '>', 0)->where('discount_rate', '<', 100)
            ->where(static fn ($query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(static fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>', $now))
            ->orderByDesc('priority')->orderByDesc('min_nights')->orderBy('id')->get()
            ->map(static fn ($row) => (array) $row)->all();
    }

    public static function tier(array $tiers, int $propertyId, int $nights): ?array
    {
        foreach ($tiers as $tier) {
            if (((int) $tier['property_id'] === 0 || (int) $tier['property_id'] === $propertyId)
                && (int) $tier['min_nights'] <= $nights) {
                return $tier;
            }
        }
        return null;
    }

    public static function discount(?array $tier, float $original): float
    {
        return $tier === null ? 0.0 : round($original * (float) $tier['discount_rate'] / 100, 2);
    }

    /** Legacy ladders preserve their established coupon behavior. */
    public static function allowsCoupon(?array $tier, array $coupon): bool
    {
        $stackable = $tier['coupon_stackable'] ?? null;
        return $stackable === null || ((bool) $stackable && (bool) ($coupon['stackable'] ?? false));
    }
}
