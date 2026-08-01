<?php

declare(strict_types=1);

namespace App\Controller;

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
            ->get()->map(static fn ($row) => (array) $row)->all();
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
        ]);
        return Result::success($row);
    }

    /** 公共筛选:站点隔离 + 商户 + 日期区间 */
    private function baseQuery()
    {
        $query = Db::table('finance_account_entry');
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
