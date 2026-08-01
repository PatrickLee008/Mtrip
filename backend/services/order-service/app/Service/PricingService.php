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
     * 校验优惠券并计算抵扣(须在事务内调用,行锁领券记录防并发)。
     * 券在此不消耗,支付成功时才置已用。多酒店 Trip 传 goodsId=0(不支持指定商品券)。
     * @return array{0:int,1:float} [领券记录ID, 抵扣金额]
     */
    public function resolveCoupon(int $siteId, int $userId, int $receiveId, int $orderType, int $goodsId, float $base): array
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
            $ids = is_string($coupon['goods_ids']) ? (json_decode($coupon['goods_ids'], true) ?: []) : (array) ($coupon['goods_ids'] ?? []);
            if (! in_array($goodsId, array_map('intval', $ids), true)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该券不适用于本商品');
            }
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
        return [$receiveId, round($discount, 2)];
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
