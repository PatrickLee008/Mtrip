<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Hyperf\DbConnection\Db;

/** Active long-stay tiers used by discovery, the checkout quote and the order. */
final class LongStayOffer
{
    public const ORDINARY_NIGHTS = 30;

    public static function conflictingTier(int $siteId, int $propertyId, string $source, int $minNights, int $maxNights,
        ?string $startsAt, ?string $endsAt, int $id = 0): ?int
    {
        $conflict = Db::table('marketing_longstay_tier')->where('site_id', $siteId)->where('property_id', $propertyId)
            ->where('id', '<>', $id)->where('status', 1)->whereNull('deleted_at')
            ->where(function ($q) use ($source, $minNights, $maxNights) {
                $q->where('offer_source', '<>', $source)->orWhere(function ($q) use ($minNights, $maxNights) {
                    $q->where('min_nights', '<=', $maxNights)->where('max_nights', '>=', $minNights);
                });
            });
        if ($startsAt) $conflict->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', $startsAt));
        if ($endsAt) $conflict->where(fn ($q) => $q->whereNull('starts_at')->orWhere('starts_at', '<', $endsAt));
        $conflictId = $conflict->value('id');
        return $conflictId === null ? null : (int) $conflictId;
    }

    public static function activeTiers(int $siteId, array $propertyIds): array
    {
        if ($propertyIds === []) return [];
        $now = gmdate('Y-m-d H:i:s');
        return Db::table('marketing_longstay_tier')->where('site_id', $siteId)
            ->where('status', 1)->whereNull('deleted_at')
            ->whereIn('property_id', $propertyIds)
            ->where('min_nights', '>=', 1)
            ->where('discount_rate', '>', 0)->where('discount_rate', '<', 100)
            ->where(static fn ($query) => $query->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(static fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>', $now))
            ->orderByDesc('priority')->orderByDesc('min_nights')->orderBy('id')->get()
            ->map(static fn ($row) => (array) $row)->all();
    }

    public static function tier(array $tiers, int $propertyId, int $nights): ?array
    {
        foreach ($tiers as $tier) {
            if ((int) $tier['property_id'] === $propertyId && (int) $tier['min_nights'] <= $nights
                && $nights <= (int) ($tier['max_nights'] ?? self::ORDINARY_NIGHTS)) {
                return $tier;
            }
        }
        return null;
    }

    public static function discount(?array $tier, float $original): float
    {
        return $tier === null ? 0.0 : round($original * (float) $tier['discount_rate'] / 100, 2);
    }

    public static function fundingSnapshot(?array $tier, float $discount): ?string
    {
        if (! $tier || $discount <= 0) return null;
        $pct = (float) $tier['platform_funding_pct'];
        $platform = round($discount * $pct / 100, 2);
        return json_encode(['tierId' => (int) $tier['id'], 'source' => $tier['offer_source'],
            'platformPct' => $pct, 'platformAmount' => $platform, 'merchantAmount' => round($discount - $platform, 2)], JSON_THROW_ON_ERROR);
    }

    /** Coupons retain their own combination rules when a long-stay discount applies. */
    public static function allowsCoupon(?array $tier, array $coupon): bool
    {
        return $tier === null || (bool) ($coupon['stackable'] ?? false);
    }
}
