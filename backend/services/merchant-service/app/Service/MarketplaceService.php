<?php
declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MarketplaceReader;

final class MarketplaceService
{
    public function scope(array $input, string $type): array
    {
        $site = AdminContext::scopeSiteId((int) ($input['siteId'] ?? 0));
        $country = strtoupper(trim((string) ($input['countryCode'] ?? '')));
        $key = mb_strtolower(trim(preg_replace('/\s+/u', ' ', (string) ($input[$type === 'listing' ? 'cityKey' : 'region'] ?? ''))));
        if (! in_array($type, ['listing', 'destination'], true) || ! $site || $site < 1 || $key === '' || mb_strlen($key) > 80
            || ($type === 'listing' && (($input['businessType'] ?? 'hotel') !== 'hotel' || ! preg_match('/^[A-Z]{2}$/D', $country)))) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择明确的站点及酒店国家/城市或目的地区域');
        }
        return ['site_id' => $site, 'entity_type' => $type, 'business_type' => $type === 'listing' ? 'hotel' : '',
            'country_code' => $type === 'listing' ? $country : '', 'market_key' => $key];
    }

    public function table(string $type): string
    {
        return $type === 'listing' ? 'ranking_listing' : 'ranking_destination';
    }

    public function rows(array $market): array
    {
        return Db::table($this->table($market['entity_type']))->where('market_id', $market['id'])->whereNull('deleted_at')
            ->get()->map(static fn ($r) => (array) $r)->all();
    }

    private function nextNormalRank(array $market): int
    {
        $ranks = array_column(array_filter($this->rows($market), static fn ($r) => MarketplaceReader::group($r) === 2), 'rank');
        return ($ranks ? (int) max($ranks) : 0) + 1;
    }

    /** Destination copy is snapshotted; listing snapshots only contain real IDs and configuration. */
    public function configs(array $rows, string $type): array
    {
        $fields = $type === 'listing' ? ['id', 'property_id', 'goods_id', 'business_id', 'rank', 'pinned', 'featured', 'status']
            : ['id', 'name', 'region', 'tagline', 'image_url', 'country_code', 'city_key', 'rank', 'featured', 'status'];
        return MarketplaceReader::ordered(array_map(static fn ($r) => array_intersect_key($r, array_flip($fields)), $rows));
    }

    public function read(array $scope): array
    {
        $market = (array) Db::table('ranking_market')->where($scope)->first();
        $rows = $market ? $this->rows($market) : [];
        return ['list' => $scope['entity_type'] === 'listing' ? MarketplaceReader::listings($rows, $scope, false) : MarketplaceReader::ordered($rows),
            'market' => array_diff_key($market ?: ($scope + ['version' => 0, 'published_version' => 0]), ['published_json' => true])];
    }

    public function preview(array $scope, bool $published): array
    {
        $market = (array) Db::table('ranking_market')->where($scope)->first();
        $configs = ! $market ? [] : ($published ? json_decode($market['published_json'] ?? '[]', true)
            : $this->configs($this->rows($market), $scope['entity_type']));
        return ['list' => MarketplaceReader::render($configs, $scope), 'version' => (int) ($market[$published ? 'published_version' : 'version'] ?? 0)];
    }

    public function candidates(array $scope): array
    {
        $properties = array_values(MarketplaceReader::properties($scope));
        $goods = Db::table('goods_info')->where('site_id', $scope['site_id'])->where('goods_type', 1)
            ->whereIn('merchant_id', array_column($properties, 'merchant_id'))->where('status', 3)->whereNull('deleted_at')
            ->orderBy('id')->get(['id', 'merchant_id', 'goods_name'])->map(static fn ($r) => (array) $r)->all();
        return ['properties' => $properties, 'goods' => $goods];
    }

    private function authorize(string $permission): void
    {
        if (! AdminContext::isSuper() || ! AdminContext::hasPermission($permission)) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅授权超级管理员可维护市场展示');
        }
    }

    /** All draft writes, publish and history are atomic under the exact market's row lock. */
    private function mutate(array $scope, array $input, string $action, string $permission, callable $change): array
    {
        $this->authorize($permission);
        $version = filter_var($input['expectedVersion'] ?? null, FILTER_VALIDATE_INT);
        $note = trim((string) ($input['note'] ?? ''));
        if ($version === false || $version < 0 || $note === '' || mb_strlen($note) > 255) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '必须提供有效版本及1-255字操作原因');
        }
        return Db::transaction(function () use ($scope, $version, $note, $action, $change) {
            // Re-inserting an existing unique key takes a shared lock; two writers upgrading it
            // to FOR UPDATE can deadlock. Existing markets go straight to the exclusive lock.
            if (! Db::table('ranking_market')->where($scope)->exists()) Db::table('ranking_market')->insertOrIgnore($scope);
            $market = (array) Db::table('ranking_market')->where($scope)->lockForUpdate()->first();
            if ((int) $market['version'] !== $version) throw new BusinessException(ErrorCode::DATA_CONFLICT, '市场版本已变化，请刷新后重试');
            $before = $this->configs($this->rows($market), $scope['entity_type']);
            $extra = $change($market) ?? [];
            $after = $this->configs($this->rows($market), $scope['entity_type']);
            $updates = ['version' => $version + 1, 'updated_by' => AdminContext::adminName(), 'updated_at' => date('Y-m-d H:i:s')];
            if ($action === 'publish') {
                if ($scope['entity_type'] === 'listing') {
                    $visible = array_values(array_filter($after, static fn ($r) => (int) $r['status'] === 1));
                    if (count(MarketplaceReader::listings($visible, $scope)) !== count($visible)) {
                        throw new BusinessException(ErrorCode::DATA_CONFLICT, '存在失去展示资格的酒店，请禁用其草稿展示后再发布');
                    }
                }
                $updates += ['published_json' => json_encode($after, JSON_UNESCAPED_UNICODE), 'published_version' => $version + 1,
                    'published_by' => AdminContext::adminName(), 'published_at' => date('Y-m-d H:i:s')];
            }
            Db::table('ranking_market')->where('id', $market['id'])->update($updates);
            Db::table('ranking_history')->insert([
                'site_id' => $scope['site_id'], 'market_id' => $market['id'], 'entity_type' => $scope['entity_type'],
                'entity_name' => $scope['market_key'], 'action' => $action, 'version' => $version + 1, 'note' => $note,
                'before_json' => json_encode($action === 'publish' ? json_decode($market['published_json'] ?? '[]', true) : $before, JSON_UNESCAPED_UNICODE),
                'after_json' => json_encode($after, JSON_UNESCAPED_UNICODE),
                'operator_id' => AdminContext::adminId(), 'operator_name' => AdminContext::adminName(),
            ]);
            return $extra + ['version' => $version + 1];
        });
    }

    public function addListing(array $scope, array $input): array
    {
        return $this->mutate($scope, $input, 'bind_hotel', 'merchant:property:bind', function ($market) use ($scope, $input) {
            $propertyId = (int) ($input['propertyId'] ?? 0);
            $goodsId = (int) ($input['goodsId'] ?? 0);
            Db::table('merchant_store')->where('id', $propertyId)->where('site_id', $scope['site_id'])->lockForUpdate()->first();
            Db::table('goods_info')->where('id', $goodsId)->where('site_id', $scope['site_id'])->lockForUpdate()->first();
            $property = MarketplaceReader::properties($scope)[$propertyId] ?? null;
            $goods = Db::table('goods_info')->where('id', $goodsId)->where('site_id', $scope['site_id'])
                ->where('goods_type', 1)->where('status', 3)->whereNull('deleted_at')->first();
            if (! $property || ! MarketplaceReader::qualified($property) || ! $goods || (int) $goods->merchant_id !== (int) $property['merchant_id']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '必须显式选择同一商户且已获展示资格的酒店物业与已上架酒店商品');
            }
            if (Db::table('ranking_listing')->where('property_id', $propertyId)->orWhere('goods_id', $goodsId)->exists()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '物业或酒店商品已有关联，禁止重复或跨市场复用');
            }
            $id = Db::table('ranking_listing')->insertGetId(['market_id' => $market['id'], 'site_id' => $scope['site_id'],
                'property_id' => $propertyId, 'goods_id' => $goodsId, 'business_id' => $property['source_business_id'],
                'business_type' => 'hotel', 'merchant_id' => $property['merchant_id'], 'city' => $scope['market_key'],
                'rank' => $this->nextNormalRank($market), 'status' => 1]);
            return ['id' => $id];
        });
    }

    public function reorder(array $scope, array $input): array
    {
        return $this->mutate($scope, $input, 'reorder', 'merchant:ranking:save', function ($market) use ($input) {
            $ids = $input['ids'] ?? [];
            if (! is_array($ids) || $ids === []) throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择完整组内条目');
            foreach ($ids as $id) if (! is_int($id) || $id < 1) throw new BusinessException(ErrorCode::PARAM_ERROR, '无效条目ID');
            $rows = $this->rows($market);
            $first = array_values(array_filter($rows, static fn ($r) => (int) $r['id'] === $ids[0]))[0] ?? null;
            if (! $first) throw new BusinessException(ErrorCode::DATA_CONFLICT, '条目不属于本市场');
            $group = array_filter($rows, static fn ($r) => MarketplaceReader::group($r) === MarketplaceReader::group($first));
            if ($market['entity_type'] === 'listing') {
                $visible = array_values(array_filter($group, static fn ($r) => (int) $r['status'] === 1));
                if (count(MarketplaceReader::listings($visible, $market)) !== count($visible)) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '组内有失去资格的酒店，请先隐藏其草稿展示');
                }
            }
            $expected = array_map('intval', array_column($group, 'id'));
            $sorted = $ids;
            sort($sorted); sort($expected);
            if ($sorted !== $expected) throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅允许完整同组排序，不得跨市场、跨组、重复或遗漏条目');
            foreach ($ids as $index => $id) Db::table($this->table($market['entity_type']))->where('id', $id)->update(['rank' => $index + 1]);
        });
    }

    public function flags(array $scope, array $input): array
    {
        return $this->mutate($scope, $input, 'display_flags', 'merchant:ranking:save', function ($market) use ($input) {
            $table = $this->table($market['entity_type']);
            $row = (array) Db::table($table)->where('market_id', $market['id'])->where('id', (int) ($input['id'] ?? 0))->whereNull('deleted_at')->first();
            if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND, '本市场条目不存在');
            $data = [];
            foreach (['pinned', 'featured', 'status'] as $key) {
                if (! array_key_exists($key, $input)) continue;
                $allowed = $key === 'status' ? [1, 2] : [0, 1];
                if (($key === 'pinned' && $market['entity_type'] !== 'listing') || ! in_array($input[$key], $allowed, true)) {
                    throw new BusinessException(ErrorCode::PARAM_ERROR, '无效展示标记');
                }
                $data[$key] = $input[$key];
            }
            if (! $data) throw new BusinessException(ErrorCode::PARAM_ERROR, '没有展示变更');
            $new = array_merge($row, $data);
            if ($market['entity_type'] === 'listing' && (int) $new['status'] === 1 && MarketplaceReader::listings([$new], $market) === []) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '酒店当前不具备展示资格');
            }
            if (MarketplaceReader::group($new) !== MarketplaceReader::group($row)) {
                $ranks = array_column(array_filter($this->rows($market), static fn ($r) => MarketplaceReader::group($r) === MarketplaceReader::group($new)), 'rank');
                $data['rank'] = ($ranks ? max($ranks) : 0) + 1;
            }
            Db::table($table)->where('id', $row['id'])->update($data);
        });
    }

    public function destination(array $scope, array $input, bool $create): array
    {
        return $this->mutate($scope, $input, $create ? 'add' : 'update', 'merchant:ranking:add', function ($market) use ($scope, $input, $create) {
            $name = trim((string) ($input['name'] ?? ''));
            $tagline = trim((string) ($input['tagline'] ?? ''));
            $image = trim((string) ($input['imageUrl'] ?? ''));
            $country = strtoupper(trim((string) ($input['destinationCountry'] ?? '')));
            $city = mb_strtolower(trim(preg_replace('/\s+/u', ' ', (string) ($input['destinationCity'] ?? ''))));
            if ($name === '' || mb_strlen($name) > 100 || mb_strlen($tagline) > 200 || mb_strlen($image) > 500
                || ($image !== '' && (! filter_var($image, FILTER_VALIDATE_URL) || ! in_array(strtolower(parse_url($image, PHP_URL_SCHEME) ?? ''), ['http', 'https'], true)))
                || ! preg_match('/^[A-Z]{2}$/D', $country) || $city === '' || mb_strlen($city) > 80) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '目的地名称、图片或酒店搜索国家/城市无效');
            }
            $data = ['name' => $name, 'tagline' => $tagline, 'image_url' => $image, 'country_code' => $country, 'city_key' => $city,
                'last_updated_by' => AdminContext::adminId()];
            if ($create) {
                $id = Db::table('ranking_destination')->insertGetId($data + ['market_id' => $market['id'], 'site_id' => $scope['site_id'],
                    'region' => $scope['market_key'], 'rank' => $this->nextNormalRank($market)]);
            } else {
                $id = (int) ($input['id'] ?? 0);
                $query = Db::table('ranking_destination')->where('id', $id)->where('market_id', $market['id'])->whereNull('deleted_at');
                if (! $query->exists()) throw new BusinessException(ErrorCode::NOT_FOUND, '本区域目的地不存在');
                $query->update($data);
            }
            return ['id' => $id];
        });
    }

    public function publish(array $scope, array $input): array
    {
        return $this->mutate($scope, $input, 'publish', 'merchant:ranking:publish', static fn () => []);
    }

    /** Live qualification gate, deliberately separate from draft ranking flags. */
    public function propertyDisplay(array $scope, array $input): array
    {
        $this->authorize('merchant:property:bind');
        $enabled = $input['displayEnabled'] ?? null;
        $version = filter_var($input['expectedPropertyVersion'] ?? null, FILTER_VALIDATE_INT);
        $note = trim((string) ($input['note'] ?? ''));
        if (! in_array($enabled, [0, 1], true) || $version === false || $version < 0 || $note === '' || mb_strlen($note) > 500) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '展示资格、物业版本或原因无效');
        }
        return Db::transaction(function () use ($scope, $input, $enabled, $version, $note) {
            $id = (int) ($input['propertyId'] ?? 0);
            $locked = Db::table('merchant_store')->where('id', $id)->where('site_id', $scope['site_id'])->lockForUpdate()->first();
            $p = MarketplaceReader::properties($scope)[$id] ?? null;
            if (! $locked || ! $p) throw new BusinessException(ErrorCode::NOT_FOUND, '本市场物业不存在');
            if ((int) $locked->mapping_version !== $version || ($enabled === 1 && ! MarketplaceReader::qualified($p, false))) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '物业版本变化或尚不具备展示资格');
            }
            $data = ['display_enabled' => $enabled, 'mapping_version' => $version + 1];
            Db::table('merchant_store')->where('id', $id)->update($data);
            Db::table('merchant_property_history')->insert(['site_id' => $scope['site_id'], 'merchant_id' => $p['merchant_id'],
                'store_id' => $id, 'source_business_id' => $p['source_business_id'], 'version' => $version + 1,
                'before_json' => json_encode(['display_enabled' => $p['display_enabled'], 'mapping_version' => $version]),
                'after_json' => json_encode($data), 'note' => $note,
                'actor_id' => AdminContext::adminId(), 'actor_name' => AdminContext::adminName()]);
            return $data;
        });
    }
}
