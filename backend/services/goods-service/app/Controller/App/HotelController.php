<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Support\RoomDefaults;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MarketplaceReader;
use Mtrip\Shared\Support\Result;

/** Consumer hotel reads use Property and room type IDs only. */
final class HotelController extends AbstractController
{
    /** 客户端筛选面板的住宿类型;物业表目前只有酒店一种业态,其余类型如实返回 0 条 */
    private const PROPERTY_TYPES = ['hotel', 'homesApts', 'hostels', 'hourly'];

    /** 住客评分档位(/10 制,与客户端评价页一致;库里 rating 是 /5 制) */
    private const SCORE_LEVELS = [9, 8, 7, 6];

    public function list(): array
    {
        $siteId = $this->requireSiteId();
        [$page, $pageSize] = $this->pageParams();
        $citizen = $this->intInput('citizen') === 1;
        $star = $this->intInput('starLevel');
        $stars = array_map('intval', $this->csvInput('starLevels'));
        $min = $this->floatInput('priceMin');
        $max = $this->floatInput('priceMax');
        $score = $this->floatInput('reviewScore');
        $amenities = array_map([self::class, 'tag'], $this->csvInput('amenities'));
        $features = array_map([self::class, 'tag'], $this->csvInput('roomFeatures'));
        $beds = array_map([self::class, 'tag'], $this->csvInput('bedTypes'));
        $types = $this->csvInput('propertyTypes');
        $cities = array_map('mb_strtolower', $this->csvInput('cities'));
        $breakfast = $this->intInput('breakfast') === 1;
        $freeCancel = $this->intInput('freeCancel') === 1;

        /* 组内:星级/床型/类型/城市任一命中即可,设施与房间特色须全部具备;组间一律取交集 */
        $rows = array_values(array_filter($this->searchRows($siteId), static function (array $row) use ($citizen, $star, $stars, $min, $max, $score, $amenities, $features, $beds, $types, $cities, $breakfast, $freeCancel): bool {
            $price = (float) ($citizen ? $row['minPriceCitizen'] : $row['minPrice']);
            if ($star > 0 && (int) $row['star_level'] !== $star) return false;
            if ($stars !== [] && ! in_array((int) $row['star_level'], $stars, true)) return false;
            if ($min > 0 && $price < $min) return false;
            if ($max > 0 && $price > $max) return false;
            if ($score > 0 && (float) $row['rating'] < $score) return false;
            if ($breakfast && ! $row['hasBreakfast']) return false;
            if ($freeCancel && ! $row['freeCancel']) return false;
            if ($types !== [] && ! in_array($row['_tags']['type'], $types, true)) return false;
            if ($cities !== [] && ! in_array($row['_tags']['city'], $cities, true)) return false;
            if ($beds !== [] && array_intersect($beds, array_keys($row['_tags']['beds'])) === []) return false;
            foreach ($amenities as $amenity) if (! isset($row['_tags']['amenities'][$amenity])) return false;
            foreach ($features as $feature) if (! isset($row['_tags']['features'][$feature])) return false;
            return true;
        }));

        $sort = $this->strInput('sortBy');
        $lat = $this->floatInput('lat');
        $lng = $this->floatInput('lng');
        if ($sort !== '' && $sort !== 'default') {
            usort($rows, static function (array $a, array $b) use ($sort, $lat, $lng): int {
                return match ($sort) {
                    'price_asc' => $a['minPrice'] <=> $b['minPrice'],
                    'price_desc' => $b['minPrice'] <=> $a['minPrice'],
                    'star' => $b['star_level'] <=> $a['star_level'],
                    'rating' => $b['rating'] <=> $a['rating'],
                    'sales' => $b['sales_count'] <=> $a['sales_count'],
                    'distance' => self::distance($a, $lat, $lng) <=> self::distance($b, $lat, $lng),
                    default => $a['rank'] <=> $b['rank'],
                };
            });
        }
        $total = count($rows);
        $list = array_map(static function (array $row): array {
            unset($row['_tags']);
            return self::listAliases($row);
        }, array_slice($rows, ($page - 1) * $pageSize, $pageSize));
        return Result::page($list, $total, $page, $pageSize);
    }

    /**
     * 筛选面板的选项与计数:只按目的地/关键词圈定范围,不叠加其它筛选条件。
     * counts 的键与客户端选项键一致(star:4 / score:9 / type:hotel / breakfast / freeCancel);
     * 设施、床型、房间特色、城市的选项取自真实物业/房型数据,按命中物业数倒序。
     */
    public function filters(): array
    {
        $rows = $this->searchRows($this->requireSiteId());
        $counts = ['breakfast' => 0, 'freeCancel' => 0];
        foreach (range(1, 5) as $star) $counts['star:' . $star] = 0;
        foreach (self::SCORE_LEVELS as $level) $counts['score:' . $level] = 0;
        foreach (self::PROPERTY_TYPES as $type) $counts['type:' . $type] = 0;
        $groups = ['amenities' => [], 'beds' => [], 'features' => [], 'cities' => []];
        foreach ($rows as $row) {
            if (isset($counts['star:' . $row['star_level']])) ++$counts['star:' . $row['star_level']];
            foreach (self::SCORE_LEVELS as $level) if ((float) $row['rating'] * 2 >= $level) ++$counts['score:' . $level];
            ++$counts['type:' . $row['_tags']['type']];
            if ($row['hasBreakfast']) ++$counts['breakfast'];
            if ($row['freeCancel']) ++$counts['freeCancel'];
            $tags = $row['_tags'];
            foreach (['amenities' => $tags['amenities'], 'beds' => $tags['beds'], 'features' => $tags['features'],
                'cities' => $tags['city'] === '' ? [] : [$tags['city'] => ucwords($tags['city'])]] as $group => $items) {
                foreach ($items as $key => $label) {
                    $groups[$group][$key] ??= ['key' => $key, 'label' => $label, 'count' => 0];
                    ++$groups[$group][$key]['count'];
                }
            }
        }
        foreach ($groups as $group => $items) {
            $items = array_values($items);
            usort($items, static fn ($a, $b) => ($b['count'] <=> $a['count']) ?: strcmp($a['label'], $b['label']));
            $groups[$group] = $items;
        }
        return Result::success(['total' => count($rows), 'counts' => $counts] + $groups);
    }

    /**
     * 目的地 + 关键词圈定的可售物业,每行附带 `_tags`(仅供筛选,出参前剥掉):
     * type 住宿类型 / city 城市键 / amenities 物业设施 / beds 床型 / features 房间设施与景观,
     * 后三者都是「归一化键 => 展示名」,归一化规则见 tag()。
     */
    private function searchRows(int $siteId): array
    {
        $rows = MarketplaceReader::searchable($siteId, $this->strInput('countryCode'), $this->strInput('cityKey'));
        $keyword = mb_strtolower($this->strInput('keyword'));
        if ($keyword !== '') {
            $rows = array_values(array_filter($rows, static fn (array $row): bool => str_contains(mb_strtolower($row['property_name'] . ' ' . $row['address']), $keyword)));
        }
        $ids = array_column($rows, 'property_id');
        if ($ids === []) return [];

        $amenities = Db::table('merchant_store')->where('site_id', $siteId)->whereIn('id', $ids)
            ->pluck('amenities', 'id')->all();
        $rooms = Db::table('hotel_room_type')->where('site_id', $siteId)->whereIn('property_id', $ids)
            ->where('status', 1)->where('publish_status', 2)->where('approved_version', '>', 0)->whereNull('deleted_at')
            ->get(['property_id', 'bed_type', 'bedding', 'room_view', 'facilities']);
        $roomTags = [];
        foreach ($rooms as $room) {
            $pid = (int) $room->property_id;
            $roomTags[$pid] ??= ['beds' => [], 'features' => []];
            $beds = array_column($this->jsonList($room->bedding), 'type');
            $beds[] = (string) $room->bed_type;
            foreach ($beds as $bed) self::addTag($roomTags[$pid]['beds'], (string) $bed);
            foreach ($this->jsonList($room->facilities) as $facility) if (is_string($facility)) self::addTag($roomTags[$pid]['features'], $facility);
            self::addTag($roomTags[$pid]['features'], (string) $room->room_view);
        }

        foreach ($rows as &$row) {
            $pid = (int) $row['property_id'];
            $tags = [];
            foreach ($row['facilities'] as $facility) if (is_string($facility)) self::addTag($tags, $facility);
            foreach ($this->jsonList($amenities[$pid] ?? null) as $amenity) {
                if (is_array($amenity) && ($amenity['enabled'] ?? true) && is_string($amenity['name'] ?? null)) self::addTag($tags, $amenity['name']);
            }
            $row['_tags'] = [
                'type' => 'hotel',
                'city' => mb_strtolower((string) $row['city_key']),
                'amenities' => $tags,
                'beds' => $roomTags[$pid]['beds'] ?? [],
                'features' => $roomTags[$pid]['features'] ?? [],
            ];
        }
        unset($row);
        return $rows;
    }

    /**
     * 归一化键:小写、去掉非字母数字、去掉前缀 free ——
     * 物业设施里的「Free WiFi」、房型设施里的「wifi」、客户端 chip 的「Wifi」都落到 wifi。
     */
    private static function tag(string $label): string
    {
        $key = (string) preg_replace('/[^a-z0-9]/', '', mb_strtolower($label));
        return (string) preg_replace('/^free(?=.)/', '', $key);
    }

    /** 纯数字的旧床型编码(1/2)没有语义,不当作选项 */
    private static function addTag(array &$tags, string $label): void
    {
        $label = trim($label);
        $key = self::tag($label);
        if ($key === '' || ctype_digit($key) || isset($tags[$key])) return;
        $tags[$key] = strlen($key) <= 2 ? strtoupper($label) : ucfirst(str_replace('_', ' ', $label));
    }

    private function csvInput(string $key): array
    {
        return array_values(array_filter(array_map('trim', explode(',', $this->strInput($key))), 'strlen'));
    }

    public function detail(): array
    {
        $siteId = $this->requireSiteId();
        $propertyId = $this->requireId('propertyId');
        $summary = $this->publishedProperty($siteId, $propertyId);
        $property = (array) Db::table('merchant_store')->where('id', $propertyId)->where('site_id', $siteId)
            ->where('business_type', 'hotel')->whereNull('deleted_at')->first([
                'id', 'store_name', 'address', 'longitude', 'latitude', 'images', 'description', 'star_level',
                'facilities', 'website', 'checkin_time', 'checkout_time',
            ]);
        if ($property === []) throw new BusinessException(ErrorCode::NOT_FOUND, '酒店物业不存在');
        foreach (['images', 'facilities'] as $field) $property[$field] = $this->jsonList($property[$field] ?? null);

        $rooms = Db::table('hotel_room_type')->where('site_id', $siteId)->where('property_id', $propertyId)
            ->where('status', 1)->where('publish_status', 2)->where('approved_version', '>', 0)->whereNull('deleted_at')
            ->orderBy('sort')->orderBy('id')->get([
                'id', 'property_id', 'room_name', 'description', 'bed_type', 'bed_count', 'bedding', 'area', 'area_unit',
                'max_adults', 'max_children', 'max_guests', 'floor_name', 'room_view', 'smoking', 'breakfast', 'meal_plan',
                'cancellation_policy', 'currency', 'checkin_notes', 'base_price', 'weekend_price', 'extra_bed_price',
                'images', 'image_gallery', 'video_url', 'facilities', 'panorama', 'vr_tour', 'floor_plan', 'sort',
            ])->map(function ($row): array {
                $room = (array) $row;
                $room = \App\Service\RoomContentService::unpack($room);
                foreach (['panorama', 'vr_tour', 'floor_plan'] as $field) {
                    if (empty($room[$field]['enabled'])) unset($room[$field]);
                }
                $room['room_type_id'] = (int) $room['id'];
                return $room;
            })->all();
        $roomIds = array_column($rooms, 'id');
        $rules = $roomIds === [] ? [] : Db::table('goods_refund_rule')->where('site_id', $siteId)
            ->where('property_id', $propertyId)->where('sku_type', 1)->whereIn('sku_id', $roomIds)
            ->whereNull('deleted_at')->get(['id', 'sku_type', 'sku_id', 'rule_type', 'rules', 'remark'])
            ->map(function ($row): array {
                $rule = (array) $row;
                $rule['rules'] = $this->jsonList($rule['rules'] ?? null);
                return $rule;
            })->all();
        $detail = self::listAliases($summary) + $property;
        $detail['property_id'] = $propertyId;
        $detail['roomTypes'] = $rooms;
        $detail['skus'] = $rooms;
        $detail['refundRules'] = $rules;
        $detail['reviewSummary'] = ['rating' => $summary['rating'], 'count' => $summary['reviewCount']];
        $detail['goods_detail'] = $property['description'];
        $detail['open_time'] = $property['checkin_time'];
        $detail['close_time'] = $property['checkout_time'];
        return Result::success($detail);
    }

    public function reviews(): array
    {
        $siteId = $this->requireSiteId();
        $propertyId = $this->requireId('propertyId');
        $this->publishedProperty($siteId, $propertyId);
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('goods_review as r')->leftJoin('user_info as u', 'u.id', '=', 'r.user_id')
            ->where('r.site_id', $siteId)->where('r.property_id', $propertyId)
            ->where('r.status', 1)->whereNull('r.deleted_at');
        $total = (clone $query)->count();
        $list = $query->orderByDesc('r.id')->forPage($page, $pageSize)
            ->get(['r.id', 'r.rating', 'r.content', 'r.images', 'r.reply_content', 'r.created_at', 'u.nickname', 'u.avatar'])
            ->map(function ($row): array {
                $review = (array) $row;
                $review['images'] = $this->jsonList($review['images'] ?? null);
                $review['nickname'] = $review['nickname'] ?: '匿名用户';
                return $review;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    public function reviewAdd(): array
    {
        $siteId = $this->requireSiteId();
        $orderId = $this->requireId('orderId');
        $rating = $this->intInput('rating', 5);
        if ($rating < 1 || $rating > 5) throw new BusinessException(ErrorCode::PARAM_ERROR, '评分须为1-5');
        $order = (array) Db::table('order_main')->where('id', $orderId)->where('site_id', $siteId)
            ->where('user_id', UserContext::userId())->where('order_type', 1)->whereNull('deleted_at')
            ->first(['id', 'property_id', 'order_status']);
        if ($order === []) throw new BusinessException(ErrorCode::NOT_FOUND, '酒店订单不存在');
        if (! in_array((int) $order['order_status'], [2, 3], true)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '入住/完成后方可评价');
        if ((int) $order['property_id'] < 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '历史订单未归属物业，暂无法评价');
        if (Db::table('goods_review')->where('order_id', $orderId)->exists()) throw new BusinessException(ErrorCode::DATA_CONFLICT, '该订单已评价');
        $images = $this->input('images');
        Db::table('goods_review')->insert([
            'site_id' => $siteId, 'property_id' => (int) $order['property_id'], 'goods_id' => 0,
            'user_id' => UserContext::userId(), 'order_id' => $orderId, 'rating' => $rating,
            'content' => mb_substr($this->strInput('content'), 0, 2000),
            'images' => is_array($images) ? json_encode($images, JSON_UNESCAPED_UNICODE) : null, 'status' => 1,
        ]);
        return Result::success(null, '评价已提交');
    }

    public function calendar(): array
    {
        $siteId = $this->requireSiteId();
        $propertyId = $this->requireId('propertyId');
        $roomTypeId = $this->requireId('roomTypeId');
        $this->publishedProperty($siteId, $propertyId);
        $days = min(90, max(1, $this->intInput('days', 30)));
        $start = $this->strInput('startDate', date('Y-m-d'));
        $startTime = strtotime($start);
        if ($startTime === false || date('Y-m-d', $startTime) !== $start) throw new BusinessException(ErrorCode::PARAM_ERROR, 'startDate 格式须为 YYYY-MM-DD');
        $room = (array) Db::table('hotel_room_type')->where('id', $roomTypeId)->where('site_id', $siteId)
            ->where('property_id', $propertyId)->where('status', 1)->where('publish_status', 2)
            ->where('approved_version', '>', 0)->whereNull('deleted_at')->first();
        if ($room === []) throw new BusinessException(ErrorCode::NOT_FOUND, '房型不存在或已停售');
        $end = date('Y-m-d', $startTime + ($days - 1) * 86400);
        $stocks = Db::table('goods_daily_stock')->where('site_id', $siteId)->where('property_id', $propertyId)
            ->where('sku_type', 1)->where('sku_id', $roomTypeId)->whereBetween('stock_date', [$start, $end])
            ->whereNull('deleted_at')->get()->keyBy('stock_date');
        $calendar = [];
        for ($i = 0; $i < $days; ++$i) {
            $date = date('Y-m-d', $startTime + $i * 86400);
            $stock = $stocks->get($date);
            if ($stock) {
                $stock = (array) $stock;
                $price = (float) $stock['price'];
                $citizen = (float) ($stock['price_citizen'] ?? 0);
                $calendar[] = ['date' => $date, 'price' => $price, 'priceCitizen' => $citizen > 0 ? $citizen : $price,
                    'stock' => (int) $stock['is_closed'] === 1 ? 0 : max(0, (int) $stock['stock_total'] - (int) $stock['stock_sold'] - (int) $stock['stock_locked']),
                    'closed' => (int) $stock['is_closed'] === 1];
            } else {
                $price = RoomDefaults::price($room, $date);
                $citizen = (float) ($room['base_price_citizen'] ?? 0);
                $calendar[] = ['date' => $date, 'price' => $price, 'priceCitizen' => $citizen > 0 ? $citizen : $price,
                    'stock' => RoomDefaults::stock($room), 'closed' => false];
            }
        }
        return Result::success(['propertyId' => $propertyId, 'roomTypeId' => $roomTypeId, 'calendar' => $calendar]);
    }

    private function publishedProperty(int $siteId, int $propertyId): array
    {
        $location = Db::table('merchant_store')->where('id', $propertyId)->where('site_id', $siteId)
            ->where('business_type', 'hotel')->whereNull('deleted_at')->first(['country_code', 'city_key']);
        foreach ($location ? MarketplaceReader::searchable($siteId, (string) $location->country_code, (string) $location->city_key) : [] as $row) {
            if ((int) $row['property_id'] === $propertyId) return $row;
        }
        throw new BusinessException(ErrorCode::NOT_FOUND, '酒店尚未发布或已失去展示资格');
    }

    private static function listAliases(array $row): array
    {
        return $row + ['goods_type' => 1, 'category_id' => 0, 'goods_name' => $row['property_name'],
            'goods_brief' => $row['description'], 'is_recommend' => $row['featured'], 'is_hot' => 0];
    }

    private function jsonList(mixed $value): array
    {
        if (is_string($value)) $value = json_decode($value, true);
        return is_array($value) ? array_values($value) : [];
    }

    private static function distance(array $row, float $lat, float $lng): float
    {
        if ($lat === 0.0 && $lng === 0.0) return PHP_FLOAT_MAX;
        $pLat = deg2rad((float) ($row['latitude'] ?? 0));
        $dLat = $pLat - deg2rad($lat);
        $dLng = deg2rad((float) ($row['longitude'] ?? 0) - $lng);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat)) * cos($pLat) * sin($dLng / 2) ** 2;
        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
