<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 数据统计中心(文档 6.4.7):数据大屏聚合 + 站点/商户/商品维度报表
 * 均为只读接口;业务表同库(mtrip_business)可 join 商户名,站点名由前端站点树映射
 */
class AdminStatsController extends AbstractAdminController
{
    private const REPORT_DIMS = [
        'site' => 'site_id',
        'merchant' => 'merchant_id',
        'goods' => 'goods_id',
    ];

    /**
     * 自定义报表(Super Admin Portal 模块10 Custom Reports):
     * 按 reportType(bookings/revenue) + 日期区间 + 商户 过滤订单明细,分页返回
     */
    public function custom(): array
    {
        [$page, $pageSize] = $this->pageParams();
        [$startDate, $endDate] = $this->rangeParams();
        $reportType = $this->strInput('reportType', 'bookings');

        $query = Db::table('order_main')
            ->whereBetween('created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($merchantId = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $merchantId);
        }
        // 营收报表口径:仅已支付/已核销/已完成
        if ($reportType === 'revenue') {
            $query->whereIn('order_status', [1, 2, 3]);
        }
        $total = (clone $query)->count();
        $rows = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'order_no', 'order_type', 'merchant_id', 'goods_name', 'sku_name', 'quantity', 'pay_amount', 'platform_commission', 'merchant_receivable', 'order_status', 'refund_status', 'created_at'])
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($rows, $total, $page, $pageSize);
    }

    /** 数据大屏:KPI 4 卡片 + 每日趋势(销售额/订单量分类型) + 站点/商户排行 + 最新订单 */
    public function dashboard(): array
    {
        [$startDate, $endDate] = $this->rangeParams();
        $today = date('Y-m-d');

        $base = fn () => $this->applySiteScope(
            Db::table('order_main')
                ->whereBetween('created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
                ->whereNull('deleted_at')
        );
        // 已支付口径:1已支付 2已核销 3已完成
        $paid = fn () => (clone $base())->whereIn('order_status', [1, 2, 3]);

        // ---- KPI:区间总营收/平台佣金 + 今日订单 + 待结算 ----
        $kpiRow = (array) $paid()->selectRaw('COALESCE(SUM(pay_amount),0) AS sales, COALESCE(SUM(platform_commission),0) AS commission')->first();
        $todayQuery = Db::table('order_main')
            ->whereBetween('created_at', ["{$today} 00:00:00", "{$today} 23:59:59"])
            ->whereNull('deleted_at');
        $this->applySiteScope($todayQuery);
        $todayCount = (clone $todayQuery)->count();
        $todaySales = (float) (clone $todayQuery)->whereIn('order_status', [1, 2, 3])->sum('pay_amount');
        $pendingSettle = Db::table('finance_merchant_settle')
            ->whereIn('status', [0, 1])->whereNull('deleted_at');
        $this->applySiteScope($pendingSettle);
        $pendingRow = (array) $pendingSettle->selectRaw('COUNT(*) AS cnt, COALESCE(SUM(settle_amount),0) AS amount')->first();

        // ---- 每日趋势:订单量(酒店/门票双系列)+ 已支付销售额 ----
        $countRows = $base()
            ->groupByRaw('DATE(created_at), order_type')
            ->selectRaw('DATE(created_at) AS d, order_type, COUNT(*) AS cnt')
            ->get()->map(static fn ($row) => (array) $row)->all();
        $salesRows = $paid()
            ->groupByRaw('DATE(created_at)')
            ->selectRaw('DATE(created_at) AS d, SUM(pay_amount) AS amount')
            ->pluck('amount', 'd')->all();
        $countMap = [];
        foreach ($countRows as $row) {
            $countMap[$row['d']][(int) $row['order_type']] = (int) $row['cnt'];
        }
        $trend = [];
        for ($ts = strtotime($startDate); $ts <= strtotime($endDate); $ts += 86400) {
            $day = date('Y-m-d', $ts);
            $trend[] = [
                'date' => $day,
                'hotelCount' => $countMap[$day][1] ?? 0,
                'ticketCount' => $countMap[$day][2] ?? 0,
                'salesAmount' => round((float) ($salesRows[$day] ?? 0), 2),
            ];
        }

        // ---- 排行:站点 TOP10(前端映射站点名)/商户 TOP10(join 商户名) ----
        $siteRank = $paid()
            ->groupBy('site_id')
            ->selectRaw('site_id, COUNT(*) AS order_count, SUM(pay_amount) AS sales_amount')
            ->orderByDesc('sales_amount')->limit(10)
            ->get()->map(static fn ($row) => (array) $row)->all();
        $merchantRankQuery = Db::table('order_main')
            ->leftJoin('merchant_info', 'merchant_info.id', '=', 'order_main.merchant_id')
            ->whereBetween('order_main.created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->whereNull('order_main.deleted_at')
            ->whereIn('order_main.order_status', [1, 2, 3]);
        $this->applySiteScope($merchantRankQuery, 'order_main.site_id');
        $merchantRank = $merchantRankQuery
            ->groupBy('order_main.merchant_id')
            ->selectRaw('order_main.merchant_id, MAX(merchant_info.merchant_name) AS merchant_name, COUNT(*) AS order_count, SUM(order_main.pay_amount) AS sales_amount')
            ->orderByDesc('sales_amount')->limit(10)
            ->get()->map(static fn ($row) => (array) $row)->all();

        // ---- 最新订单滚动(近10条,含未支付) ----
        $latestQuery = Db::table('order_main')->whereNull('deleted_at');
        $this->applySiteScope($latestQuery);
        $latestOrders = $latestQuery
            ->orderByDesc('id')->limit(10)
            ->get(['id', 'order_no', 'order_type', 'goods_name', 'pay_amount', 'order_status', 'created_at'])
            ->map(static fn ($row) => (array) $row)->all();

        return Result::success([
            'startDate' => $startDate,
            'endDate' => $endDate,
            'kpi' => [
                'salesAmount' => round((float) $kpiRow['sales'], 2),
                'commission' => round((float) $kpiRow['commission'], 2),
                'todayOrderCount' => $todayCount,
                'todaySalesAmount' => round($todaySales, 2),
                'pendingSettleCount' => (int) $pendingRow['cnt'],
                'pendingSettleAmount' => round((float) $pendingRow['amount'], 2),
            ],
            'trend' => $trend,
            'siteRank' => $siteRank,
            'merchantRank' => $merchantRank,
            'latestOrders' => $latestOrders,
        ]);
    }

    /** 维度报表:dim=site|merchant|goods,按维度汇总订单/销售/佣金/退款(分页) */
    public function report(): array
    {
        $dim = $this->strInput('dim', 'site');
        if (! isset(self::REPORT_DIMS[$dim])) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 dim 仅支持 site/merchant/goods');
        }
        $column = self::REPORT_DIMS[$dim];
        [$startDate, $endDate] = $this->rangeParams();
        [$page, $pageSize] = $this->pageParams();

        $query = Db::table('order_main')
            ->whereBetween('order_main.created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->whereNull('order_main.deleted_at');
        $this->applySiteScope($query, 'order_main.site_id');
        if ($dim !== 'site' && ($merchantId = $this->intInput('merchantId')) > 0) {
            $query->where('order_main.merchant_id', $merchantId);
        }
        // 分页总数 = 维度去重数(在 groupBy 前计算)
        $total = (clone $query)->distinct()->count("order_main.{$column}");

        // 名称列:商品用订单快照,商户 join 商户表,站点由前端映射
        $nameSelect = match ($dim) {
            'goods' => ', MAX(order_main.goods_name) AS dim_name',
            'merchant' => ', MAX(merchant_info.merchant_name) AS dim_name',
            default => '',
        };
        if ($dim === 'merchant') {
            $query->leftJoin('merchant_info', 'merchant_info.id', '=', 'order_main.merchant_id');
        }

        $grouped = $query->groupBy("order_main.{$column}")
            ->selectRaw(
                "order_main.{$column} AS dim_id{$nameSelect}, COUNT(*) AS order_count,"
                . ' SUM(CASE WHEN order_main.order_status IN (1,2,3) THEN 1 ELSE 0 END) AS paid_count,'
                . ' COALESCE(SUM(CASE WHEN order_main.order_status IN (1,2,3) THEN order_main.pay_amount ELSE 0 END),0) AS sales_amount,'
                . ' COALESCE(SUM(CASE WHEN order_main.order_status IN (1,2,3) THEN order_main.platform_commission ELSE 0 END),0) AS commission'
            );
        $list = $grouped->orderByDesc('sales_amount')->forPage($page, $pageSize)
            ->get()->map(static fn ($row) => (array) $row)->all();

        // 退款金额:已退款(status=3)按同维度补齐
        $dimIds = array_column($list, 'dim_id');
        $refundMap = [];
        if ($dimIds !== []) {
            $refundQuery = Db::table('order_refund')
                ->join('order_main', 'order_main.id', '=', 'order_refund.order_id')
                ->where('order_refund.status', 3)->whereNull('order_refund.deleted_at')
                ->whereBetween('order_refund.created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
                ->whereIn("order_main.{$column}", $dimIds);
            $this->applySiteScope($refundQuery, 'order_refund.site_id');
            $refundMap = $refundQuery
                ->groupBy("order_main.{$column}")
                ->selectRaw("order_main.{$column} AS dim_id, SUM(order_refund.refund_amount) AS refund_amount")
                ->pluck('refund_amount', 'dim_id')->all();
        }
        foreach ($list as &$row) {
            $row['sales_amount'] = round((float) $row['sales_amount'], 2);
            $row['commission'] = round((float) $row['commission'], 2);
            $row['refund_amount'] = round((float) ($refundMap[$row['dim_id']] ?? 0), 2);
        }
        unset($row);

        return Result::page($list, $total, $page, $pageSize);
    }

    /** 日期区间参数(默认近30天),起止顺序自动纠正 */
    private function rangeParams(): array
    {
        $startDate = $this->strInput('startDate', date('Y-m-d', strtotime('-29 days')));
        $endDate = $this->strInput('endDate', date('Y-m-d'));
        if (strtotime($startDate) > strtotime($endDate)) {
            [$startDate, $endDate] = [$endDate, $startDate];
        }
        return [$startDate, $endDate];
    }
}
