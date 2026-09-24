<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

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
            ->first(['id', 'coupon_id']);
        if (! $rec) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该订单使用的优惠券已被其他订单使用或已失效,请取消后重新下单');
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
     * 校验优惠券并计算抵扣(须在事务内调用,行锁领券记录防并发)。
     * 券在此不消耗,支付成功时才置已用。多酒店 Trip 传 propertyId=0(不支持指定物业券)。
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
        float $base
    ): array
    {
        $rec = Db::table('marketing_coupon_receive')
            ->where('id', $receiveId)
            ->where('user_id', $userId)
            ->where('site_id', $siteId)
            ->whereNull('deleted_at')
            ->lockForUpdate()
            ->first();
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
        // 适用范围:0全部 1酒店 2门票 3指定商品
        $scope = (int) $coupon['goods_scope'];
        if ($scope === 1 && $orderType !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该券仅限酒店订单');
        }
        if ($scope === 2 && $orderType !== 2) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该券仅限门票订单');
        }
        if ($scope === 3) {
            $field = $orderType === 1 ? 'property_ids' : 'goods_ids';
            $targetId = $orderType === 1 ? $propertyId : $goodsId;
            $ids = is_string($coupon[$field] ?? null) ? (json_decode($coupon[$field], true) ?: []) : (array) ($coupon[$field] ?? []);
            if (! in_array($targetId, array_map('intval', $ids), true)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, $orderType === 1 ? '该券不适用于本物业' : '该券不适用于本商品');
            }
        }
        $itemField = $orderType === 1 ? 'room_type_ids' : 'sku_ids';
        $itemId = $orderType === 1 ? $roomTypeId : $skuId;
        $itemIds = is_string($coupon[$itemField] ?? null) ? (json_decode($coupon[$itemField], true) ?: []) : (array) ($coupon[$itemField] ?? []);
        if ($itemIds !== [] && ! in_array($itemId, array_map('intval', $itemIds), true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该券不适用于本房型/票种');
        }
        // 门槛
        $min = (float) $coupon['min_amount'];
        if ($min > 0 && $base < $min) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '未满使用门槛');
        }
        // 抵扣:1满减/3无门槛=直减金额;2折扣券=discount_value 为折扣率(8.50=8.5折,用户付85%),max_discount 封顶
        $type = (int) $coupon['coupon_type'];
        $val = (float) $coupon['discount_value'];
        $maxD = (float) $coupon['max_discount'];
        if ($type === 2) {
            $discount = round($base * (1 - $val / 10), 2);
            if ($maxD > 0 && $discount > $maxD) {
                $discount = $maxD;
            }
        } else {
            $discount = $val;
        }
        $discount = max(0.0, min($discount, $base));
        return [$receiveId, round($discount, 2), $this->couponSnapshot($coupon, $rec, round($discount, 2))];
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
