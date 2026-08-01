<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;

/**
 * 结算分账:支付成功时按优惠券出资方生成按订单结算分录(PRD 模块8)。
 * 口径:merchant_settlement = order_amount − commission − merchant_pays;platform_revenue = commission − mtrip_pays。
 * 佣金率取 sys_site_config.commission_rate(百分比,未配=0)。
 */
class SettlementService
{
    /** 记录订单结算分录(须在支付事务内调用,幂等:uk_order 命中则跳过) */
    public function recordBooking(array $order): void
    {
        $orderId = (int) $order['id'];
        if (Db::table('finance_account_entry')->where('order_id', $orderId)->exists()) {
            return;
        }
        $siteId = (int) $order['site_id'];
        $orderAmount = (float) $order['total_amount'];
        $discount = (float) $order['coupon_discount'];
        $commission = round($orderAmount * $this->commissionRate($siteId), 2);

        // 出资方拆分:默认平台承担
        [$fundingSource, $rules] = $this->couponFunding((int) $order['coupon_id']);
        $mtrip = 0.0;
        $merchant = 0.0;
        $partner = 0.0;
        if ($discount > 0) {
            switch ($fundingSource) {
                case 2:
                    $merchant = $discount;
                    break;
                case 3:
                    $partner = $discount;
                    break;
                case 4:
                    $mtrip = round($discount * $this->pct($rules, 'mtrip') / 100, 2);
                    $merchant = round($discount * $this->pct($rules, 'merchant') / 100, 2);
                    $partner = round($discount - $mtrip - $merchant, 2); // 末位吸收余数
                    break;
                default:
                    $mtrip = $discount;
            }
        }

        $merchantSettlement = round($orderAmount - $commission - $merchant, 2);
        $platformRevenue = round($commission - $mtrip, 2);

        Db::table('finance_account_entry')->insert([
            'site_id' => $siteId,
            'order_id' => $orderId,
            'order_no' => (string) $order['order_no'],
            'merchant_id' => (int) $order['merchant_id'],
            'coupon_id' => (int) $order['coupon_id'],
            'order_amount' => $orderAmount,
            'commission' => $commission,
            'discount_amount' => $discount,
            'funding_source' => $fundingSource,
            'mtrip_pays' => $mtrip,
            'merchant_pays' => $merchant,
            'partner_pays' => $partner,
            'merchant_settlement' => $merchantSettlement,
            'platform_revenue' => $platformRevenue,
        ]);
        // 回填订单佣金/商户实收,便于订单维度报表
        Db::table('order_main')->where('id', $orderId)->update([
            'platform_commission' => $commission,
            'merchant_receivable' => $merchantSettlement,
        ]);
    }

    /** 取优惠券出资方与共担比例(领券记录ID→模板) */
    private function couponFunding(int $receiveId): array
    {
        if ($receiveId <= 0) {
            return [1, []];
        }
        $row = Db::table('marketing_coupon_receive as r')
            ->join('marketing_coupon as c', 'c.id', '=', 'r.coupon_id')
            ->where('r.id', $receiveId)
            ->first(['c.funding_source', 'c.funding_rules']);
        if (! $row) {
            return [1, []];
        }
        $source = (int) ($row->funding_source ?? 1);
        $rules = is_string($row->funding_rules ?? null) ? (json_decode((string) $row->funding_rules, true) ?: []) : [];
        return [$source > 0 ? $source : 1, $rules];
    }

    private function pct(array $rules, string $key): float
    {
        return isset($rules[$key]) ? max(0.0, (float) $rules[$key]) : 0.0;
    }

    /** 站点佣金率:sys_site_config.commission_rate(百分比,如 10=10%),未配=0 */
    private function commissionRate(int $siteId): float
    {
        $value = Db::connection('system')->table('sys_site_config')
            ->where('site_id', $siteId)
            ->where('config_key', 'commission_rate')
            ->whereNull('deleted_at')
            ->value('config_value');
        $rate = $value !== null ? (float) $value : 0.0;
        return $rate > 0 ? $rate / 100 : 0.0;
    }
}
