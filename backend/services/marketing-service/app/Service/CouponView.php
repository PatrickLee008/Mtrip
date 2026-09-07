<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;

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
    public const REASON_OFFLINE = 'offline';             // 活动已停发/结束

    /** 券模板需要的列(领券中心 / 活动详情 / 券详情) */
    public const TEMPLATE_COLUMNS = [
        'id', 'coupon_name', 'coupon_type', 'discount_value', 'min_amount', 'max_discount',
        'goods_scope', 'goods_ids', 'sku_ids', 'total_count', 'received_count', 'per_user_limit',
        'valid_type', 'valid_start', 'valid_end', 'valid_days', 'stackable', 'status', 'remark',
    ];

    /** 领券记录 + 模板的联表列(我的优惠券 / 结账) */
    public const RECEIVE_COLUMNS = [
        'r.id as receive_id', 'r.coupon_code', 'r.status as receive_status',
        'r.valid_start', 'r.valid_end', 'r.order_id',
        'c.id', 'c.coupon_name', 'c.coupon_type', 'c.discount_value', 'c.min_amount',
        'c.max_discount', 'c.goods_scope', 'c.goods_ids', 'c.sku_ids', 'c.stackable',
        'c.status as template_status', 'c.remark',
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
     * @param array|null $ctx 下单上下文 ['orderType'=>int,'goodsId'=>int,'skuId'=>int,'amount'=>float];
     *                        传了才会判定门槛/范围并算抵扣额
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

        // 有下单上下文时再叠一层「这单能不能用」的判定
        $view['discount'] = 0.0;
        if ($ctx !== null && $view['unusableReason'] === null) {
            $scopeOk = $this->matchScope($row, (int) ($ctx['orderType'] ?? 1), (int) ($ctx['goodsId'] ?? 0), (int) ($ctx['skuId'] ?? 0));
            $amount = round((float) ($ctx['amount'] ?? 0), 2);
            if (! $scopeOk) {
                $view['status'] = self::STATUS_UNUSABLE;
                $view['unusableReason'] = self::REASON_SCOPE;
            } elseif ((float) $row['min_amount'] > 0 && $amount < (float) $row['min_amount']) {
                $view['status'] = self::STATUS_UNUSABLE;
                $view['unusableReason'] = self::REASON_MIN_AMOUNT;
            } else {
                $view['discount'] = $this->discount($row, $amount);
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
        $goodsIds = [];
        $skuIds = [];
        foreach ($views as $view) {
            foreach ($view['goods_ids'] as $id) {
                $goodsIds[$id] = true;
            }
            foreach ($view['sku_ids'] as $id) {
                $skuIds[$id] = true;
            }
        }
        $goodsNames = $goodsIds === [] ? [] : Db::table('goods_info')
            ->whereIn('id', array_keys($goodsIds))->whereNull('deleted_at')
            ->pluck('goods_name', 'id');
        $rooms = $skuIds === [] ? [] : Db::table('hotel_room_type')
            ->whereIn('id', array_keys($skuIds))->whereNull('deleted_at')
            ->get(['id', 'goods_id', 'room_name'])->keyBy('id');

        foreach ($views as &$view) {
            $view['applicable_hotels'] = [];
            foreach ($view['goods_ids'] as $id) {
                $view['applicable_hotels'][] = [
                    'goods_id' => $id,
                    'goods_name' => (string) ($goodsNames[$id] ?? ''),
                ];
            }
            $view['applicable_rooms'] = [];
            foreach ($view['sku_ids'] as $id) {
                $room = $rooms[$id] ?? null;
                $view['applicable_rooms'][] = [
                    'sku_id' => $id,
                    'goods_id' => $room ? (int) $room->goods_id : 0,
                    'room_name' => $room ? (string) $room->room_name : '',
                ];
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

    /**
     * 该券对给定金额的抵扣额(已确认范围与门槛通过)。
     * 规则与 order-service 的 resolveCoupon 保持一致:折扣券按 10 分制,封顶后不超过订单金额。
     */
    public function discount(array $coupon, float $base): float
    {
        $type = (int) $coupon['coupon_type'];
        $val = (float) $coupon['discount_value'];
        $maxD = (float) $coupon['max_discount'];
        if ($type === 2) {
            $amount = round($base * (1 - $val / 10), 2);
            if ($maxD > 0 && $amount > $maxD) {
                $amount = $maxD;
            }
        } else {
            $amount = $val;
        }
        return max(0.0, min(round($amount, 2), $base));
    }

    /** 适用范围判定:品类 → 指定酒店 → 指定房型 */
    public function matchScope(array $coupon, int $orderType, int $goodsId, int $skuId = 0): bool
    {
        $scope = (int) $coupon['goods_scope'];
        if (($scope === 1 && $orderType !== 1) || ($scope === 2 && $orderType !== 2)) {
            return false;
        }
        if ($scope === 3) {
            $ids = $this->idList($coupon['goods_ids'] ?? null);
            if (! in_array($goodsId, $ids, true)) {
                return false;
            }
        }
        // 房型限制独立于 goods_scope:为空 = 不限房型
        $skus = $this->idList($coupon['sku_ids'] ?? null);
        if ($skus !== [] && $skuId > 0 && ! in_array($skuId, $skus, true)) {
            return false;
        }
        return true;
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
            'sku_ids' => $this->idList($row['sku_ids'] ?? null),
            'stackable' => (int) ($row['stackable'] ?? 0),
            'valid_start' => $row['valid_start'] ?? null,
            'valid_end' => $row['valid_end'] ?? null,
            'remark' => (string) ($row['remark'] ?? ''),
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
