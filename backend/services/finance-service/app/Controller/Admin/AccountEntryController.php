<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Support\Result;

/**
 * 管理端结算分账报表(PRD 模块8):按订单分账明细 + 汇总
 * 数据由 order-service 支付时写入 finance_account_entry
 */
class AccountEntryController extends AbstractController
{
    /** 分账明细:筛选 merchantId / 日期 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = $this->baseQuery();
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get([
                'finance_account_entry.*',
                Db::raw('COALESCE(refunds.refund_hotel_commission,0) AS refunded_commission'),
                Db::raw('COALESCE(refunds.refund_hotel_deposit,0) AS refunded_deposit'),
                Db::raw('COALESCE(refunds.refund_transaction_fee,0) AS refunded_transaction_fee'),
                Db::raw('COALESCE(refunds.refund_addon,0) AS refunded_addon'),
                Db::raw('merchant_settlement - COALESCE(refunds.refund_hotel_deposit,0) - COALESCE(refunds.refund_addon,0) AS net_merchant_settlement'),
                Db::raw('platform_revenue - COALESCE(refunds.refund_hotel_commission,0) - COALESCE(refunds.refund_transaction_fee,0) AS net_platform_revenue'),
            ])->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 汇总:订单额/佣金/各出资方/应结商户/平台净收入 合计 */
    public function summary(): array
    {
        $row = (array) $this->baseQuery()->first([
            Db::raw('COUNT(*) as order_count'),
            Db::raw('COALESCE(SUM(order_amount),0) as order_amount'),
            Db::raw('COALESCE(SUM(commission),0) as commission'),
            Db::raw('COALESCE(SUM(discount_amount),0) as discount_amount'),
            Db::raw('COALESCE(SUM(mtrip_pays),0) as mtrip_pays'),
            Db::raw('COALESCE(SUM(merchant_pays),0) as merchant_pays'),
            Db::raw('COALESCE(SUM(partner_pays),0) as partner_pays'),
            Db::raw('COALESCE(SUM(merchant_settlement),0) as merchant_settlement'),
            Db::raw('COALESCE(SUM(platform_revenue),0) as platform_revenue'),
            Db::raw('COALESCE(SUM(refunds.refund_hotel_commission),0) as refunded_commission'),
            Db::raw('COALESCE(SUM(refunds.refund_hotel_deposit),0) as refunded_deposit'),
            Db::raw('COALESCE(SUM(refunds.refund_transaction_fee),0) as refunded_transaction_fee'),
            Db::raw('COALESCE(SUM(refunds.refund_addon),0) as refunded_addon'),
            Db::raw('COALESCE(SUM(merchant_settlement - COALESCE(refunds.refund_hotel_deposit,0) - COALESCE(refunds.refund_addon,0)),0) as net_merchant_settlement'),
            Db::raw('COALESCE(SUM(platform_revenue - COALESCE(refunds.refund_hotel_commission,0) - COALESCE(refunds.refund_transaction_fee,0)),0) as net_platform_revenue'),
        ]);
        return Result::success($row);
    }

    /** 公共筛选:站点隔离 + 商户 + 日期区间 */
    private function baseQuery()
    {
        $refunds = Db::table('order_refund')->where('status', 3)->where('late_pay', 0)->whereNull('deleted_at')
            ->groupBy('order_id')->select('order_id')
            ->selectRaw('SUM(refund_hotel_commission) AS refund_hotel_commission, SUM(refund_hotel_deposit) AS refund_hotel_deposit, SUM(refund_transaction_fee) AS refund_transaction_fee, SUM(refund_addon) AS refund_addon');
        $query = Db::table('finance_account_entry')->leftJoinSub($refunds, 'refunds', 'finance_account_entry.order_id', '=', 'refunds.order_id');
        $this->applySiteScope($query);
        if (($merchantId = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $merchantId);
        }
        if (($start = $this->strInput('startDate')) !== '') {
            $query->where('created_at', '>=', "{$start} 00:00:00");
        }
        if (($end = $this->strInput('endDate')) !== '') {
            $query->where('created_at', '<=', "{$end} 23:59:59");
        }
        return $query;
    }
}
