<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;
use Mtrip\Shared\Merchant\MarketplaceReader;

/**
 * C端商品接口:首页聚合/分类树/列表搜索/详情/价格库存日历
 * 全部游客可访问,须携带 X-Site-Id;仅返回 status=3 已上架商品
 */
class GoodsController extends AbstractController
{
    /** 商品列表字段白名单(C端不下发审核/商户等内部字段) */
    private const LIST_FIELDS = [
        'id', 'goods_type', 'category_id', 'goods_name', 'goods_brief',
        'cover_image', 'address', 'longitude', 'latitude', 'star_level',
        'is_recommend', 'is_hot', 'sales_count',
    ];

    /** 首页聚合:推荐商品 + 热门商品(各取8条) */
    public function home(): array
    {
        $siteId = $this->requireSiteId();
        $base = static fn () => Db::table('goods_info')
            ->where('site_id', $siteId)
            ->where('status', 3)
            ->whereNull('deleted_at');

        $recommend = array_slice(MarketplaceReader::published($siteId, 'listing'), 0, 8);
        $hot = $base()->where('is_hot', 1)
            ->where('goods_type', '<>', 1)
            ->orderByDesc('sales_count')->orderByDesc('id')
            ->limit(8)->get(self::LIST_FIELDS)
            ->map($this->rowWithPrice())->all();

        return Result::success([
            'recommend' => $recommend,
            'hot' => $hot,
            'destinations' => MarketplaceReader::published($siteId, 'destination'),
        ]);
    }

    /** 分类树(两级,仅显示状态) */
    public function category(): array
    {
        $siteId = $this->requireSiteId();
        $goodsType = $this->intInput('goodsType');

        $query = Db::table('goods_category')
            ->where('site_id', $siteId)
            ->where('status', 1)
            ->whereNull('deleted_at');
        if (in_array($goodsType, [1, 2], true)) {
            $query->where('goods_type', $goodsType);
        }
        $rows = $query->orderBy('sort')->orderBy('id')
            ->get(['id', 'parent_id', 'category_name', 'goods_type', 'icon', 'sort'])
            ->map(static fn ($row) => (array) $row)->all();

        // 组装两级树
        $tree = [];
        $index = [];
        foreach ($rows as $row) {
            $row['children'] = [];
            $index[$row['id']] = $row;
        }
        foreach ($index as $id => $row) {
            $pid = (int) $row['parent_id'];
            if ($pid > 0 && isset($index[$pid])) {
                $index[$pid]['children'][] = &$index[$id];
            } else {
                $tree[] = &$index[$id];
            }
        }
        return Result::success($tree);
    }

    /** 商品分页列表:关键词/类型/分类/星级筛选,多种排序 */
    public function list(): array
    {
        $siteId = $this->requireSiteId();
        [$page, $pageSize] = $this->pageParams();

        $query = Db::table('goods_info')
            ->where('site_id', $siteId)
            ->where('status', 3)
            ->whereNull('deleted_at');

        $goodsType = $this->intInput('goodsType');
        if (in_array($goodsType, [1, 2], true)) {
            $query->where('goods_type', $goodsType);
        }
        $categoryId = $this->intInput('categoryId');
        if ($categoryId > 0) {
            $query->where('category_id', $categoryId);
        }
        $keyword = $this->strInput('keyword');
        if ($keyword !== '') {
            $kw = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $keyword) . '%';
            $query->where(static function ($q) use ($kw) {
                $q->where('goods_name', 'like', $kw)->orWhere('address', 'like', $kw);
            });
        }
        $starLevel = $this->intInput('starLevel');
        if ($starLevel > 0) {
            $query->where('star_level', $starLevel);
        }
        // All hotel discovery uses published, live-qualified properties. Tickets keep their existing path.
        $ranked = MarketplaceReader::published($siteId, 'listing', $this->strInput('countryCode'), $this->strInput('cityKey'));
        $rankedIds = array_map('intval', array_column($ranked, 'id'));
        $query->where(static fn ($q) => $q->where('goods_type', '<>', 1)->orWhereIn('id', $rankedIds));
        // 可配置筛选(PRD 模块3):价格区间/设施/含早/免费取消/评分下限
        $this->applyFilters($query);

        // 可配置排序(PRD 模块3):default/price_asc/price_desc/star/rating/sales/new/distance
        $sort = $this->strInput('sortBy');
        if ($goodsType === 1 && in_array($sort, ['', 'default'], true) && $rankedIds !== []) {
            $query->orderByRaw('FIELD(id,' . implode(',', array_fill(0, count($rankedIds), '?')) . ')', $rankedIds);
        } else {
            $this->applySort($query, $sort);
            $query->orderBy('id');
        }

        $total = (clone $query)->count();
        $list = $query->forPage($page, $pageSize)
            ->get(self::LIST_FIELDS)
            ->map($this->rowWithPrice())->all();
        $rankedById = array_column($ranked, null, 'id');
        foreach ($list as &$row) {
            if (isset($rankedById[$row['id']])) {
                $row = array_replace($row, array_intersect_key($rankedById[$row['id']], array_flip(['rating', 'reviewCount', 'is_recommend', 'pinned', 'featured', 'country_code', 'city_key'])));
            }
        }
        unset($row);
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 商品详情:主信息 + SKU(房型/票种) + 退改规则 */
    public function detail(): array
    {
        $siteId = $this->requireSiteId();
        $id = $this->requireId();

        $goods = Db::table('goods_info')
            ->where('id', $id)
            ->where('site_id', $siteId)
            ->where('status', 3)
            ->whereNull('deleted_at')
            ->first();
        if (! $goods) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商品不存在或已下架');
        }
        $goods = (array) $goods;
        if ((int) $goods['goods_type'] === 1 && ! in_array($id, array_map('intval', array_column(MarketplaceReader::published($siteId, 'listing'), 'id')), true)) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '酒店尚未发布或已失去展示资格');
        }
        foreach (['images', 'facilities'] as $jsonField) {
            $goods[$jsonField] = $goods[$jsonField] ? json_decode((string) $goods[$jsonField], true) : [];
        }
        unset($goods['audit_remark'], $goods['audit_by'], $goods['audit_time'], $goods['deleted_at']);

        // SKU:1酒店→房型 2门票→票种
        $goodsType = (int) $goods['goods_type'];
        if ($goodsType === 1) {
            $skus = Db::table('hotel_room_type')
                ->where('goods_id', $id)->where('status', 1)->whereNull('deleted_at')
                ->orderBy('sort')->orderBy('id')->get()
                ->map(static function ($row) {
                    $row = (array) $row;
                    foreach (['images', 'facilities'] as $jsonField) {
                        $row[$jsonField] = $row[$jsonField] ? json_decode((string) $row[$jsonField], true) : [];
                    }
                    unset($row['deleted_at']);
                    return $row;
                })->all();
        } else {
            $skus = Db::table('ticket_type')
                ->where('goods_id', $id)->where('status', 1)->whereNull('deleted_at')
                ->orderBy('sort')->orderBy('id')->get()
                ->map(static function ($row) {
                    $row = (array) $row;
                    $row['time_slots'] = $row['time_slots'] ? json_decode((string) $row['time_slots'], true) : [];
                    unset($row['deleted_at']);
                    return $row;
                })->all();
        }

        // 退改规则(商品级 + SKU级)
        $refundRules = Db::table('goods_refund_rule')
            ->where('goods_id', $id)->whereNull('deleted_at')
            ->get(['id', 'sku_type', 'sku_id', 'rule_type', 'rules', 'remark'])
            ->map(static function ($row) {
                $row = (array) $row;
                $row['rules'] = $row['rules'] ? json_decode((string) $row['rules'], true) : [];
                return $row;
            })->all();

        $goods['skus'] = $skus;
        $goods['refundRules'] = $refundRules;
        $goods['minPrice'] = $this->minPriceOf((int) $goods['id'], $goodsType);
        $goods['minPriceCitizen'] = $this->minPriceCitizenOf((int) $goods['id'], $goodsType);
        $goods['reviewSummary'] = $this->reviewSummaryOf($siteId, (int) $goods['id']);
        return Result::success($goods);
    }

    /** 酒店评价列表(公开):仅显示 status=1,附评价人昵称/头像 */
    public function reviews(): array
    {
        $siteId = $this->requireSiteId();
        $goodsId = $this->requireId('goodsId');
        [$page, $pageSize] = $this->pageParams();

        $query = Db::table('goods_review as r')
            ->leftJoin('user_info as u', 'u.id', '=', 'r.user_id')
            ->where('r.site_id', $siteId)
            ->where('r.goods_id', $goodsId)
            ->where('r.status', 1)
            ->whereNull('r.deleted_at');
        $total = (clone $query)->count();
        $list = $query->orderByDesc('r.id')->forPage($page, $pageSize)
            ->get(['r.id', 'r.rating', 'r.content', 'r.images', 'r.reply_content', 'r.created_at',
                'u.nickname', 'u.avatar'])
            ->map(static function ($row) {
                $row = (array) $row;
                $row['images'] = $row['images'] ? json_decode((string) $row['images'], true) : [];
                $row['nickname'] = $row['nickname'] ?: '匿名用户';
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /**
     * 提交酒店评价(登录态):仅本人已入住/已完成订单可评,每单限一次
     * order_status:2已入住/已核销 3已完成
     */
    public function reviewAdd(): array
    {
        $siteId = $this->requireSiteId();
        $userId = UserContext::userId();
        $orderId = $this->requireId('orderId');
        $rating = $this->intInput('rating', 5);
        if ($rating < 1 || $rating > 5) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '评分须为1-5');
        }
        $order = Db::table('order_main')
            ->where('id', $orderId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->first(['id', 'goods_id', 'order_type', 'order_status']);
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '订单不存在');
        }
        $order = (array) $order;
        if ((int) $order['order_type'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅酒店订单可评价');
        }
        if (! in_array((int) $order['order_status'], [2, 3], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '入住/完成后方可评价');
        }
        if (Db::table('goods_review')->where('order_id', $orderId)->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该订单已评价');
        }
        $images = $this->input('images');
        Db::table('goods_review')->insert([
            'site_id' => $siteId,
            'goods_id' => (int) $order['goods_id'],
            'user_id' => $userId,
            'order_id' => $orderId,
            'rating' => $rating,
            'content' => mb_substr($this->strInput('content'), 0, 2000),
            'images' => is_array($images) ? json_encode($images, JSON_UNESCAPED_UNICODE) : null,
            'status' => 1,
        ]);
        return Result::success(null, '评价已提交');
    }

    /**
     * SKU价格库存日历:未配置日历的日期回退 base_price/base_stock
     * 参数:skuType 1房型 2票种、skuId、startDate、days(默认30,上限90)
     */
    public function calendar(): array
    {
        $siteId = $this->requireSiteId();
        $skuType = $this->intInput('skuType', 1);
        if (! in_array($skuType, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'skuType 只能为 1房型/2票种');
        }
        $skuId = $this->requireId('skuId');
        $days = min(90, max(1, $this->intInput('days', 30)));
        $start = $this->strInput('startDate', date('Y-m-d'));
        $startTime = strtotime($start);
        if ($startTime === false) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'startDate 格式须为 YYYY-MM-DD');
        }
        $endDate = date('Y-m-d', $startTime + ($days - 1) * 86400);

        $skuTable = $skuType === 1 ? 'hotel_room_type' : 'ticket_type';
        $sku = Db::table($skuTable)
            ->where('id', $skuId)->where('site_id', $siteId)
            ->where('status', 1)->whereNull('deleted_at')
            ->first();
        if (! $sku) {
            throw new BusinessException(ErrorCode::NOT_FOUND, 'SKU不存在或已停售');
        }
        $sku = (array) $sku;

        $rows = Db::table('goods_daily_stock')
            ->where('sku_type', $skuType)
            ->where('sku_id', $skuId)
            ->whereBetween('stock_date', [date('Y-m-d', $startTime), $endDate])
            ->whereNull('deleted_at')
            ->get(['stock_date', 'price', 'price_citizen', 'stock_total', 'stock_sold', 'stock_locked', 'is_closed'])
            ->keyBy('stock_date');

        // 公民基础价回退:房型有 base_price_citizen,票种无该列
        $baseCitizen = (float) ($sku['base_price_citizen'] ?? 0);
        $calendar = [];
        for ($i = 0; $i < $days; ++$i) {
            $date = date('Y-m-d', $startTime + $i * 86400);
            $row = $rows->get($date);
            if ($row) {
                $row = (array) $row;
                $available = max(0, (int) $row['stock_total'] - (int) $row['stock_sold'] - (int) $row['stock_locked']);
                $price = (float) $row['price'];
                $priceCitizen = (float) ($row['price_citizen'] ?? 0);
                $calendar[] = [
                    'date' => $date,
                    'price' => $price,
                    'priceCitizen' => $priceCitizen > 0 ? $priceCitizen : $price,
                    'stock' => (int) $row['is_closed'] === 1 ? 0 : $available,
                    'closed' => (int) $row['is_closed'] === 1,
                ];
            } else {
                // 回退基础价/基础库存
                $calendar[] = [
                    'date' => $date,
                    'price' => (float) $sku['base_price'],
                    'priceCitizen' => $baseCitizen > 0 ? $baseCitizen : (float) $sku['base_price'],
                    'stock' => (int) $sku['base_stock'],
                    'closed' => false,
                ];
            }
        }
        return Result::success([
            'skuType' => $skuType,
            'skuId' => $skuId,
            'calendar' => $calendar,
        ]);
    }

    /** 可配置筛选/排序项(PRD 模块3):C 端渲染筛选面板与排序菜单 */
    public function filters(): array
    {
        $siteId = $this->requireSiteId();
        $filters = $this->pickConfig('goods_filter_config', $siteId, 'filter_key',
            ['filter_key', 'filter_name', 'filter_name_en', 'filter_type', 'options', 'sort']);
        foreach ($filters as &$f) {
            $f['options'] = $f['options'] ? json_decode((string) $f['options'], true) : [];
        }
        unset($f);
        $sorts = $this->pickConfig('goods_sort_config', $siteId, 'sort_key',
            ['sort_key', 'sort_name', 'sort_name_en', 'sort']);
        return Result::success(['filters' => $filters, 'sorts' => $sorts]);
    }

    /** 取站点配置:site 行优先、全局(0)兜底,按 sort 排序,仅保留指定列 */
    private function pickConfig(string $table, int $siteId, string $keyCol, array $cols): array
    {
        $rows = Db::table($table)
            ->whereIn('site_id', [$siteId, 0])
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->get()->map(static fn ($r) => (array) $r)->all();
        $byKey = [];
        foreach ($rows as $r) {
            $k = (string) $r[$keyCol];
            if (! isset($byKey[$k]) || (int) $r['site_id'] > (int) $byKey[$k]['site_id']) {
                $byKey[$k] = $r;
            }
        }
        $out = array_values($byKey);
        usort($out, static fn ($a, $b) => ((int) $a['sort'] <=> (int) $b['sort']) ?: ((int) $a['id'] <=> (int) $b['id']));
        return array_map(static fn ($r) => array_intersect_key($r, array_flip($cols)), $out);
    }

    /** 应用可配置筛选到查询(酒店维度:价格/设施/含早/免费取消/评分) */
    private function applyFilters($query): void
    {
        $priceMin = $this->floatInput('priceMin');
        $priceMax = $this->floatInput('priceMax');
        if ($priceMin > 0 || $priceMax > 0) {
            $query->whereExists(function ($q) use ($priceMin, $priceMax) {
                $q->from('hotel_room_type')
                    ->whereColumn('hotel_room_type.goods_id', 'goods_info.id')
                    ->where('hotel_room_type.status', 1)->whereNull('hotel_room_type.deleted_at');
                if ($priceMin > 0) {
                    $q->where('hotel_room_type.base_price', '>=', $priceMin);
                }
                if ($priceMax > 0) {
                    $q->where('hotel_room_type.base_price', '<=', $priceMax);
                }
            });
        }
        // 设施:facilities JSON 需同时包含所选各项
        $amenities = $this->input('amenities');
        $amenityList = is_array($amenities) ? $amenities : ($amenities !== null && $amenities !== '' ? explode(',', (string) $amenities) : []);
        foreach ($amenityList as $a) {
            $a = trim((string) $a);
            if ($a !== '') {
                $query->whereRaw('JSON_CONTAINS(facilities, ?)', [json_encode($a, JSON_UNESCAPED_UNICODE)]);
            }
        }
        if ($this->intInput('breakfast') === 1) {
            $query->whereExists(function ($q) {
                $q->from('hotel_room_type')->whereColumn('hotel_room_type.goods_id', 'goods_info.id')
                    ->where('hotel_room_type.breakfast', '>', 0)
                    ->where('hotel_room_type.status', 1)->whereNull('hotel_room_type.deleted_at');
            });
        }
        if ($this->intInput('freeCancel') === 1) {
            $query->whereExists(function ($q) {
                $q->from('goods_refund_rule')->whereColumn('goods_refund_rule.goods_id', 'goods_info.id')
                    ->where('goods_refund_rule.rule_type', 1)->whereNull('goods_refund_rule.deleted_at');
            });
        }
        $reviewScore = $this->floatInput('reviewScore');
        if ($reviewScore > 0) {
            $query->whereRaw(
                '(SELECT COALESCE(AVG(rating),0) FROM goods_review WHERE goods_review.goods_id = goods_info.id AND goods_review.status = 1 AND goods_review.deleted_at IS NULL) >= ?',
                [$reviewScore],
            );
        }
    }

    /** 应用可配置排序到查询(sort_key 白名单) */
    private function applySort($query, string $sortBy): void
    {
        $minPrice = '(SELECT MIN(base_price) FROM hotel_room_type WHERE hotel_room_type.goods_id = goods_info.id AND hotel_room_type.status = 1 AND hotel_room_type.deleted_at IS NULL)';
        $avgRating = '(SELECT COALESCE(AVG(rating),0) FROM goods_review WHERE goods_review.goods_id = goods_info.id AND goods_review.status = 1 AND goods_review.deleted_at IS NULL)';
        switch ($sortBy) {
            case 'price_asc':
                $query->orderByRaw("{$minPrice} ASC");
                break;
            case 'price_desc':
                $query->orderByRaw("{$minPrice} DESC");
                break;
            case 'star':
                $query->orderByDesc('star_level');
                break;
            case 'rating':
                $query->orderByRaw("{$avgRating} DESC");
                break;
            case 'sales':
                $query->orderByDesc('sales_count');
                break;
            case 'new':
                $query->orderByDesc('id');
                break;
            case 'distance':
                $lat = $this->floatInput('lat');
                $lng = $this->floatInput('lng');
                if ($lat !== 0.0 && $lng !== 0.0) {
                    // 近距离平方距离排序(免三角函数,足够列表排序用);无经纬度回退综合
                    $query->orderByRaw('(POW(COALESCE(latitude,0) - ?, 2) + POW(COALESCE(longitude,0) - ?, 2)) ASC', [$lat, $lng]);
                } else {
                    $query->orderByDesc('sort_weight')->orderByDesc('id');
                }
                break;
            default:
                $query->orderByDesc('sort_weight')->orderByDesc('id');
        }
    }

    /** 列表行统一转数组并附加起价(含公民起价) */
    private function rowWithPrice(): callable
    {
        return function ($row): array {
            $row = (array) $row;
            $goodsType = (int) $row['goods_type'];
            $row['minPrice'] = $this->minPriceOf((int) $row['id'], $goodsType);
            $row['minPriceCitizen'] = $this->minPriceCitizenOf((int) $row['id'], $goodsType);
            return $row;
        };
    }

    /** 商品起价:在售SKU的最低基础价 */
    private function minPriceOf(int $goodsId, int $goodsType): float
    {
        $table = $goodsType === 1 ? 'hotel_room_type' : 'ticket_type';
        $min = Db::table($table)
            ->where('goods_id', $goodsId)
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->min('base_price');
        return (float) ($min ?? 0);
    }

    /**
     * 公民起价:仅酒店房型有 base_price_citizen(>0 者取最低);无公民价或门票时回退外国人起价
     */
    private function minPriceCitizenOf(int $goodsId, int $goodsType): float
    {
        if ($goodsType !== 1) {
            return $this->minPriceOf($goodsId, $goodsType);
        }
        $min = Db::table('hotel_room_type')
            ->where('goods_id', $goodsId)
            ->where('status', 1)
            ->where('base_price_citizen', '>', 0)
            ->whereNull('deleted_at')
            ->min('base_price_citizen');
        return $min !== null ? (float) $min : $this->minPriceOf($goodsId, $goodsType);
    }

    /** 评价摘要:显示中的评价数与平均分(保留1位) */
    private function reviewSummaryOf(int $siteId, int $goodsId): array
    {
        $row = Db::table('goods_review')
            ->where('site_id', $siteId)
            ->where('goods_id', $goodsId)
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->first([Db::raw('COUNT(*) as cnt'), Db::raw('AVG(rating) as avg_rating')]);
        $row = (array) $row;
        $count = (int) ($row['cnt'] ?? 0);
        return [
            'count' => $count,
            'avgRating' => $count > 0 ? round((float) $row['avg_rating'], 1) : 0.0,
        ];
    }
}
