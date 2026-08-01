<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

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

        $recommend = $base()->where('is_recommend', 1)
            ->orderByDesc('sort_weight')->orderByDesc('id')
            ->limit(8)->get(self::LIST_FIELDS)
            ->map($this->rowWithPrice())->all();
        $hot = $base()->where('is_hot', 1)
            ->orderByDesc('sales_count')->orderByDesc('id')
            ->limit(8)->get(self::LIST_FIELDS)
            ->map($this->rowWithPrice())->all();

        return Result::success([
            'recommend' => $recommend,
            'hot' => $hot,
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

        // 排序:default 权重 / sales 销量 / new 最新
        match ($this->strInput('sortBy')) {
            'sales' => $query->orderByDesc('sales_count'),
            'new' => $query->orderByDesc('id'),
            default => $query->orderByDesc('sort_weight')->orderByDesc('id'),
        };

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
