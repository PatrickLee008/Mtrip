<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CouponEligibility;

/**
 * 下单定价:长住优惠 / 优惠券校验与抵扣 / 住客名单归一化。
 * 单酒店(OrderController)与多酒店 Trip(TripController)共用,保证口径一致。
 */
class PricingService
{
    /** 长住优惠额:命中站点内 min_nights<=夜数 的最高梯度,按原总价乘折扣率 */
    public function longstayDiscount(int $siteId, int $nights, float $total): float
    {
        $tier = Db::table('marketing_longstay_tier')
            ->where('site_id', $siteId)
            ->where('status', 1)
            ->where('min_nights', '<=', $nights)
            ->whereNull('deleted_at')
            ->orderByDesc('min_nights')
            ->first(['discount_rate']);
        if (! $tier) {
            return 0.0;
        }
        return round($total * (float) $tier->discount_rate / 100, 2);
    }

    /**
     * 下单金额确认:客户端带了 expectedPayAmount(用户在页面上看到的应付)就与服务端实际计价比对,
     * 差额超过 0.01 抛 PRICE_CHANGED(须在下单事务内、建单前调用,抛错即回滚已锁库存)。
     * data 携带最新明细,客户端展示给用户确认后带新金额重提。未带(旧客户端)不校验。
     * @param array{original:float,longstayDiscount:float,couponDiscount:float,payAmount:float} $detail
     */
    public function assertExpectedPay(mixed $expected, array $detail): void
    {
        if ($expected === null || $expected === '' || ! is_numeric($expected)) {
            return;
        }
        $expected = round((float) $expected, 2);
        if (abs($expected - (float) $detail['payAmount']) <= 0.01) {
            return;
        }
        throw new BusinessException(ErrorCode::PRICE_CHANGED, null, $detail + ['expectedPayAmount' => $expected]);
    }

    /**
     * 支付时锁定订单所用的券(须在事务内、**扣款之前**调用):券只有 Available → Used 单向流转(PRD 模块 6.1),
     * 下单时不占券,同一张券可能挂在多笔待支付订单上。先付的那笔核销后,后付的必须拒绝支付 ——
     * 否则会按已抵扣的价格成交却不再核销,等于一张券用了两次。
     * 券已不可用时抛错整单回滚;无券(receiveId=0)返回 null。
     */
    public function lockCouponForPay(int $receiveId): ?object
    {
        if ($receiveId <= 0) {
            return null;
        }
        $rec = Db::table('marketing_coupon_receive')
            ->where('id', $receiveId)
            ->where('status', 0)
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->first(['id', 'coupon_id', 'valid_end']);
        if (! $rec) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该订单使用的优惠券已被其他订单使用或已失效,请取消后重新下单');
        }
        // 下单后到支付前(≤10 分钟)券刚好过期:与下单时 resolveCoupon 的有效期口径一致,拒绝支付
        if ($rec->valid_end && date('Y-m-d H:i:s') > (string) $rec->valid_end) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该订单使用的优惠券已过期,请取消后重新下单');
        }
        return $rec;
    }

    /** 核销已由 lockCouponForPay 锁定的券:领券记录置已用 + 模板已用数+1。orderId 为订单ID(Trip 为 tripId) */
    public function consumeCoupon(?object $rec, int $orderId): void
    {
        if ($rec === null) {
            return;
        }
        Db::table('marketing_coupon_receive')->where('id', $rec->id)->update([
            'status' => 1,
            'order_id' => $orderId,
            'used_time' => date('Y-m-d H:i:s'),
        ]);
        Db::table('marketing_coupon')->where('id', $rec->coupon_id)->increment('used_count');
    }

    /**
     * 返还已核销的券(须在事务内调用;已支付预订被取消 / 全额退款后调用)。
     * - 只认本单核销的那条记录:领券记录 order_id = Trip ID(Trip 内预订)或订单 ID(独立单),状态为已使用;
     * - Trip 内一张券按比例分摊到各预订,**同一张券还有未取消/未全额退款的预订就不返还**,
     *   等最后一笔也取消了再还,否则用户能拿回券的同时其余预订继续享受折扣;
     * - 返还后回到未使用;若已过有效期则置为已过期(进「不可用」列表),模板已用数 -1。
     * 未核销(待支付时取消)、部分退款、重复调用都不做任何事。返回是否真的返还了。
     */
    public function releaseCoupon(array $order): bool
    {
        $receiveId = (int) ($order['coupon_id'] ?? 0);
        if ($receiveId <= 0) {
            return false;
        }
        $owner = (int) ($order['trip_id'] ?? 0) > 0 ? (int) $order['trip_id'] : (int) $order['id'];
        $rec = Db::table('marketing_coupon_receive')
            ->where('id', $receiveId)->where('status', 1)->where('order_id', $owner)
            ->whereNull('deleted_at')->lockForUpdate()->first(['id', 'coupon_id', 'valid_end']);
        if (! $rec) {
            return false;
        }
        $stillUsed = Db::table('order_main')->where('coupon_id', $receiveId)->where('id', '<>', (int) $order['id'])
            ->whereNull('deleted_at')->whereNotIn('order_status', [4, 6])->exists();
        if ($stillUsed) {
            return false;
        }
        $expired = $rec->valid_end && date('Y-m-d H:i:s') > (string) $rec->valid_end;
        Db::table('marketing_coupon_receive')->where('id', $rec->id)->update([
            'status' => $expired ? 2 : 0,
            'order_id' => 0,
            'used_time' => null,
        ]);
        Db::table('marketing_coupon')->where('id', $rec->coupon_id)->where('used_count', '>', 0)->decrement('used_count');
        return true;
    }

    /**
     * 单项订单的券校验与抵扣(单房型 / 门票下单):包成一行交给 resolveCouponForLegs,口径与 Trip 一致。
     * $quantity / $useDate / $endDate 用于间数、长住晚数、提前预订、入住日期段等条件;缺省时这些日期类条件不判。
     * @return array{0:int,1:float,2:string} [领券记录ID, 抵扣金额, 券规则快照 JSON]
     */
    public function resolveCoupon(
        int $siteId,
        int $userId,
        int $receiveId,
        int $orderType,
        int $propertyId,
        int $roomTypeId,
        int $goodsId,
        int $skuId,
        float $base,
        bool $lock = true,
        int $quantity = 1,
        ?string $useDate = null,
        ?string $endDate = null
    ): array {
        $nights = $useDate !== null && $endDate !== null
            ? max(1, (int) round((strtotime($endDate) - strtotime($useDate)) / 86400))
            : null;
        [$id, $discount, $snapshot] = $this->resolveCouponForLegs($siteId, $userId, $receiveId, $orderType, [[
            'propertyId' => $propertyId,
            'roomTypeId' => $roomTypeId,
            'goodsId' => $goodsId,
            'skuId' => $skuId,
            'quantity' => $quantity,
            'nights' => $nights,
            'checkIn' => $useDate,
            'checkOut' => $endDate,
            'amount' => $base,
        ]], $lock);
        return [$id, $discount, $snapshot];
    }

    /**
     * 校验优惠券并按行计算抵扣与分摊(须在事务内调用,行锁领券记录防并发;试算传 $lock=false)。
     * 资格判定、抵扣额与分摊全部交给 shared 的 CouponEligibility(PRD §17.5/§17.6,与选券列表同一实现):
     * 不合格的房型/酒店拿不到抵扣,整单条件(最少间数/酒店数/门槛)不满足则整张券不可用并报原因。
     * 券在此不消耗,支付成功时才置已用。
     * @param array $legs 每行 {propertyId, roomTypeId, goodsId?, skuId?, quantity, nights, checkIn, checkOut, amount(净额)}
     * @return array{0:int,1:float,2:string,3:float[]} [领券记录ID, 抵扣金额, 券规则快照 JSON, 各行分摊额]
     */
    public function resolveCouponForLegs(int $siteId, int $userId, int $receiveId, int $orderType, array $legs, bool $lock = true): array
    {
        $query = Db::table('marketing_coupon_receive')
            ->where('id', $receiveId)
            ->where('user_id', $userId)
            ->where('site_id', $siteId)
            ->whereNull('deleted_at');
        // 试算(trip/quote)不加锁:只读校验,不在事务内
        $rec = ($lock ? $query->lockForUpdate() : $query)->first();
        if (! $rec) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '优惠券不存在');
        }
        $rec = (array) $rec;
        if ((int) $rec['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '优惠券已使用或已失效');
        }
        $now = date('Y-m-d H:i:s');
        if (($rec['valid_start'] && $now < $rec['valid_start']) || ($rec['valid_end'] && $now > $rec['valid_end'])) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '优惠券不在有效期');
        }
        $coupon = Db::table('marketing_coupon')->where('id', $rec['coupon_id'])->whereNull('deleted_at')->first();
        if (! $coupon) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '优惠券模板不存在');
        }
        $coupon = (array) $coupon;

        $result = CouponEligibility::evaluate($coupon, $legs, $orderType, date('Y-m-d'));
        if (! $result['eligible']) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, $this->couponReasonMessage((string) $result['reason'], $orderType));
        }
        return [
            $receiveId,
            $result['discount'],
            $this->couponSnapshot($coupon, $rec, $result['discount']),
            $result['allocations'],
        ];
    }

    /** 券不可用原因 → 下单时的报错文案(试算把它原样作为 couponError 返回给 App) */
    private function couponReasonMessage(string $reason, int $orderType): string
    {
        return match ($reason) {
            CouponEligibility::REASON_SCOPE => $orderType === 1 ? '该券不适用于所选酒店或房型' : '该券不适用于本商品或票种',
            CouponEligibility::REASON_NIGHTS => '入住晚数不符合该券要求',
            CouponEligibility::REASON_ADVANCE => '未满足该券要求的提前预订天数',
            CouponEligibility::REASON_STAY_DATE => '入住日期不在该券的适用期内',
            CouponEligibility::REASON_MIN_ROOMS => '未达到该券要求的最少间数',
            CouponEligibility::REASON_MIN_HOTELS => '未达到该券要求的最少酒店数',
            default => '未满使用门槛',
        };
    }

    /**
     * 券规则快照(下单时落 order_main.coupon_snapshot):冻结计价与出资方规则,
     * 结算/对账/客服只读快照,后台之后改券模板不影响已下订单。
     */
    private function couponSnapshot(array $coupon, array $rec, float $discount): string
    {
        $decode = static fn ($v) => is_string($v) ? (json_decode($v, true) ?: []) : (array) ($v ?? []);
        $source = (int) ($coupon['funding_source'] ?? 1);
        return json_encode([
            'receiveId' => (int) $rec['id'],
            'couponId' => (int) $coupon['id'],
            'couponName' => (string) ($coupon['coupon_name'] ?? ''),
            'couponType' => (int) $coupon['coupon_type'],
            'promotionKind' => (int) ($coupon['promotion_kind'] ?? 0),
            'discountValue' => (float) $coupon['discount_value'],
            'minAmount' => (float) $coupon['min_amount'],
            'maxDiscount' => (float) $coupon['max_discount'],
            'goodsScope' => (int) $coupon['goods_scope'],
            'propertyIds' => array_map('intval', $decode($coupon['property_ids'] ?? null)),
            'roomTypeIds' => array_map('intval', $decode($coupon['room_type_ids'] ?? null)),
            // 资格条件(PRD §17.5):客服/对账可据此解释「为什么这单能用 / 分到哪些房」
            'minNights' => (int) ($coupon['min_nights'] ?? 0),
            'maxNights' => (int) ($coupon['max_nights'] ?? 0),
            'bookAdvanceDays' => (int) ($coupon['book_advance_days'] ?? 0),
            'minRoomCount' => (int) ($coupon['min_room_count'] ?? 0),
            'minHotelCount' => (int) ($coupon['min_hotel_count'] ?? 0),
            'stayStart' => $coupon['stay_start'] ?? null,
            'stayEnd' => $coupon['stay_end'] ?? null,
            'fundingSource' => $source > 0 ? $source : 1,
            'fundingRules' => $decode($coupon['funding_rules'] ?? null),
            // 整单抵扣额;Trip 各预订的分摊额在 order_main.alloc_coupon_discount
            'checkoutDiscount' => $discount,
            'snapshotAt' => date('Y-m-d H:i:s'),
        ], JSON_UNESCAPED_UNICODE);
    }

    /** 住客名单归一化:最多 qty 条,每条取 firstName/lastName/phone/email 并限长 */
    public function normalizeGuests(mixed $input, int $qty): array
    {
        if (! is_array($input)) {
            return [];
        }
        $out = [];
        foreach (array_slice(array_values($input), 0, max(1, $qty)) as $g) {
            if (! is_array($g)) {
                continue;
            }
            $out[] = [
                'firstName' => mb_substr(trim((string) ($g['firstName'] ?? '')), 0, 50),
                'lastName' => mb_substr(trim((string) ($g['lastName'] ?? '')), 0, 50),
                'phone' => mb_substr(trim((string) ($g['phone'] ?? '')), 0, 30),
                'email' => mb_substr(trim((string) ($g['email'] ?? '')), 0, 100),
            ];
        }
        return $out;
    }
}
