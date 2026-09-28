<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Support\CouponEligibility;

/**
 * 统一优惠券字段口径(C-M6)
 *
 * 领券中心、活动详情、券详情、我的优惠券、结账择优/可用券列表 —— 全部走这一个出口,
 * 保证同一张券在任何页面上的「券类型 / 优惠值 / 门槛 / 封顶 / 适用酒店房型 / 有效期 /
 * 叠加规则 / 状态 / 不可用原因」都是同一套字段与同一套判定。
 *
 * 字段命名沿用本服务既有约定:**库列 snake_case 直出,计算值 camelCase**
 * (`marketing_coupon` 的列名保持不变,便于与后台/商户端对齐)。
 *
 * 状态与不可用原因一律下发**机器码**,文案由各端 i18n 决定 —— 后端不下发中文给 App。
 */
class CouponView
{
    /* ---- 券状态(status) ---- */
    /** 未领取,当前可领 */
    public const STATUS_CLAIMABLE = 'claimable';
    /** 未领取,但已领完/已达限领/已过期,不可领 */
    public const STATUS_UNCLAIMABLE = 'unclaimable';
    /** 已领取且可用 */
    public const STATUS_AVAILABLE = 'available';
    /** 已领取,但在当前下单上下文里用不了(门槛/范围等) */
    public const STATUS_UNUSABLE = 'unusable';
    /** 已使用 */
    public const STATUS_USED = 'used';
    /** 已过期 */
    public const STATUS_EXPIRED = 'expired';
    /** 已作废 */
    public const STATUS_VOID = 'void';

    /* ---- 不可领/不可用原因(unusableReason) ---- */
    public const REASON_SOLD_OUT = 'sold_out';           // 已领完
    public const REASON_LIMIT_REACHED = 'limit_reached'; // 已达个人限领
    public const REASON_NOT_STARTED = 'not_started';     // 未生效
    public const REASON_EXPIRED = 'expired';             // 已过期
    public const REASON_USED = 'used';                   // 已使用
    public const REASON_VOID = 'void';                   // 已作废
    public const REASON_MIN_AMOUNT = 'min_amount';       // 未达使用门槛
    public const REASON_SCOPE = 'scope';                 // 适用范围不符(品类/酒店/房型)
    /* PRD §17.5 资格条件(值与 shared CouponEligibility::REASON_* 一致) */
    public const REASON_NIGHTS = CouponEligibility::REASON_NIGHTS;         // 入住晚数不符(长住)
    public const REASON_ADVANCE = CouponEligibility::REASON_ADVANCE;       // 未满提前预订天数(早鸟)
    public const REASON_STAY_DATE = CouponEligibility::REASON_STAY_DATE;   // 入住日期不在适用期
    public const REASON_MIN_ROOMS = CouponEligibility::REASON_MIN_ROOMS;   // 未达最少间数
    public const REASON_MIN_HOTELS = CouponEligibility::REASON_MIN_HOTELS; // 未达最少酒店数
    public const REASON_OFFLINE = 'offline';             // 活动已停发/结束

    /** 券模板需要的列(领券中心 / 活动详情 / 券详情) */
    public const TEMPLATE_COLUMNS = [
        'id', 'coupon_name', 'coupon_type', 'discount_value', 'min_amount', 'max_discount',
        'goods_scope', 'goods_ids', 'property_ids', 'sku_ids', 'room_type_ids', 'total_count', 'received_count', 'per_user_limit',
        'valid_type', 'valid_start', 'valid_end', 'valid_days', 'stackable', 'status', 'remark',
        'min_nights', 'max_nights', 'book_advance_days', 'min_room_count', 'min_hotel_count', 'stay_start', 'stay_end',
    ];

    /** 领券记录 + 模板的联表列(我的优惠券 / 结账) */
    public const RECEIVE_COLUMNS = [
        'r.id as receive_id', 'r.coupon_code', 'r.status as receive_status',
        'r.valid_start', 'r.valid_end', 'r.order_id',
        'c.id', 'c.coupon_name', 'c.coupon_type', 'c.discount_value', 'c.min_amount',
        'c.max_discount', 'c.goods_scope', 'c.goods_ids', 'c.property_ids', 'c.sku_ids', 'c.room_type_ids', 'c.stackable',
        'c.status as template_status', 'c.remark',
        'c.min_nights', 'c.max_nights', 'c.book_advance_days', 'c.min_room_count', 'c.min_hotel_count', 'c.stay_start', 'c.stay_end',
    ];

    /**
     * 券模板视图(尚未领取的券)
     *
     * @param array $row          `marketing_coupon` 行(至少含 TEMPLATE_COLUMNS)
     * @param int   $myReceived   本人已领张数
     */
    public function template(array $row, int $myReceived = 0, ?int $now = null): array
    {
        $now ??= time();
        $view = $this->baseFields($row);
        $view['coupon_id'] = (int) $row['id'];
        $view['receive_id'] = 0;
        $view['coupon_code'] = '';
        $view['total_count'] = (int) ($row['total_count'] ?? 0);
        $view['received_count'] = (int) ($row['received_count'] ?? 0);
        $view['per_user_limit'] = (int) ($row['per_user_limit'] ?? 0);
        $view['myReceived'] = $myReceived;

        // 模板的有效期:固定日期型直出;领后N天型没有绝对区间,只给天数
        $view['valid_type'] = (int) ($row['valid_type'] ?? 1);
        $view['valid_days'] = (int) ($row['valid_days'] ?? 0);
        if ($view['valid_type'] === 2) {
            $view['valid_start'] = null;
            $view['valid_end'] = null;
        }

        $reason = $this->claimBlocker($row, $myReceived, $now);
        $view['canClaim'] = $reason === null;
        $view['status'] = $reason === null ? self::STATUS_CLAIMABLE : self::STATUS_UNCLAIMABLE;
        $view['unusableReason'] = $reason;
        return $view;
    }

    /**
     * 领券记录视图(我的优惠券 / 结账)
     *
     * @param array      $row `marketing_coupon_receive` join `marketing_coupon`(RECEIVE_COLUMNS)
     * @param array|null $ctx 下单上下文;传了才会判定资格并算抵扣额。两种形状:
     *   - 整单:['orderType'=>1,'items'=>[{propertyId,roomTypeId,quantity,nights,checkIn,checkOut,amount},...]]
     *     (多房间/多酒店,按行判定与分摊,与 order-service 下单同一实现 CouponEligibility)
     *   - 单项(旧):['orderType','propertyId','roomTypeId','goodsId','skuId','amount'] —— 视为一行,缺日期则不判日期类条件
     */
    public function receive(array $row, ?array $ctx = null, ?int $now = null): array
    {
        $now ??= time();
        $view = $this->baseFields($row);
        $view['coupon_id'] = (int) $row['id'];
        $view['receive_id'] = (int) $row['receive_id'];
        $view['coupon_code'] = (string) $row['coupon_code'];
        $view['order_id'] = (int) ($row['order_id'] ?? 0);

        $status = (int) $row['receive_status'];
        $expired = $row['valid_end'] !== null && $now > strtotime((string) $row['valid_end']);
        $notStarted = $row['valid_start'] !== null && $now < strtotime((string) $row['valid_start']);

        if ($status === 1) {
            $view['status'] = self::STATUS_USED;
            $view['unusableReason'] = self::REASON_USED;
        } elseif ($status === 3) {
            $view['status'] = self::STATUS_VOID;
            $view['unusableReason'] = self::REASON_VOID;
        } elseif ($status === 2 || $expired) {
            $view['status'] = self::STATUS_EXPIRED;
            $view['unusableReason'] = self::REASON_EXPIRED;
        } elseif ($notStarted) {
            $view['status'] = self::STATUS_UNUSABLE;
            $view['unusableReason'] = self::REASON_NOT_STARTED;
        } else {
            $view['status'] = self::STATUS_AVAILABLE;
            $view['unusableReason'] = null;
        }

        // 有下单上下文时再叠一层「这单能不能用」的判定(PRD §17.5/§17.6,与下单同一实现)
        $view['discount'] = 0.0;
        if ($ctx !== null && $view['unusableReason'] === null) {
            $result = CouponEligibility::evaluate($row, $this->legsOf($ctx), (int) ($ctx['orderType'] ?? 1), date('Y-m-d', $now));
            if (! $result['eligible']) {
                $view['status'] = self::STATUS_UNUSABLE;
                $view['unusableReason'] = $result['reason'];
            } else {
                $view['discount'] = $result['discount'];
            }
        }
        return $view;
    }

    /**
     * 批量补「适用酒店 / 适用房型」的名称,避免逐条 N+1。
     * 传入引用,原地写 applicable_hotels / applicable_rooms。
     *
     * @param array<int, array> $views
     */
    public function attachApplicable(array &$views): void
    {
        $propertyIds = [];
        $roomTypeIds = [];
        $goodsIds = [];
        $skuIds = [];
        foreach ($views as $view) {
            foreach ($view['property_ids'] as $id) {
                $propertyIds[$id] = true;
            }
            foreach ($view['room_type_ids'] as $id) {
                $roomTypeIds[$id] = true;
            }
            foreach ($view['goods_ids'] as $id) $goodsIds[$id] = true;
            foreach ($view['sku_ids'] as $id) $skuIds[$id] = true;
        }
        $propertyNames = $propertyIds === [] ? [] : Db::table('merchant_store')
            ->whereIn('id', array_keys($propertyIds))->whereNull('deleted_at')->pluck('store_name', 'id');
        $rooms = $roomTypeIds === [] ? [] : Db::table('hotel_room_type')
            ->whereIn('id', array_keys($roomTypeIds))->whereNull('deleted_at')
            ->get(['id', 'property_id', 'room_name'])->keyBy('id');
        $goodsNames = $goodsIds === [] ? [] : Db::table('goods_info')->whereIn('id', array_keys($goodsIds))
            ->whereNull('deleted_at')->pluck('goods_name', 'id');
        $tickets = $skuIds === [] ? [] : Db::table('ticket_type')->whereIn('id', array_keys($skuIds))
            ->whereNull('deleted_at')->get(['id', 'goods_id', 'ticket_name'])->keyBy('id');

        foreach ($views as &$view) {
            $view['applicable_hotels'] = [];
            foreach ($view['property_ids'] as $id) {
                $view['applicable_hotels'][] = [
                    'property_id' => $id,
                    'property_name' => (string) ($propertyNames[$id] ?? ''),
                ];
            }
            $view['applicable_rooms'] = [];
            foreach ($view['room_type_ids'] as $id) {
                $room = $rooms[$id] ?? null;
                $view['applicable_rooms'][] = [
                    'room_type_id' => $id,
                    'property_id' => $room ? (int) $room->property_id : 0,
                    'room_name' => $room ? (string) $room->room_name : '',
                ];
            }
            $view['applicable_goods'] = [];
            foreach ($view['goods_ids'] as $id) {
                $view['applicable_goods'][] = ['goods_id' => $id, 'goods_name' => (string) ($goodsNames[$id] ?? '')];
            }
            $view['applicable_ticket_types'] = [];
            foreach ($view['sku_ids'] as $id) {
                $ticket = $tickets[$id] ?? null;
                $view['applicable_ticket_types'][] = ['sku_id' => $id, 'goods_id' => $ticket ? (int) $ticket->goods_id : 0,
                    'ticket_name' => $ticket ? (string) $ticket->ticket_name : ''];
            }
        }
        unset($view);
    }

    /** 单条视图的适用范围补名(内部复用批量实现) */
    public function attachApplicableOne(array $view): array
    {
        $list = [$view];
        $this->attachApplicable($list);
        return $list[0];
    }

    /** 下单上下文 → CouponEligibility 的行:优先整单 items,否则把单项字段当成一行 */
    private function legsOf(array $ctx): array
    {
        $items = $ctx['items'] ?? null;
        if (is_array($items) && $items !== []) {
            return array_values(array_map(static fn ($item) => (array) $item + ['amount' => 0.0], $items));
        }
        return [[
            'propertyId' => (int) ($ctx['propertyId'] ?? 0),
            'roomTypeId' => (int) ($ctx['roomTypeId'] ?? 0),
            'goodsId' => (int) ($ctx['goodsId'] ?? 0),
            'skuId' => (int) ($ctx['skuId'] ?? 0),
            'amount' => round((float) ($ctx['amount'] ?? 0), 2),
        ]];
    }

    /** 领取侧的拦截原因(null = 可领) */
    private function claimBlocker(array $row, int $myReceived, int $now): ?string
    {
        if ((int) ($row['status'] ?? 0) !== 1) {
            return self::REASON_OFFLINE;
        }
        $validType = (int) ($row['valid_type'] ?? 1);
        if ($validType === 1) {
            if (! empty($row['valid_start']) && $now < strtotime((string) $row['valid_start'])) {
                return self::REASON_NOT_STARTED;
            }
            if (! empty($row['valid_end']) && $now > strtotime((string) $row['valid_end'])) {
                return self::REASON_EXPIRED;
            }
        }
        $total = (int) ($row['total_count'] ?? 0);
        if ($total > 0 && (int) ($row['received_count'] ?? 0) >= $total) {
            return self::REASON_SOLD_OUT;
        }
        $limit = (int) ($row['per_user_limit'] ?? 0);
        if ($limit > 0 && $myReceived >= $limit) {
            return self::REASON_LIMIT_REACHED;
        }
        return null;
    }

    /** 模板与领券记录共有的展示字段 */
    private function baseFields(array $row): array
    {
        return [
            'coupon_name' => (string) $row['coupon_name'],
            'coupon_type' => (int) $row['coupon_type'],
            'discount_value' => (float) $row['discount_value'],
            'min_amount' => (float) $row['min_amount'],
            'max_discount' => (float) $row['max_discount'],
            'goods_scope' => (int) $row['goods_scope'],
            'goods_ids' => $this->idList($row['goods_ids'] ?? null),
            'property_ids' => $this->idList($row['property_ids'] ?? null),
            'sku_ids' => $this->idList($row['sku_ids'] ?? null),
            'room_type_ids' => $this->idList($row['room_type_ids'] ?? null),
            'stackable' => (int) ($row['stackable'] ?? 0),
            'valid_start' => $row['valid_start'] ?? null,
            'valid_end' => $row['valid_end'] ?? null,
            'remark' => (string) ($row['remark'] ?? ''),
            // PRD §17.5 资格条件(App 券详情展示「使用条件」用;0 / null = 不限)
            'min_nights' => (int) ($row['min_nights'] ?? 0),
            'max_nights' => (int) ($row['max_nights'] ?? 0),
            'book_advance_days' => (int) ($row['book_advance_days'] ?? 0),
            'min_room_count' => (int) ($row['min_room_count'] ?? 0),
            'min_hotel_count' => (int) ($row['min_hotel_count'] ?? 0),
            'stay_start' => $row['stay_start'] ?? null,
            'stay_end' => $row['stay_end'] ?? null,
        ];
    }

    /** JSON 列 → int[](库里可能是 JSON 字符串,也可能已被驱动解成数组) */
    private function idList(mixed $raw): array
    {
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }
        if (! is_array($raw)) {
            return [];
        }
        return array_values(array_filter(array_map('intval', $raw), static fn ($id) => $id > 0));
    }
}
