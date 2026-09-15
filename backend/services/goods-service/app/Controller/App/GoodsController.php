<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;
use Mtrip\Shared\Merchant\MarketplaceReader;

/**
 * C端门票商品接口:首页聚合/分类树/列表搜索/详情/价格库存日历
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
            ->where('goods_type', 2)
            ->where('status', 3)
            ->whereNull('deleted_at');

        $recommend = array_slice(MarketplaceReader::published($siteId, 'listing'), 0, 8);
        $hot = $base()->where('is_hot', 1)
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
        if (! in_array($goodsType, [0, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '当前商品接口仅支持门票');
        }

        $query = Db::table('goods_category')
            ->where('site_id', $siteId)
            ->where('goods_type', 2)
            ->where('status', 1)
            ->whereNull('deleted_at');
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
            ->where('goods_type', 2)
            ->where('status', 3)
            ->whereNull('deleted_at');

        $goodsType = $this->intInput('goodsType');
        if (! in_array($goodsType, [0, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '当前商品接口仅支持门票');
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
        // 可配置筛选(PRD 模块3):价格区间/设施/免费取消/评分下限
        $this->applyFilters($query);

        // 可配置排序(PRD 模块3):default/price_asc/price_desc/star/rating/sales/new/distance
        $sort = $this->strInput('sortBy');
        $this->applySort($query, $sort);
        $query->orderBy('id');

        $total = (clone $query)->count();
        $list = $query->forPage($page, $pageSize)
            ->get(self::LIST_FIELDS)
            ->map($this->rowWithPrice())->all();
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
            ->where('goods_type', 2)
            ->where('status', 3)
            ->whereNull('deleted_at')
            ->first();
        if (! $goods) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商品不存在或已下架');
        }
        $goods = (array) $goods;
        foreach (['images', 'facilities'] as $jsonField) {
            $goods[$jsonField] = $goods[$jsonField] ? json_decode((string) $goods[$jsonField], true) : [];
        }
        unset($goods['audit_remark'], $goods['audit_by'], $goods['audit_time'], $goods['deleted_at']);

        // 门票票种
        $skus = Db::table('ticket_type')
            ->where('goods_id', $id)->where('status', 1)->whereNull('deleted_at')
            ->orderBy('sort')->orderBy('id')->get()
            ->map(static function ($row) {
                $row = (array) $row;
                $row['time_slots'] = $row['time_slots'] ? json_decode((string) $row['time_slots'], true) : [];
                unset($row['deleted_at']);
                return $row;
            })->all();

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
        $goods['minPrice'] = $this->minPriceOf((int) $goods['id']);
        $goods['minPriceCitizen'] = $goods['minPrice'];
        $goods['reviewSummary'] = $this->reviewSummaryOf($siteId, (int) $goods['id']);
        return Result::success($goods);
    }

    /**
     * 门票价格库存日历:未配置日历的日期回退 base_price/base_stock
     * 参数:skuType=2、skuId、startDate、days(默认30,上限90)
     */
    public function calendar(): array
    {
        $siteId = $this->requireSiteId();
        $skuType = $this->intInput('skuType', 2);
        if ($skuType !== 2) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'skuType 只能为 2票种');
        }
        $skuId = $this->requireId('skuId');
        $days = min(90, max(1, $this->intInput('days', 30)));
        $start = $this->strInput('startDate', date('Y-m-d'));
        $startTime = strtotime($start);
        if ($startTime === false) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'startDate 格式须为 YYYY-MM-DD');
        }
        $endDate = date('Y-m-d', $startTime + ($days - 1) * 86400);

        $sku = Db::table('ticket_type')
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

        $calendar = [];
        for ($i = 0; $i < $days; ++$i) {
            $date = date('Y-m-d', $startTime + $i * 86400);
            $row = $rows->get($date);
            if ($row) {
                $row = (array) $row;
                $available = max(0, (int) $row['stock_total'] - (int) $row['stock_sold'] - (int) $row['stock_locked']);
                $price = (float) $row['price'];
                $calendar[] = [
                    'date' => $date,
                    'price' => $price,
                    'priceCitizen' => $price,
                    'stock' => (int) $row['is_closed'] === 1 ? 0 : $available,
                    'closed' => (int) $row['is_closed'] === 1,
                ];
            } else {
                // 回退基础价/基础库存
                $calendar[] = [
                    'date' => $date,
                    'price' => (float) $sku['base_price'],
                    'priceCitizen' => (float) $sku['base_price'],
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

    /** 应用门票价格/设施/免费取消/评分筛选。 */
    private function applyFilters($query): void
    {
        $priceMin = $this->floatInput('priceMin');
        $priceMax = $this->floatInput('priceMax');
        if ($priceMin > 0 || $priceMax > 0) {
            $query->whereExists(function ($q) use ($priceMin, $priceMax) {
                $q->from('ticket_type')
                    ->whereColumn('ticket_type.goods_id', 'goods_info.id')
                    ->where('ticket_type.status', 1)->whereNull('ticket_type.deleted_at');
                if ($priceMin > 0) {
                    $q->where('ticket_type.base_price', '>=', $priceMin);
                }
                if ($priceMax > 0) {
                    $q->where('ticket_type.base_price', '<=', $priceMax);
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
        $minPrice = '(SELECT MIN(base_price) FROM ticket_type WHERE ticket_type.goods_id = goods_info.id AND ticket_type.status = 1 AND ticket_type.deleted_at IS NULL)';
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
            $row['minPrice'] = $this->minPriceOf((int) $row['id']);
            $row['minPriceCitizen'] = $row['minPrice'];
            return $row;
        };
    }

    /** 商品起价:在售SKU的最低基础价 */
    private function minPriceOf(int $goodsId): float
    {
        $min = Db::table('ticket_type')
            ->where('goods_id', $goodsId)
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->min('base_price');
        return (float) ($min ?? 0);
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
