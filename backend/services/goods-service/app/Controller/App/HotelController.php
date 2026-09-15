<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MarketplaceReader;
use Mtrip\Shared\Support\Result;

/** Consumer hotel reads use Property and room type IDs only. */
final class HotelController extends AbstractController
{
    public function list(): array
    {
        $siteId = $this->requireSiteId();
        [$page, $pageSize] = $this->pageParams();
        $rows = MarketplaceReader::searchable($siteId, $this->strInput('countryCode'), $this->strInput('cityKey'));
        $keyword = mb_strtolower($this->strInput('keyword'));
        $star = $this->intInput('starLevel');
        $min = $this->floatInput('priceMin');
        $max = $this->floatInput('priceMax');
        $score = $this->floatInput('reviewScore');
        $amenities = array_values(array_filter(array_map('trim', explode(',', $this->strInput('amenities')))));
        $breakfast = $this->intInput('breakfast') === 1;
        $freeCancel = $this->intInput('freeCancel') === 1;

        $rows = array_values(array_filter($rows, static function (array $row) use ($keyword, $star, $min, $max, $score, $amenities, $breakfast, $freeCancel): bool {
            if ($keyword !== '' && ! str_contains(mb_strtolower($row['property_name'] . ' ' . $row['address']), $keyword)) return false;
            if ($star > 0 && (int) $row['star_level'] !== $star) return false;
            if ($min > 0 && (float) $row['minPrice'] < $min) return false;
            if ($max > 0 && (float) $row['minPrice'] > $max) return false;
            if ($score > 0 && (float) $row['rating'] < $score) return false;
            if ($breakfast && ! $row['hasBreakfast']) return false;
            if ($freeCancel && ! $row['freeCancel']) return false;
            foreach ($amenities as $amenity) if (! in_array($amenity, $row['facilities'], true)) return false;
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
        $list = array_map([self::class, 'listAliases'], array_slice($rows, ($page - 1) * $pageSize, $pageSize));
        return Result::page($list, $total, $page, $pageSize);
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
            ->orderBy('sort')->orderBy('id')->get()->map(function ($row): array {
                $room = (array) $row;
                foreach (['images', 'facilities'] as $field) $room[$field] = $this->jsonList($room[$field] ?? null);
                unset($room['deleted_at']);
                $room['room_type_id'] = (int) $room['id'];
                return $room;
            })->all();
        $rules = Db::table('goods_refund_rule')->where('site_id', $siteId)->where('property_id', $propertyId)
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
                $price = (float) $room['base_price'];
                $citizen = (float) ($room['base_price_citizen'] ?? 0);
                $calendar[] = ['date' => $date, 'price' => $price, 'priceCitizen' => $citizen > 0 ? $citizen : $price,
                    'stock' => (int) $room['base_stock'], 'closed' => false];
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
