<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * 优惠券资格判定与分摊(PRD Consumer App v1.0.1 §17.5 / §17.6)—— 纯逻辑,无 DB。
 *
 * 唯一实现:下单计价(order-service PricingService)与结账选券列表(marketing-service CouponView)
 * 都调它,保证「列表上说能用、能抵多少」与「下单实际能用、实际抵多少」同一口径。
 *
 * 输入是一次预订的若干「行」(leg):酒店 = 一个物业的一个房型一段住宿;门票 = 一个票种。
 * 口径(按 PRD 字面落地,改动须同步 HANDOFF):
 *   行级条件(不满足 → 该行不参与,拿不到任何抵扣):
 *     适用范围(goods_scope / property_ids|goods_ids / room_type_ids|sku_ids)、
 *     长住晚数(min_nights / max_nights)、提前预订天数(book_advance_days)、
 *     入住日期段(stay_start ~ stay_end,该段每一晚都须落在区间内)—— 后三项仅酒店。
 *   整单条件(不满足 → 整张券不可用):
 *     最少间数 min_room_count(按**合格行**的间数合计,「A 酒店 + 至少 2 间」这类组合才成立)、
 *     最少酒店数 min_hotel_count(按**整单**不同物业数,「≥2 家酒店 + 指定酒店」时仍数全部酒店)、
 *     门槛 min_amount(按**合格金额**,PRD「eligible booking amount」)。
 *   抵扣:折扣券按合格金额 × (1 − 折扣率/10) 并受 max_discount 封顶;满减/无门槛券为面额;均不超过合格金额。
 *   分摊:按各合格行金额占比,末个合格行吸收四舍五入余数(Σ = 抵扣额),不合格行为 0(§17.6)。
 * 行上缺日期/晚数(null,例如老客户端只给了金额)时跳过对应的行级日期条件 —— 不在展示侧误拦,
 * 真正下单时计价方总会带全。
 */
final class CouponEligibility
{
    public const REASON_SCOPE = 'scope';
    public const REASON_NIGHTS = 'nights';
    public const REASON_ADVANCE = 'advance';
    public const REASON_STAY_DATE = 'stay_date';
    public const REASON_MIN_ROOMS = 'min_rooms';
    public const REASON_MIN_HOTELS = 'min_hotels';
    public const REASON_MIN_AMOUNT = 'min_amount';

    /**
     * @param array $coupon marketing_coupon 行(数组;JSON 列可为字符串或数组)
     * @param array<int, array{propertyId?:int,roomTypeId?:int,goodsId?:int,skuId?:int,quantity?:int,
     *   nights?:?int,checkIn?:?string,checkOut?:?string,amount:float}> $legs 行金额为该行净额(长住后、券前)
     * @param int $orderType 1 酒店 2 门票
     * @param string $today 当天日期 Y-m-d(站点时区由调用方决定,便于单测)
     * @return array{eligible:bool,reason:?string,eligibleLegs:int[],eligibleAmount:float,discount:float,allocations:float[]}
     */
    public static function evaluate(array $coupon, array $legs, int $orderType, string $today): array
    {
        $count = count($legs);
        $fail = static fn (string $reason, array $eligible = [], float $amount = 0.0) => [
            'eligible' => false,
            'reason' => $reason,
            'eligibleLegs' => $eligible,
            'eligibleAmount' => $amount,
            'discount' => 0.0,
            'allocations' => array_fill(0, $count, 0.0),
        ];
        if ($count === 0) {
            return $fail(self::REASON_SCOPE);
        }

        // 1) 行级条件:逐行筛出合格行;全不合格时报第一个过了范围校验的行的失败原因
        $eligible = [];
        $firstReason = null;
        foreach ($legs as $i => $leg) {
            $reason = self::legReason($coupon, $leg, $orderType, $today);
            if ($reason === null) {
                $eligible[] = $i;
            } elseif ($firstReason === null || ($firstReason === self::REASON_SCOPE && $reason !== self::REASON_SCOPE)) {
                $firstReason = $reason;
            }
        }
        if ($eligible === []) {
            return $fail($firstReason ?? self::REASON_SCOPE);
        }

        $eligibleAmount = 0.0;
        $eligibleRooms = 0;
        foreach ($eligible as $i) {
            $eligibleAmount += (float) $legs[$i]['amount'];
            $eligibleRooms += max(1, (int) ($legs[$i]['quantity'] ?? 1));
        }
        $eligibleAmount = round($eligibleAmount, 2);

        // 2) 整单条件
        $minRooms = (int) ($coupon['min_room_count'] ?? 0);
        if ($minRooms > 0 && $eligibleRooms < $minRooms) {
            return $fail(self::REASON_MIN_ROOMS, $eligible, $eligibleAmount);
        }
        $minHotels = (int) ($coupon['min_hotel_count'] ?? 0);
        if ($orderType === 1 && $minHotels > 0) {
            $hotels = array_unique(array_map(static fn ($l) => (int) ($l['propertyId'] ?? 0), $legs));
            if (count($hotels) < $minHotels) {
                return $fail(self::REASON_MIN_HOTELS, $eligible, $eligibleAmount);
            }
        }
        $minAmount = (float) ($coupon['min_amount'] ?? 0);
        if ($minAmount > 0 && $eligibleAmount < $minAmount) {
            return $fail(self::REASON_MIN_AMOUNT, $eligible, $eligibleAmount);
        }

        // 3) 抵扣额与分摊
        $discount = self::discount($coupon, $eligibleAmount);
        $allocations = array_fill(0, $count, 0.0);
        if ($discount > 0 && $eligibleAmount > 0) {
            $acc = 0.0;
            $last = end($eligible);
            foreach ($eligible as $i) {
                $share = $i === $last
                    ? round($discount - $acc, 2)
                    : round($discount * (float) $legs[$i]['amount'] / $eligibleAmount, 2);
                $allocations[$i] = max(0.0, $share);
                $acc = round($acc + $allocations[$i], 2);
            }
        }

        return [
            'eligible' => true,
            'reason' => null,
            'eligibleLegs' => $eligible,
            'eligibleAmount' => $eligibleAmount,
            'discount' => $discount,
            'allocations' => $allocations,
        ];
    }

    /**
     * 后台 / 商户端券表单的资格条件入参(驼峰)→ 校验后的 marketing_coupon 列。两端共用,保证可配范围一致。
     * 0 / 空 = 不限。非法值抛 PARAM_ERROR。
     * @return array{min_nights:int,max_nights:int,book_advance_days:int,min_room_count:int,min_hotel_count:int,stay_start:?string,stay_end:?string}
     */
    public static function conditionColumns(array $in): array
    {
        $int = static function (string $key, int $max) use ($in): int {
            $v = $in[$key] ?? 0;
            if ($v === null || $v === '') {
                return 0;
            }
            if (! is_numeric($v) || (int) $v < 0 || (int) $v > $max) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 须为 0-{$max} 的整数");
            }
            return (int) $v;
        };
        $date = static function (string $key) use ($in): ?string {
            $v = $in[$key] ?? null;
            if ($v === null || $v === '') {
                return null;
            }
            if (! is_string($v) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) || strtotime($v) === false) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 须为 YYYY-MM-DD");
            }
            return $v;
        };
        $minNights = $int('minNights', 365);
        $maxNights = $int('maxNights', 365);
        if ($minNights > 0 && $maxNights > 0 && $maxNights < $minNights) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '最多晚数不能小于最少晚数');
        }
        $stayStart = $date('stayStart');
        $stayEnd = $date('stayEnd');
        if ($stayStart !== null && $stayEnd !== null && $stayStart > $stayEnd) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '适用入住日期段的开始不能晚于结束');
        }
        return [
            'min_nights' => $minNights,
            'max_nights' => $maxNights,
            'book_advance_days' => $int('bookAdvanceDays', 365),
            'min_room_count' => $int('minRoomCount', 100),
            'min_hotel_count' => $int('minHotelCount', 10),
            'stay_start' => $stayStart,
            'stay_end' => $stayEnd,
        ];
    }

    /** 抵扣额:折扣券按折扣率并受封顶;其余为面额;不超过基数 */
    public static function discount(array $coupon, float $base): float
    {
        $type = (int) ($coupon['coupon_type'] ?? 1);
        $val = (float) ($coupon['discount_value'] ?? 0);
        $maxD = (float) ($coupon['max_discount'] ?? 0);
        if ($type === 2) {
            $d = round($base * (1 - $val / 10), 2);
            if ($maxD > 0 && $d > $maxD) {
                $d = $maxD;
            }
        } else {
            $d = $val;
        }
        return round(max(0.0, min($d, $base)), 2);
    }

    /** 单行不合格原因;合格返回 null */
    private static function legReason(array $coupon, array $leg, int $orderType, string $today): ?string
    {
        if (! self::inScope($coupon, $leg, $orderType)) {
            return self::REASON_SCOPE;
        }
        if ($orderType !== 1) {
            return null;
        }
        $nights = isset($leg['nights']) ? (int) $leg['nights'] : null;
        $minNights = (int) ($coupon['min_nights'] ?? 0);
        $maxNights = (int) ($coupon['max_nights'] ?? 0);
        if ($nights !== null && (($minNights > 0 && $nights < $minNights) || ($maxNights > 0 && $nights > $maxNights))) {
            return self::REASON_NIGHTS;
        }
        $checkIn = self::date($leg['checkIn'] ?? null);
        $advance = (int) ($coupon['book_advance_days'] ?? 0);
        if ($checkIn !== null && $advance > 0) {
            $days = (int) floor((strtotime($checkIn) - strtotime($today)) / 86400);
            if ($days < $advance) {
                return self::REASON_ADVANCE;
            }
        }
        $stayStart = self::date($coupon['stay_start'] ?? null);
        $stayEnd = self::date($coupon['stay_end'] ?? null);
        if ($checkIn !== null && ($stayStart !== null || $stayEnd !== null)) {
            // 最后一晚 = 离店日前一天;缺离店日时按晚数推
            $checkOut = self::date($leg['checkOut'] ?? null);
            $lastNight = $checkOut !== null
                ? date('Y-m-d', strtotime($checkOut . ' -1 day'))
                : date('Y-m-d', strtotime($checkIn . ' +' . max(0, ($nights ?? 1) - 1) . ' day'));
            if (($stayStart !== null && $checkIn < $stayStart) || ($stayEnd !== null && $lastNight > $stayEnd)) {
                return self::REASON_STAY_DATE;
            }
        }
        return null;
    }

    /** 适用范围:0 全部 / 1 仅酒店 / 2 仅门票 / 3 指定物业(或商品);另有房型(票种)白名单 */
    private static function inScope(array $coupon, array $leg, int $orderType): bool
    {
        $scope = (int) ($coupon['goods_scope'] ?? 0);
        if (($scope === 1 && $orderType !== 1) || ($scope === 2 && $orderType !== 2)) {
            return false;
        }
        if ($scope === 3) {
            $ids = self::ids($coupon[$orderType === 1 ? 'property_ids' : 'goods_ids'] ?? null);
            $target = (int) ($leg[$orderType === 1 ? 'propertyId' : 'goodsId'] ?? 0);
            if (! in_array($target, $ids, true)) {
                return false;
            }
        }
        $items = self::ids($coupon[$orderType === 1 ? 'room_type_ids' : 'sku_ids'] ?? null);
        $item = (int) ($leg[$orderType === 1 ? 'roomTypeId' : 'skuId'] ?? 0);
        return $items === [] || in_array($item, $items, true);
    }

    private static function ids(mixed $value): array
    {
        $list = is_string($value) ? (json_decode($value, true) ?: []) : (array) ($value ?? []);
        return array_values(array_map('intval', $list));
    }

    private static function date(mixed $value): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }
        $ts = strtotime($value);
        return $ts === false ? null : date('Y-m-d', $ts);
    }
}
