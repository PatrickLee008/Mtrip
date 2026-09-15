<?php
declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Hyperf\DbConnection\Db;

/** Shared by admin preview and consumer reads. Published ranking snapshots contain Property IDs only. */
final class MarketplaceReader
{
    public static function group(array $row): int
    {
        return ! empty($row['pinned']) ? 0 : (! empty($row['featured']) ? 1 : 2);
    }

    public static function ordered(array $rows): array
    {
        usort($rows, static fn ($a, $b) => (self::group($a) <=> self::group($b))
            ?: ((int) $a['rank'] <=> (int) $b['rank']) ?: ((int) $a['id'] <=> (int) $b['id'])
            ?: ((int) ($a['property_id'] ?? 0) <=> (int) ($b['property_id'] ?? 0)));
        return $rows;
    }

    public static function properties(array $scope): array
    {
        $query = Db::table('merchant_store as s')
            ->join('merchant_info as m', 'm.id', '=', 's.merchant_id')
            ->where('s.site_id', $scope['site_id'])->where('m.site_id', $scope['site_id'])
            ->where('s.business_type', 'hotel')
            ->whereNull('s.deleted_at')->whereNull('m.deleted_at');
        if (($scope['country_code'] ?? '') !== '') $query->where('s.country_code', $scope['country_code']);
        if (($scope['market_key'] ?? '') !== '') $query->where('s.city_key', $scope['market_key']);
        return $query
            ->select([
                's.id', 's.merchant_id', 's.source_business_id', 's.store_name', 's.address', 's.country_code', 's.city_key',
                's.longitude', 's.latitude',
                's.images', 's.description', 's.star_level', 's.facilities', 's.website',
                's.checkin_time', 's.checkout_time', 's.mapping_version', 's.display_enabled',
                's.status as property_status', 's.kyc_status', 's.content_status', 's.content_approved_version', 's.publish_status',
                's.operating_status', 'm.status as merchant_status', 'm.merchant_name',
            ])
            ->selectRaw('(SELECT COUNT(*) FROM merchant_blacklist bl WHERE bl.merchant_id=m.id AND bl.status=1) as blacklisted')
            ->selectRaw('(SELECT COUNT(*) FROM hotel_room_type r WHERE r.property_id=s.id AND r.site_id=s.site_id AND r.status=1 AND r.publish_status=2 AND r.approved_version>0 AND r.deleted_at IS NULL) as room_count')
            ->selectRaw('(SELECT MIN(base_price) FROM hotel_room_type r WHERE r.property_id=s.id AND r.site_id=s.site_id AND r.status=1 AND r.publish_status=2 AND r.approved_version>0 AND r.deleted_at IS NULL) as min_price')
            ->selectRaw('(SELECT MIN(base_price_citizen) FROM hotel_room_type r WHERE r.property_id=s.id AND r.site_id=s.site_id AND r.status=1 AND r.publish_status=2 AND r.approved_version>0 AND r.deleted_at IS NULL AND r.base_price_citizen>0) as min_price_citizen')
            ->selectRaw('(SELECT COALESCE(AVG(rating),0) FROM goods_review r WHERE r.property_id=s.id AND r.site_id=s.site_id AND r.status=1 AND r.deleted_at IS NULL) as rating')
            ->selectRaw('(SELECT COUNT(*) FROM goods_review r WHERE r.property_id=s.id AND r.site_id=s.site_id AND r.status=1 AND r.deleted_at IS NULL) as review_count')
            ->selectRaw('(SELECT COUNT(*) FROM order_main o WHERE o.property_id=s.id AND o.site_id=s.site_id AND o.order_type=1 AND o.order_status IN (1,2,3) AND o.deleted_at IS NULL) as sales_count')
            ->selectRaw('(SELECT COUNT(*) FROM hotel_room_type r WHERE r.property_id=s.id AND r.site_id=s.site_id AND r.breakfast>0 AND r.status=1 AND r.publish_status=2 AND r.approved_version>0 AND r.deleted_at IS NULL) as breakfast_room_count')
            ->selectRaw('(SELECT COUNT(*) FROM goods_refund_rule r WHERE r.property_id=s.id AND r.site_id=s.site_id AND r.rule_type=1 AND r.deleted_at IS NULL) as free_cancel_rule_count')
            ->orderBy('s.id')->get()->map(static fn ($r) => (array) $r)->keyBy('id')->all();
    }

    public static function qualified(array $property, bool $requireDisplay = true): bool
    {
        return (int) $property['merchant_status'] === 3 && (int) $property['property_status'] === 1
            && (int) $property['kyc_status'] === 1 && (int) $property['content_status'] === 2
            && (int) ($property['content_approved_version'] ?? 0) > 0
            && (int) $property['publish_status'] === 1 && (int) $property['operating_status'] === 1
            && (int) ($property['room_count'] ?? 0) > 0 && ! $property['blacklisted']
            && (! $requireDisplay || (int) $property['display_enabled'] === 1);
    }

    public static function listings(array $configs, array $scope, bool $eligibleOnly = true): array
    {
        if ($configs === []) return [];
        $properties = self::properties($scope);
        $result = [];
        foreach (self::ordered($configs) as $config) {
            $rankingId = (int) $config['id'];
            $property = $properties[$config['property_id']] ?? null;
            $eligible = $property && self::qualified($property);
            if ($eligibleOnly && (! $eligible || (int) $config['status'] !== 1)) continue;
            $result[] = array_merge($config, $property ?? [], [
                'id' => $rankingId,
                'property_id' => (int) $config['property_id'],
                'property_name' => $property['store_name'] ?? '',
                'eligible' => (bool) $eligible,
            ]);
        }
        return $result;
    }

    /** Consumer-safe property fields only; draft and merchant data never leave this projection. */
    public static function render(array $configs, array $scope): array
    {
        if ($scope['entity_type'] === 'destination') {
            return array_values(array_filter(self::ordered($configs), static fn ($r) => (int) $r['status'] === 1));
        }
        return self::renderListings(self::listings($configs, $scope), $scope);
    }

    private static function renderListings(array $rows, array $scope): array
    {
        return array_map(static function (array $row) use ($scope): array {
            $images = self::jsonList($row['images'] ?? null);
            $minPrice = (float) ($row['min_price'] ?? 0);
            $citizenPrice = (float) ($row['min_price_citizen'] ?? 0);
            return [
                'id' => (int) $row['property_id'],
                'property_id' => (int) $row['property_id'],
                'property_name' => (string) $row['property_name'],
                'description' => (string) ($row['description'] ?? ''),
                'cover_image' => is_string($images[0] ?? null) ? $images[0] : '',
                'address' => (string) ($row['address'] ?? ''),
                'longitude' => $row['longitude'] ?? null,
                'latitude' => $row['latitude'] ?? null,
                'star_level' => (int) ($row['star_level'] ?? 0),
                'sales_count' => (int) ($row['sales_count'] ?? 0),
                'minPrice' => $minPrice,
                'minPriceCitizen' => $citizenPrice > 0 ? $citizenPrice : $minPrice,
                'rating' => (float) ($row['rating'] ?? 0),
                'reviewCount' => (int) ($row['review_count'] ?? 0),
                'hasBreakfast' => (int) ($row['breakfast_room_count'] ?? 0) > 0,
                'freeCancel' => (int) ($row['free_cancel_rule_count'] ?? 0) > 0,
                'facilities' => self::jsonList($row['facilities'] ?? null),
                'ranking_id' => (int) $row['id'],
                'rank' => (int) $row['id'] > 0 ? (int) $row['rank'] : 0,
                'pinned' => (int) $row['pinned'],
                'featured' => (int) $row['featured'],
                'country_code' => (string) ($row['country_code'] ?? $scope['country_code']),
                'city_key' => (string) ($row['city_key'] ?? $scope['market_key']),
            ];
        }, $rows);
    }

    public static function published(int $siteId, string $type, string $country = '', string $key = ''): array
    {
        $query = Db::table('ranking_market')->where('site_id', $siteId)->where('entity_type', $type)->where('published_version', '>', 0);
        if ($type === 'listing') $query->where('business_type', 'hotel');
        if ($country !== '') $query->where('country_code', strtoupper($country));
        if ($key !== '') $query->where('market_key', mb_strtolower(trim(preg_replace('/\s+/u', ' ', $key))));
        $result = [];
        foreach ($query->orderBy('country_code')->orderBy('market_key')->orderBy('id')->get() as $market) {
            $result = array_merge($result, self::render(json_decode($market->published_json ?? '[]', true), (array) $market));
        }
        return $result;
    }

    /** Ordinary hotel search starts from every qualified property; ranking only changes default order. */
    public static function searchable(int $siteId, string $country = '', string $key = ''): array
    {
        $scope = [
            'site_id' => $siteId,
            'entity_type' => 'listing',
            'country_code' => strtoupper(trim($country)),
            'market_key' => mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $key))),
        ];
        $properties = self::properties($scope);
        $ranking = [];
        foreach (self::publishedConfigs($siteId, $scope['country_code'], $scope['market_key']) as $config) {
            $propertyId = (int) ($config['property_id'] ?? 0);
            if ($propertyId > 0 && (int) ($config['status'] ?? 0) === 1 && ! isset($ranking[$propertyId])) {
                $ranking[$propertyId] = $config;
            }
        }
        $configs = [];
        foreach ($properties as $propertyId => $property) {
            if (! self::qualified($property)) continue;
            $config = $ranking[$propertyId] ?? [
                'id' => 0, 'property_id' => (int) $propertyId, 'rank' => PHP_INT_MAX,
                'pinned' => 0, 'featured' => 0, 'status' => 1,
            ];
            $configs[] = array_merge($config, $property, [
                'id' => (int) $config['id'], 'property_id' => (int) $propertyId,
                'property_name' => (string) $property['store_name'], 'eligible' => true,
            ]);
        }
        return self::renderListings(self::ordered($configs), $scope);
    }

    private static function publishedConfigs(int $siteId, string $country, string $key): array
    {
        $query = Db::table('ranking_market')->where('site_id', $siteId)
            ->where('entity_type', 'listing')->where('business_type', 'hotel')
            ->where('published_version', '>', 0);
        if ($country !== '') $query->where('country_code', $country);
        if ($key !== '') $query->where('market_key', $key);
        $configs = [];
        foreach ($query->orderBy('country_code')->orderBy('market_key')->orderBy('id')->get() as $market) {
            $rows = json_decode((string) ($market->published_json ?? '[]'), true);
            if (is_array($rows)) $configs = array_merge($configs, self::ordered($rows));
        }
        return $configs;
    }

    private static function jsonList(mixed $value): array
    {
        if (is_string($value)) $value = json_decode($value, true);
        return is_array($value) ? $value : [];
    }
}
