<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户端 M8 促销(Promotion Tables)。
 *
 * 设计源:Figma file `fsK2rrl2sadcowrxspvGV8` SECTION `2285:21516`「Promotion tables」。
 * 稿面把促销分成 Percentage / Fixed Amount / Coupon Code 三个 Tab,另加功能需求要求的长住促销。
 *
 * ## 两个轴,不要混淆
 * - `coupon_type`(**计价轴**,改动会影响结算):1满减/3无门槛 = `discount_value` 直减金额;
 *   2折扣券 = `discount_value` 是 **10 分制折扣率**(8.50 = 用户付 85%,即 15% off)。
 *   下游 `order-service/PricingService::resolveCoupon` 与 `SettlementService` 都按这个口径读。
 * - `promotion_kind`(**展示轴**,本模块新增):1百分比 2固定金额 3优惠码 4长住,只决定页面分 Tab。
 *
 * 稿面三个 Tab 混了「面额轴」和「是否需券码」两个维度,`coupon_type` 表达不了,故两轴并存,
 * 换算在 `discountPair()` / `discountParts()` 两个纯函数里收口,计价与结算链路零改动。
 *
 * ## 隔离
 * 所有查询经 `MerchantContext::scopeMerchantIds()` + `scopePropertyIds()` 裁剪;
 * 商品范围强制 `goods_scope=3` 且必须绑定具体物业(以免商家出资优惠外溢到其他商家)。
 */
class PromotionController extends AbstractController
{
    /** 百分比促销:折扣以「立减百分比」表达 */
    public const KIND_PERCENTAGE = 1;
    /** 固定金额促销:折扣以金额表达 */
    public const KIND_FIXED_AMOUNT = 2;
    /** 优惠码促销:需客人输入券码,折扣单位可再选百分比或金额 */
    public const KIND_PROMO_CODE = 3;
    /** 长住促销:按最少入住晚数触发 */
    public const KIND_LONG_STAY = 4;

    /** 折扣单位(kind=3 由用户选择,其余由 kind 推定) */
    private const UNIT_PERCENT = 1;
    private const UNIT_AMOUNT = 2;

    /** 促销码状态镜像:`marketing_coupon.status` → `marketing_promo_code.status` */
    private const PROMO_CODE_STATUS_MAP = [0 => 5, 1 => 1, 2 => 2, 3 => 3];

    /**
     * 卡片统计(稿面三张卡)+ 兼容旧口径的状态计数。
     * 全部按当前 merchant/property 范围裁剪。
     */
    public function summary(): array
    {
        $row = (array) $this->baseQuery()->first([
            Db::raw('COUNT(*) AS total'),
            Db::raw('SUM(CASE WHEN promotion_kind = 1 THEN 1 ELSE 0 END) AS percentage'),
            Db::raw('SUM(CASE WHEN promotion_kind = 2 THEN 1 ELSE 0 END) AS fixed_amount'),
            Db::raw('SUM(CASE WHEN promotion_kind = 3 THEN 1 ELSE 0 END) AS promo_code'),
            Db::raw('SUM(CASE WHEN promotion_kind = 4 THEN 1 ELSE 0 END) AS long_stay'),
            Db::raw('SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS draft'),
            Db::raw('SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active'),
            Db::raw('SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS paused'),
            Db::raw('SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS ended'),
            Db::raw('COALESCE(SUM(received_count), 0) AS claimed'),
            Db::raw('COALESCE(SUM(used_count), 0) AS used'),
        ]);

        $ids = $this->scopedIds();

        return Result::success([
            'total' => (int) ($row['total'] ?? 0),
            'percentage' => (int) ($row['percentage'] ?? 0),
            'fixedAmount' => (int) ($row['fixed_amount'] ?? 0),
            'promoCode' => (int) ($row['promo_code'] ?? 0),
            'longStay' => (int) ($row['long_stay'] ?? 0),
            'draft' => (int) ($row['draft'] ?? 0),
            'active' => (int) ($row['active'] ?? 0),
            'paused' => (int) ($row['paused'] ?? 0),
            'ended' => (int) ($row['ended'] ?? 0),
            'claimed' => (int) ($row['claimed'] ?? 0),
            'used' => (int) ($row['used'] ?? 0),
            'impressions' => $this->impressionSum($ids, null),
        ]);
    }

    /** 促销列表:keyword / promotionKind / couponType / status 过滤 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = $this->baseQuery('c');

        if (($keyword = $this->strInput('keyword')) !== '') {
            $query->where(static function ($q) use ($keyword) {
                $q->where('c.coupon_name', 'like', "%{$keyword}%")
                    ->orWhere('c.description', 'like', "%{$keyword}%")
                    ->orWhere('c.promo_code', 'like', "%{$keyword}%")
                    ->orWhere('c.remark', 'like', "%{$keyword}%")
                    ->orWhere('m.merchant_name', 'like', "%{$keyword}%");
            });
        }
        if (($kind = $this->intInput('promotionKind')) > 0) {
            $query->where('c.promotion_kind', $kind);
        }
        if (($type = $this->intInput('couponType')) > 0) {
            $query->where('c.coupon_type', $type);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('c.status', (int) $status);
        }

        $total = (clone $query)->count();
        $list = $query->orderByDesc('c.id')
            ->forPage($page, $pageSize)
            ->get($this->columns())
            ->map(fn ($row) => $this->normalize((array) $row))
            ->all();

        return Result::page($list, $total, $page, $pageSize);
    }

    public function detail(): array
    {
        return Result::success($this->findScoped($this->requireId()));
    }

    /**
     * 抽屉用的选项集:本商户在范围内的酒店物业 + 其房型 + 只读币种。
     * 一次取齐,避免抽屉为物业/房型各发一次请求(且不再依赖物业上下文请求头)。
     */
    public function options(): array
    {
        $properties = Db::table('merchant_store as s')
            ->leftJoin('merchant_info as m', 'm.id', '=', 's.merchant_id')
            ->whereIn('s.merchant_id', $this->scopeMerchantIds())
            ->where('s.site_id', MerchantContext::siteId())
            ->where('s.business_type', 'hotel')
            ->whereIn('s.id', $this->scopePropertyIds())
            ->whereNull('s.deleted_at')
            ->orderBy('s.id')
            ->get(['s.id', 's.merchant_id', 's.store_name', 's.city_key', 'm.merchant_name'])
            ->map(static fn ($row) => [
                'id' => (int) $row->id,
                'merchant_id' => (int) $row->merchant_id,
                'merchant_name' => (string) ($row->merchant_name ?? ''),
                'property_name' => (string) $row->store_name,
                'city_key' => (string) ($row->city_key ?? ''),
            ])
            ->all();

        $propertyIds = array_column($properties, 'id');
        $roomTypes = $propertyIds === [] ? [] : Db::table('hotel_room_type')
            ->where('site_id', MerchantContext::siteId())
            ->whereIn('property_id', $propertyIds)
            ->whereNull('deleted_at')
            ->orderBy('property_id')
            ->orderBy('sort')
            ->orderBy('id')
            ->get(['id', 'property_id', 'room_name', 'base_price', 'currency'])
            ->map(static fn ($row) => [
                'id' => (int) $row->id,
                'property_id' => (int) $row->property_id,
                'room_name' => (string) $row->room_name,
                'base_price' => (float) $row->base_price,
                'currency' => (string) ($row->currency ?? ''),
            ])
            ->all();

        // 只读币种:优先取范围内房型已配置的币种(与房量价格页同一口径)
        $currency = '';
        foreach ($roomTypes as $room) {
            if ($room['currency'] !== '') {
                $currency = $room['currency'];
                break;
            }
        }

        return Result::success([
            'properties' => $properties,
            'roomTypes' => $roomTypes,
            'currency' => $currency !== '' ? $currency : 'THB',
        ]);
    }

    /**
     * 促销与活动效果:曝光 / 领券 / 核销 / 预订 / 转化率 / 促销收益 / 商户出资 / ROI。
     *
     * 口径(全部真算,不估算):
     * - 曝光量   = `marketing_promotion_impression.impressions` 求和(C 端列表/详情上报)
     * - 领券量   = `marketing_coupon_receive` 行数
     * - 核销量   = 领券记录 status=1
     * - 预订量   = 带券订单去重计数(`marketing_coupon_receive.order_id > 0`)
     * - 转化率   = 领券量 / 曝光量(曝光为 0 时返回 0,不返回 null 以免前端做空判断)
     * - 促销收益 = 带券订单的 `finance_account_entry.order_amount` 合计(即带券 GMV)
     * - 商户出资 = `finance_account_entry.merchant_pays` 合计(出资分摊已在结算侧落库)
     * - ROI      = 促销收益 / 商户出资
     */
    public function performance(): array
    {
        $range = $this->strInput('range', '30d');
        $days = match ($range) {
            '7d' => 7,
            '90d' => 90,
            'all' => 0,
            default => 30,
        };
        $from = $days > 0 ? date('Y-m-d', strtotime('-'.($days - 1).' days')) : null;
        $fromTime = $from !== null ? $from.' 00:00:00' : null;

        $ids = $this->scopedIds();
        $empty = [
            'range' => $range,
            'from' => $from,
            'impressions' => 0,
            'claims' => 0,
            'redemptions' => 0,
            'bookings' => 0,
            'conversionRate' => 0.0,
            'promotionRevenue' => 0.0,
            'merchantFunding' => 0.0,
            'platformFunding' => 0.0,
            'discountTotal' => 0.0,
            'roi' => 0.0,
            'list' => [],
            'trend' => [],
        ];
        if ($ids === []) {
            return Result::success($empty);
        }

        $impressions = $this->impressionSum($ids, $from);
        $receive = (array) Db::table('marketing_coupon_receive')
            ->whereIn('coupon_id', $ids)
            ->whereNull('deleted_at')
            ->when($fromTime !== null, static fn ($q) => $q->where('created_at', '>=', $fromTime))
            ->first([
                Db::raw('COUNT(*) AS claims'),
                Db::raw('SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS redemptions'),
                Db::raw('COUNT(DISTINCT CASE WHEN order_id > 0 THEN order_id END) AS bookings'),
            ]);
        // ⚠ `finance_account_entry.coupon_id` 存的是**领券记录 ID**(不是券模板 ID),
        //    必须经 marketing_coupon_receive 换算出模板维度,否则按模板 ID 直接过滤永远查不到数
        $finance = (array) Db::table('finance_account_entry as f')
            ->join('marketing_coupon_receive as r', 'r.id', '=', 'f.coupon_id')
            ->whereIn('r.coupon_id', $ids)
            ->when($fromTime !== null, static fn ($q) => $q->where('f.created_at', '>=', $fromTime))
            ->first([
                Db::raw('COALESCE(SUM(f.order_amount), 0) AS revenue'),
                Db::raw('COALESCE(SUM(f.discount_amount), 0) AS discount_total'),
                Db::raw('COALESCE(SUM(f.merchant_pays), 0) AS merchant_pays'),
                Db::raw('COALESCE(SUM(f.mtrip_pays), 0) AS mtrip_pays'),
            ]);

        $claims = (int) ($receive['claims'] ?? 0);
        $revenue = round((float) ($finance['revenue'] ?? 0), 2);
        $merchantPays = round((float) ($finance['merchant_pays'] ?? 0), 2);

        return Result::success([
            'range' => $range,
            'from' => $from,
            'impressions' => $impressions,
            'claims' => $claims,
            'redemptions' => (int) ($receive['redemptions'] ?? 0),
            'bookings' => (int) ($receive['bookings'] ?? 0),
            'conversionRate' => $impressions > 0 ? round($claims / $impressions, 4) : 0.0,
            'promotionRevenue' => $revenue,
            'merchantFunding' => $merchantPays,
            'platformFunding' => round((float) ($finance['mtrip_pays'] ?? 0), 2),
            'discountTotal' => round((float) ($finance['discount_total'] ?? 0), 2),
            'roi' => $merchantPays > 0 ? round($revenue / $merchantPays, 2) : 0.0,
            'list' => $this->performanceRows($ids, $from, $fromTime),
            'trend' => $this->performanceTrend($ids, $from, $days),
        ]);
    }

    #[Permission('mch:promotions:add')]
    public function add(): array
    {
        $merchantId = $this->resolveMerchantId();
        $data = $this->validatedPayload($merchantId);
        $data['merchant_id'] = $merchantId;
        $data['site_id'] = $this->merchantSiteId($merchantId);
        $data['status'] = 0;
        $data['created_by_merchant_admin'] = MerchantContext::adminId();
        $id = (int) Db::table('marketing_coupon')->insertGetId($data);
        $this->syncPromoCode($id);

        return Result::success(['id' => $id], 'promotion created');
    }

    #[Permission('mch:promotions:edit')]
    public function update(): array
    {
        $coupon = $this->findScoped($this->requireId());
        if (! in_array((int) $coupon['status'], [0, 2], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'only draft or paused promotions can be edited');
        }
        $data = $this->validatedPayload((int) $coupon['merchant_id'], (int) $coupon['id']);
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update($data);
        $this->syncPromoCode((int) $coupon['id']);

        return Result::success(null, 'promotion updated');
    }

    /**
     * 复制为一份新草稿(稿面行内 copy 图标)。
     * 领取/核销计数归零;优惠码重新生一个(原码仍属于原促销,不可复用)。
     */
    #[Permission('mch:promotions:duplicate')]
    public function duplicate(): array
    {
        $coupon = $this->findScoped($this->requireId());
        $data = [
            'site_id' => $coupon['site_id'],
            'merchant_id' => $coupon['merchant_id'],
            'created_by_merchant_admin' => MerchantContext::adminId(),
            'coupon_name' => mb_substr($coupon['coupon_name'].' (Copy)', 0, 100),
            'description' => $coupon['description'],
            'coupon_type' => $coupon['coupon_type'],
            'promotion_kind' => $coupon['promotion_kind'],
            'promo_code' => '',
            'discount_value' => $coupon['discount_value'],
            'min_amount' => $coupon['min_amount'],
            'max_discount' => $coupon['max_discount'],
            'funding_source' => $coupon['funding_source'],
            'funding_rules' => $coupon['funding_rules'],
            'goods_scope' => $coupon['goods_scope'],
            'goods_ids' => $coupon['goods_ids'],
            'property_ids' => $coupon['property_ids'],
            'sku_ids' => $coupon['sku_ids'],
            'room_type_ids' => $coupon['room_type_ids'],
            'total_count' => $coupon['total_count'],
            'received_count' => 0,
            'used_count' => 0,
            'per_user_limit' => $coupon['per_user_limit'],
            'min_nights' => $coupon['min_nights'],
            'max_nights' => $coupon['max_nights'],
            'book_advance_days' => $coupon['book_advance_days'],
            'valid_type' => $coupon['valid_type'],
            'valid_start' => $coupon['valid_start'],
            'valid_end' => $coupon['valid_end'],
            'valid_days' => $coupon['valid_days'],
            'stackable' => $coupon['stackable'] ?? 0,
            'status' => 0,
            'remark' => $coupon['remark'],
            'staff_note' => $coupon['staff_note'],
        ];
        $id = (int) Db::table('marketing_coupon')->insertGetId($data);
        $this->syncPromoCode($id);

        return Result::success(['id' => $id], 'promotion duplicated');
    }

    #[Permission('mch:promotions:status')]
    public function publish(): array
    {
        $coupon = $this->findScoped($this->requireId());
        if ((int) $coupon['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'only draft promotions can be published');
        }
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['status' => 1]);
        $this->syncPromoCode((int) $coupon['id']);

        return Result::success(['status' => 1], 'promotion published');
    }

    #[Permission('mch:promotions:status')]
    public function toggleStatus(): array
    {
        $coupon = $this->findScoped($this->requireId());
        $status = (int) $coupon['status'];
        if (! in_array($status, [1, 2], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'only active or paused promotions can be toggled');
        }
        $next = $status === 1 ? 2 : 1;
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['status' => $next]);
        $this->syncPromoCode((int) $coupon['id']);

        return Result::success(['status' => $next], 'promotion status updated');
    }

    #[Permission('mch:promotions:delete')]
    public function remove(): array
    {
        $coupon = $this->findScoped($this->requireId());
        if (! in_array((int) $coupon['status'], [0, 3], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'only draft or ended promotions can be deleted');
        }
        $now = date('Y-m-d H:i:s');
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['deleted_at' => $now]);
        // 券码一并作废,否则 C 端按码仍能兑换到已删除的券
        Db::table('marketing_promo_code')->where('coupon_id', $coupon['id'])->whereNull('deleted_at')
            ->update(['deleted_at' => $now, 'status' => 2]);

        return Result::success(null, 'promotion deleted');
    }

    // ─────────────────────────── 查询基础 ───────────────────────────

    private function baseQuery(string $alias = ''): mixed
    {
        if ($alias === 'c') {
            return Db::table('marketing_coupon as c')
                ->leftJoin('merchant_info as m', 'm.id', '=', 'c.merchant_id')
                ->whereNull('c.deleted_at')
                ->whereIn('c.merchant_id', $this->scopeMerchantIds())
                ->whereRaw('JSON_OVERLAPS(COALESCE(c.property_ids, JSON_ARRAY()), ?)', [json_encode($this->scopePropertyIds())]);
        }

        return Db::table('marketing_coupon')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $this->scopeMerchantIds())
            ->whereRaw('JSON_OVERLAPS(COALESCE(property_ids, JSON_ARRAY()), ?)', [json_encode($this->scopePropertyIds())]);
    }

    /** 当前范围内全部促销 ID(效果分析用;上限保护避免 IN 列表失控) */
    private function scopedIds(): array
    {
        return $this->baseQuery()
            ->orderByDesc('id')
            ->limit(500)
            ->pluck('id')
            ->map(static fn ($id) => (int) $id)
            ->all();
    }

    private function impressionSum(array $ids, ?string $from): int
    {
        if ($ids === []) {
            return 0;
        }

        return (int) Db::table('marketing_promotion_impression')
            ->whereIn('coupon_id', $ids)
            ->when($from !== null, static fn ($q) => $q->where('stat_date', '>=', $from))
            ->sum('impressions');
    }

    /** 效果明细:每张促销一行(曝光/领券/核销/收益/ROI) */
    private function performanceRows(array $ids, ?string $from, ?string $fromTime): array
    {
        $promotions = $this->baseQuery('c')->whereIn('c.id', $ids)
            ->orderByDesc('c.id')->limit(100)
            ->get([
                'c.id', 'c.coupon_name', 'c.promotion_kind', 'c.coupon_type', 'c.discount_value',
                'c.received_count', 'c.used_count', 'c.status',
            ])
            ->map(static fn ($row) => (array) $row)
            ->all();
        if ($promotions === []) {
            return [];
        }

        $impressionMap = $this->groupedMap(
            Db::table('marketing_promotion_impression')
                ->whereIn('coupon_id', $ids)
                ->when($from !== null, static fn ($q) => $q->where('stat_date', '>=', $from))
                ->groupBy('coupon_id')
                ->get([Db::raw('coupon_id AS k'), Db::raw('COALESCE(SUM(impressions), 0) AS v')]),
        );
        $receiveMap = $this->groupedMap(
            Db::table('marketing_coupon_receive')
                ->whereIn('coupon_id', $ids)->whereNull('deleted_at')
                ->when($fromTime !== null, static fn ($q) => $q->where('created_at', '>=', $fromTime))
                ->groupBy('coupon_id')
                ->get([Db::raw('coupon_id AS k'), Db::raw('COUNT(*) AS v')]),
        );
        $usedMap = $this->groupedMap(
            Db::table('marketing_coupon_receive')
                ->whereIn('coupon_id', $ids)->whereNull('deleted_at')->where('status', 1)
                ->when($fromTime !== null, static fn ($q) => $q->where('updated_at', '>=', $fromTime))
                ->groupBy('coupon_id')
                ->get([Db::raw('coupon_id AS k'), Db::raw('COUNT(*) AS v')]),
        );
        $financeMap = $this->groupedMap(
            Db::table('finance_account_entry as f')
                ->join('marketing_coupon_receive as r', 'r.id', '=', 'f.coupon_id')
                ->whereIn('r.coupon_id', $ids)
                ->when($fromTime !== null, static fn ($q) => $q->where('f.created_at', '>=', $fromTime))
                ->groupBy('r.coupon_id')
                ->get([
                    Db::raw('r.coupon_id AS k'),
                    Db::raw('COALESCE(SUM(f.order_amount), 0) AS v'),
                    Db::raw('COALESCE(SUM(f.merchant_pays), 0) AS v2'),
                ]),
        );

        return array_map(static function (array $promotion) use ($impressionMap, $receiveMap, $usedMap, $financeMap) {
            $id = (int) $promotion['id'];
            $impressions = (int) ($impressionMap[$id]['v'] ?? 0);
            $claims = (int) ($receiveMap[$id]['v'] ?? 0);
            $revenue = round($financeMap[$id]['v'] ?? 0.0, 2);
            $funding = round($financeMap[$id]['v2'] ?? 0.0, 2);
            $promotion['impressions'] = $impressions;
            $promotion['claims'] = $claims;
            $promotion['redemptions'] = (int) ($usedMap[$id]['v'] ?? 0);
            $promotion['conversionRate'] = $impressions > 0 ? round($claims / $impressions, 4) : 0.0;
            $promotion['promotionRevenue'] = $revenue;
            $promotion['merchantFunding'] = $funding;
            $promotion['roi'] = $funding > 0 ? round($revenue / $funding, 2) : 0.0;

            return $promotion;
        }, $promotions);
    }

    /**
     * `SELECT k, SUM(..) v [, SUM(..) v2]` 的行集转 `[k => ['v'=>float,'v2'=>float]]`。
     * 用分组查询代替逐条促销各查一次,避免 N+1。
     */
    private function groupedMap(iterable $rows): array
    {
        $map = [];
        foreach ($rows as $row) {
            $row = (array) $row;
            $map[(int) $row['k']] = [
                'v' => (float) $row['v'],
                'v2' => isset($row['v2']) ? (float) $row['v2'] : 0.0,
            ];
        }

        return $map;
    }

    /** 趋势序列(图表用):曝光按 `stat_date`,领券按领券时间的日期 */
    private function performanceTrend(array $ids, ?string $from, int $days): array
    {
        $window = $days > 0 ? $days : 30;
        $start = $from ?? date('Y-m-d', strtotime('-'.($window - 1).' days'));

        $impressions = [];
        foreach (Db::table('marketing_promotion_impression')
            ->whereIn('coupon_id', $ids)
            ->where('stat_date', '>=', $start)
            ->groupBy('stat_date')
            ->get([Db::raw('stat_date AS d'), Db::raw('COALESCE(SUM(impressions), 0) AS v')]) as $row) {
            $impressions[(string) $row->d] = (int) $row->v;
        }
        $claims = [];
        foreach (Db::table('marketing_coupon_receive')
            ->whereIn('coupon_id', $ids)->whereNull('deleted_at')
            ->where('created_at', '>=', $start.' 00:00:00')
            ->groupBy(Db::raw('DATE(created_at)'))
            ->get([Db::raw('DATE(created_at) AS d'), Db::raw('COUNT(*) AS v')]) as $row) {
            $claims[(string) $row->d] = (int) $row->v;
        }

        $trend = [];
        for ($i = 0; $i < $window; $i++) {
            $date = date('Y-m-d', strtotime($start.' +'.$i.' days'));
            $trend[] = [
                'date' => $date,
                'impressions' => $impressions[$date] ?? 0,
                'claims' => $claims[$date] ?? 0,
            ];
        }

        return $trend;
    }

    private function columns(): array
    {
        return [
            'c.id', 'c.site_id', 'c.merchant_id', 'c.coupon_name', 'c.description', 'c.coupon_type',
            'c.promotion_kind', 'c.promo_code', 'c.discount_value', 'c.min_amount', 'c.max_discount',
            'c.funding_source', 'c.funding_rules', 'c.goods_scope', 'c.goods_ids', 'c.property_ids',
            'c.sku_ids', 'c.room_type_ids', 'c.total_count', 'c.received_count', 'c.used_count',
            'c.per_user_limit', 'c.min_nights', 'c.max_nights', 'c.book_advance_days',
            'c.valid_type', 'c.valid_start', 'c.valid_end', 'c.valid_days', 'c.status',
            'c.remark', 'c.staff_note', 'c.created_at', 'c.updated_at', 'm.merchant_name',
        ];
    }

    private function findScoped(int $id): array
    {
        $row = $this->baseQuery('c')->where('c.id', $id)->first($this->columns());
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, 'promotion not found');
        }

        return $this->normalize((array) $row);
    }

    // ─────────────────────────── 表单校验 ───────────────────────────

    private function validatedPayload(int $merchantId, int $editingId = 0): array
    {
        $kind = $this->intInput('promotionKind');
        if (! in_array($kind, [self::KIND_PERCENTAGE, self::KIND_FIXED_AMOUNT, self::KIND_PROMO_CODE, self::KIND_LONG_STAY], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'invalid promotionKind');
        }

        // 折扣单位:百分比/长住固定按「立减百分比」;固定金额固定按金额;优惠码由用户选
        $unit = match ($kind) {
            self::KIND_PERCENTAGE, self::KIND_LONG_STAY => self::UNIT_PERCENT,
            self::KIND_FIXED_AMOUNT => self::UNIT_AMOUNT,
            default => $this->intInput('discountUnit') === self::UNIT_AMOUNT ? self::UNIT_AMOUNT : self::UNIT_PERCENT,
        };
        $discountValue = round($this->floatInput('discountValue'), 2);
        if ($discountValue <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'discountValue must be greater than 0');
        }
        [$couponType, $storedDiscount] = $this->discountPair($unit, $discountValue);

        $propertyIds = $this->validPropertyIds($merchantId, (array) ($this->input('propertyIds') ?? []));
        if ($propertyIds === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'please select at least one property');
        }
        $roomTypeIds = $this->validRoomTypeIds($propertyIds, (array) ($this->input('roomTypeIds') ?? []));

        $promoCode = strtoupper($this->strInput('promoCode'));
        if ($kind === self::KIND_PROMO_CODE) {
            if ($promoCode === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'promoCode is required for coupon code promotions');
            }
            if (! preg_match('/^[A-Z0-9_-]{3,32}$/', $promoCode)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'promoCode must be 3-32 chars of A-Z, 0-9, _ or -');
            }
            $this->assertPromoCodeFree($promoCode, $merchantId, $editingId);
        } else {
            $promoCode = '';
        }

        $minNights = 0;
        $maxNights = 0;
        if ($kind === self::KIND_LONG_STAY) {
            $minNights = $this->intInput('minNights');
            if ($minNights < 2) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'minNights must be at least 2');
            }
            $maxNights = max(0, $this->intInput('maxNights'));
            if ($maxNights > 0 && $maxNights < $minNights) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'maxNights must not be less than minNights');
            }
        }

        $validType = $this->intInput('validType', 1);
        if (! in_array($validType, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'invalid validType');
        }
        $validStart = $this->strInput('validStart');
        $validEnd = $this->strInput('validEnd');
        $validDays = $this->intInput('validDays');
        // 稿面「No expiry date」勾选 → 固定日期口径但不设结束时间(下游 claimBlocker 对空 valid_end 视为不过期)
        $noExpiry = $this->intInput('noExpiry') === 1;
        if ($validType === 1) {
            if ($validStart === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'validStart is required');
            }
            if (! $noExpiry && ($validEnd === '' || $validStart > $validEnd)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'invalid valid date range');
            }
        } elseif ($validDays <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'validDays must be greater than 0');
        }

        return [
            'coupon_name' => mb_substr($this->requireStr('couponName'), 0, 100),
            'description' => mb_substr($this->strInput('description'), 0, 255),
            'coupon_type' => $couponType,
            'promotion_kind' => $kind,
            'promo_code' => $promoCode,
            'discount_value' => $storedDiscount,
            'min_amount' => round($this->floatInput('minAmount'), 2),
            'max_discount' => round($this->floatInput('maxDiscount'), 2),
            // 商家自建促销一律商家全额出资;平台出资/共担来自平台活动(见 Merchant/CampaignController)
            'funding_source' => 2,
            'funding_rules' => json_encode(['merchant' => 100], JSON_UNESCAPED_UNICODE),
            'goods_scope' => 3,
            'goods_ids' => null,
            'property_ids' => json_encode($propertyIds, JSON_UNESCAPED_UNICODE),
            'sku_ids' => null,
            'room_type_ids' => $roomTypeIds === [] ? null : json_encode($roomTypeIds, JSON_UNESCAPED_UNICODE),
            'total_count' => max(0, $this->intInput('totalCount')),
            'per_user_limit' => max(1, $this->intInput('perUserLimit', 1)),
            'min_nights' => $minNights,
            'max_nights' => $maxNights,
            'book_advance_days' => max(0, $this->intInput('bookAdvanceDays')),
            'valid_type' => $validType,
            'valid_start' => $validType === 1 ? $validStart : null,
            'valid_end' => $validType === 1 && ! $noExpiry ? $validEnd : null,
            'valid_days' => $validType === 2 ? $validDays : 0,
            'remark' => mb_substr($this->strInput('remark'), 0, 500),
            'staff_note' => mb_substr($this->strInput('staffNote'), 0, 500),
        ];
    }

    /**
     * 设计口径 → 计价口径。
     * `coupon_type=2` 时下游把 `discount_value` 当 **10 分制折扣率**(8.50 = 用户付 85%),
     * 所以「立减 15%」要存 8.50,即 `(100 - percentOff) / 10`。
     *
     * @return array{0:int,1:float} [coupon_type, discount_value]
     */
    private function discountPair(int $unit, float $value): array
    {
        if ($unit === self::UNIT_AMOUNT) {
            return [1, round($value, 2)];
        }
        if ($value >= 100) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'percentage discount must be less than 100');
        }

        return [2, round((100 - $value) / 10, 2)];
    }

    private function assertPromoCodeFree(string $code, int $merchantId, int $editingId): void
    {
        $siteId = $this->merchantSiteId($merchantId);
        $exists = Db::table('marketing_coupon')
            ->where('site_id', $siteId)
            ->where('promo_code', $code)
            ->whereNull('deleted_at')
            ->when($editingId > 0, static fn ($q) => $q->where('id', '<>', $editingId))
            ->exists();
        if ($exists) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'promo code already in use');
        }
        // 与平台促销码同一张码表,需一并避开,否则 C 端 /coupon/redeem 会命中错的那条。
        // ⚠ 必须排除「本促销自己的镜像行」,否则编辑优惠码促销时即使没改码也会被判重复。
        if (Db::table('marketing_promo_code')
            ->where('code', $code)
            ->whereNull('deleted_at')
            ->when($editingId > 0, static fn ($q) => $q->where('coupon_id', '<>', $editingId))
            ->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'promo code already in use');
        }
    }

    /**
     * 让 `promotion_kind=3` 的券码在 C 端真的能兑换。
     *
     * C 端 `/app/marketing/coupon/redeem` 查的是 `marketing_promo_code`(按 code 全局查,
     * 且要求 `coupon_id > 0`),所以商户建/改/上下架优惠码促销时同步一份镜像行。
     * 非优惠码促销或码为空时不写;促销删除时由 `remove()` 一并软删。
     */
    private function syncPromoCode(int $couponId): void
    {
        $coupon = Db::table('marketing_coupon')->where('id', $couponId)->whereNull('deleted_at')->first();
        if (! $coupon) {
            return;
        }
        $coupon = (array) $coupon;
        $code = (string) ($coupon['promo_code'] ?? '');
        if ((int) $coupon['promotion_kind'] !== self::KIND_PROMO_CODE || $code === '') {
            return;
        }

        $type = (int) $coupon['coupon_type'];
        $value = (float) $coupon['discount_value'];
        $data = [
            'site_id' => (int) $coupon['site_id'],
            'name' => (string) $coupon['coupon_name'],
            'coupon_id' => $couponId,
            'discount_type' => $type === 2 ? 'percentage' : 'amount',
            'discount_value' => $value,
            'discount_display' => $this->discountDisplay($type, $value),
            'status' => self::PROMO_CODE_STATUS_MAP[(int) $coupon['status']] ?? 5,
            'start_date' => $coupon['valid_start'] ? substr((string) $coupon['valid_start'], 0, 10) : null,
            'end_date' => $coupon['valid_end'] ? substr((string) $coupon['valid_end'], 0, 10) : null,
            'usage_limit' => (int) $coupon['total_count'],
            'per_user_limit' => (int) $coupon['per_user_limit'],
            'min_spend' => (int) round((float) $coupon['min_amount']),
            'stackable' => (int) ($coupon['stackable'] ?? 0),
            'merchant_scope' => 'custom',
            'merchant_count' => 1,
            'created_by' => MerchantContext::adminName() ?: 'Merchant',
        ];

        $existing = Db::table('marketing_promo_code')->where('coupon_id', $couponId)
            ->whereNull('deleted_at')->orderBy('id')->first();
        if ($existing) {
            Db::table('marketing_promo_code')->where('id', (int) $existing->id)->update($data);

            return;
        }
        if (Db::table('marketing_promo_code')->where('code', $code)->whereNull('deleted_at')->exists()) {
            return;
        }
        $data['code'] = $code;
        Db::table('marketing_promo_code')->insert($data);
    }

    /** 促销码展示文案(与 C 端券口径一致:折扣券按「立减百分比」写) */
    private function discountDisplay(int $couponType, float $value): string
    {
        if ($couponType === 2) {
            return rtrim(rtrim(number_format((10 - $value) * 10, 2, '.', ''), '0'), '.').'% OFF';
        }

        return number_format($value, 2, '.', '').' OFF';
    }

    private function validPropertyIds(int $merchantId, array $inputIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $inputIds))));
        if ($ids === []) {
            return [];
        }

        $valid = Db::table('merchant_store')
            ->where('merchant_id', $merchantId)
            ->where('site_id', MerchantContext::siteId())
            ->where('business_type', 'hotel')
            ->whereIn('id', $ids)
            ->whereNull('deleted_at')
            ->whereIn('id', $this->scopePropertyIds())
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        sort($valid);
        sort($ids);
        if ($valid !== $ids) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, 'selected properties are out of scope');
        }

        return $ids;
    }

    private function validRoomTypeIds(array $propertyIds, array $inputIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $inputIds))));
        if ($ids === []) {
            return [];
        }
        $valid = Db::table('hotel_room_type')->where('site_id', MerchantContext::siteId())
            ->whereIn('property_id', $propertyIds)->whereIn('id', $ids)->whereNull('deleted_at')
            ->pluck('id')->map(fn ($id) => (int) $id)->all();
        sort($valid);
        sort($ids);
        if ($valid !== $ids) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, 'selected room types are out of scope');
        }

        return $ids;
    }

    private function resolveMerchantId(): int
    {
        $scope = MerchantContext::scopeMerchantIds();
        if ($scope === []) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        if (MerchantContext::accountType() === 1) {
            $merchantId = $this->requireId('merchantId');
            if (! in_array($merchantId, $scope, true)) {
                throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, 'merchant out of scope');
            }

            return $merchantId;
        }

        return $scope[0];
    }

    private function merchantSiteId(int $merchantId): int
    {
        return (int) (Db::table('merchant_info')->where('id', $merchantId)->value('site_id') ?? MerchantContext::siteId());
    }

    private function normalize(array $row): array
    {
        $row['goods_ids'] = $this->jsonDecode($row['goods_ids'] ?? null);
        $row['property_ids'] = $this->jsonDecode($row['property_ids'] ?? null);
        $row['sku_ids'] = $this->jsonDecode($row['sku_ids'] ?? null);
        $row['room_type_ids'] = $this->jsonDecode($row['room_type_ids'] ?? null);
        $row['funding_rules'] = $this->jsonDecode($row['funding_rules'] ?? null);
        $row['budget_estimate'] = round(((int) ($row['total_count'] ?? 0)) * ((float) ($row['discount_value'] ?? 0)), 2);
        // 设计口径的「立减百分比」,供前端直接渲染 15% Off(折扣券 discount_value 是 10 分制)
        $row['discount_percent_off'] = (int) ($row['coupon_type'] ?? 1) === 2
            ? round((10 - (float) $row['discount_value']) * 10, 2)
            : 0.0;
        unset($row['deleted_at']);

        return $row;
    }

    private function scopeMerchantIds(): array
    {
        $ids = MerchantContext::scopeMerchantIds();

        return $ids === [] ? [0] : $ids;
    }

    private function scopePropertyIds(): array
    {
        $ids = MerchantContext::scopePropertyIds();

        return $ids === [] ? [0] : $ids;
    }

    private function jsonDecode(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);

            return is_array($decoded) ? $decoded : [];
        }

        return [];
    }
}
