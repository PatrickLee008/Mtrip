<?php
declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Hyperf\DbConnection\Db;

/** Shared by admin preview and consumer reads. Published snapshots contain configuration, never KYC/name snapshots. */
final class MarketplaceReader
{
    public static function group(array $row): int
    {
        return ! empty($row['pinned']) ? 0 : (! empty($row['featured']) ? 1 : 2);
    }

    public static function ordered(array $rows): array
    {
        usort($rows, static fn ($a, $b) => (self::group($a) <=> self::group($b))
            ?: ((int) $a['rank'] <=> (int) $b['rank']) ?: ((int) $a['id'] <=> (int) $b['id']));
        return $rows;
    }

    public static function properties(array $scope): array
    {
        return Db::table('merchant_store as s')
            ->join('merchant_info as m', 'm.id', '=', 's.merchant_id')
            ->join('merchant_application_business as b', 'b.id', '=', 's.source_business_id')
            ->join('merchant_application as a', 'a.id', '=', 'b.application_id')
            ->where('s.site_id', $scope['site_id'])->where('m.site_id', $scope['site_id'])
            ->where('b.site_id', $scope['site_id'])->where('a.site_id', $scope['site_id'])
            ->whereColumn('a.merchant_id', 's.merchant_id')
            ->where('s.business_type', 'hotel')->where('b.business_type', 'hotel')
            ->where('s.country_code', $scope['country_code'])->where('s.city_key', $scope['market_key'])
            ->whereNull('s.deleted_at')->whereNull('m.deleted_at')->whereNull('a.deleted_at')
            ->select(['s.id', 's.merchant_id', 's.source_business_id', 's.store_name', 's.mapping_version',
                's.display_enabled', 's.status as property_status', 'm.status as merchant_status',
                'm.merchant_name', 'b.business_name', 'b.kyc_status'])
            ->selectRaw('(SELECT COUNT(*) FROM merchant_blacklist bl WHERE bl.merchant_id=m.id AND bl.status=1) as blacklisted')
            ->orderBy('s.id')->get()->map(static fn ($r) => (array) $r)->keyBy('id')->all();
    }

    public static function qualified(array $property, bool $requireDisplay = true): bool
    {
        return (int) $property['merchant_status'] === 3 && (int) $property['property_status'] === 1
            && (int) $property['kyc_status'] === 1 && ! $property['blacklisted']
            && (! $requireDisplay || (int) $property['display_enabled'] === 1);
    }

    public static function listings(array $configs, array $scope, bool $eligibleOnly = true): array
    {
        if ($configs === []) return [];
        $properties = self::properties($scope);
        $goods = Db::table('goods_info')->where('site_id', $scope['site_id'])->where('goods_type', 1)
            ->whereIn('id', array_column($configs, 'goods_id'))->whereNull('deleted_at')
            ->select(['id', 'merchant_id', 'status', 'goods_name', 'goods_brief', 'cover_image', 'address',
                'goods_type', 'category_id', 'star_level', 'sales_count', 'longitude', 'latitude', 'is_hot', 'is_recommend'])
            ->selectRaw('(SELECT MIN(base_price) FROM hotel_room_type r WHERE r.goods_id=goods_info.id AND r.site_id=goods_info.site_id AND r.status=1 AND r.publish_status=2 AND r.deleted_at IS NULL) as minPrice')
            ->selectRaw('(SELECT MIN(base_price_citizen) FROM hotel_room_type r WHERE r.goods_id=goods_info.id AND r.site_id=goods_info.site_id AND r.status=1 AND r.publish_status=2 AND r.deleted_at IS NULL AND r.base_price_citizen>0) as minPriceCitizen')
            ->selectRaw('(SELECT COALESCE(AVG(rating),0) FROM goods_review r WHERE r.goods_id=goods_info.id AND r.site_id=goods_info.site_id AND r.status=1 AND r.deleted_at IS NULL) as rating')
            ->selectRaw('(SELECT COUNT(*) FROM goods_review r WHERE r.goods_id=goods_info.id AND r.site_id=goods_info.site_id AND r.status=1 AND r.deleted_at IS NULL) as review_count')
            ->get()->map(static fn ($r) => (array) $r)->keyBy('id')->all();
        $result = [];
        foreach (self::ordered($configs) as $config) {
            $p = $properties[$config['property_id']] ?? null;
            $g = $goods[$config['goods_id']] ?? null;
            $eligible = $p && $g && self::qualified($p) && (int) $g['status'] === 3
                && (int) $g['merchant_id'] === (int) $p['merchant_id']
                && (int) $config['business_id'] === (int) $p['source_business_id'];
            if ($eligibleOnly && (! $eligible || (int) $config['status'] !== 1)) continue;
            $result[] = array_merge($config, [
                'business_name' => $p['business_name'] ?? '', 'merchant_name' => $p['merchant_name'] ?? '',
                'merchant_id' => $p['merchant_id'] ?? 0, 'property_name' => $p['store_name'] ?? '',
                'eligible' => (bool) $eligible, 'kyc_status' => $p['kyc_status'] ?? null,
                'merchant_status' => $p['merchant_status'] ?? null, 'display_enabled' => $p['display_enabled'] ?? 0,
                'rating' => (float) ($g['rating'] ?? 0), 'price_from' => $g['minPrice'] ?? null,
                'goods' => $g,
            ]);
        }
        return $result;
    }

    /** Consumer-safe fields only; same projection and ordering for preview and live. */
    public static function render(array $configs, array $scope): array
    {
        if ($scope['entity_type'] === 'destination') {
            return array_values(array_filter(self::ordered($configs), static fn ($r) => (int) $r['status'] === 1));
        }
        return array_map(static function ($row) use ($scope) {
            $goods = $row['goods'];
            unset($goods['merchant_id'], $goods['status']);
            $goods['minPrice'] = (float) ($goods['minPrice'] ?? 0);
            $goods['minPriceCitizen'] = (float) ($goods['minPriceCitizen'] ?? $goods['minPrice']);
            $goods['rating'] = (float) $goods['rating'];
            $goods['reviewCount'] = (int) $goods['review_count'];
            unset($goods['review_count']);
            $goods['is_recommend'] = (int) $row['featured'];
            return $goods + ['ranking_id' => $row['id'], 'rank' => $row['rank'], 'pinned' => $row['pinned'],
                'featured' => $row['featured'], 'country_code' => $scope['country_code'], 'city_key' => $scope['market_key']];
        }, self::listings($configs, $scope));
    }

    public static function published(int $siteId, string $type, string $country = '', string $key = ''): array
    {
        $query = Db::table('ranking_market')->where('site_id', $siteId)->where('entity_type', $type)->where('published_version', '>', 0);
        if ($type === 'listing') $query->where('business_type', 'hotel');
        if ($country !== '') $query->where('country_code', strtoupper($country));
        if ($key !== '') $query->where('market_key', mb_strtolower(trim(preg_replace('/\s+/u', ' ', $key))));
        $result = [];
        // No cross-market rank competition: deterministic market order, then each market's own groups.
        foreach ($query->orderBy('country_code')->orderBy('market_key')->orderBy('id')->get() as $market) {
            $result = array_merge($result, self::render(json_decode($market->published_json ?? '[]', true), (array) $market));
        }
        return $result;
    }
}
