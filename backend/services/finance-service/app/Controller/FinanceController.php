<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\OrderNoGenerator;
use Mtrip\Shared\Support\Result;

/**
 * 财务:资金总览 + 资金流水(文档 6.4.5)
 * finance_flow 为月分表模板,本期查模板表;分表路由归模块08 定时任务上线后切换
 */
class FinanceController extends AbstractController
{
    /** 资金总览:今日/本月/累计 收入支出 + 待办数量 */
    public function overview(): array
    {
        $today = date('Y-m-d');
        $monthStart = date('Y-m-01');

        $sumFlow = function (string $start, ?string $end = null): array {
            $query = Db::table('finance_flow')->where('flow_status', 1)
                ->where('created_at', '>=', "{$start} 00:00:00");
            if ($end !== null) {
                $query->where('created_at', '<=', "{$end} 23:59:59");
            }
            $this->applySiteScope($query);
            $rows = $query->groupBy('flow_type')
                ->selectRaw('flow_type, SUM(amount) AS total')
                ->pluck('total', 'flow_type')->all();
            return [
                'income' => round((float) ($rows[1] ?? 0), 2),
                'expense' => round((float) ($rows[2] ?? 0), 2),
            ];
        };

        $totalQuery = Db::table('finance_flow')->where('flow_status', 1);
        $this->applySiteScope($totalQuery);
        $totalRows = $totalQuery->groupBy('flow_type')
            ->selectRaw('flow_type, SUM(amount) AS total')
            ->pluck('total', 'flow_type')->all();

        $pendingWithdraw = Db::table('finance_withdraw')->where('status', 0)->whereNull('deleted_at');
        $this->applySiteScope($pendingWithdraw);
        $pendingSettle = Db::table('finance_merchant_settle')->where('status', 0)->whereNull('deleted_at');
        $this->applySiteScope($pendingSettle);

        return Result::success([
            'today' => $sumFlow($today),
            'month' => $sumFlow($monthStart),
            'total' => [
                'income' => round((float) ($totalRows[1] ?? 0), 2),
                'expense' => round((float) ($totalRows[2] ?? 0), 2),
            ],
            'pendingWithdrawCount' => $pendingWithdraw->count(),
            'pendingSettleCount' => $pendingSettle->count(),
        ]);
    }

    /** 资金流水分页:筛选 流水号/类型/业务类型/状态/商户/订单/日期 */
    public function flows(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('finance_flow');
        $this->applySiteScope($query);
        if (($flowNo = $this->strInput('flowNo')) !== '') {
            $query->where('flow_no', $flowNo);
        }
        if (($flowType = $this->intInput('flowType')) > 0) {
            $query->where('flow_type', $flowType);
        }
        if (($bizType = $this->intInput('bizType')) > 0) {
            $query->where('biz_type', $bizType);
        }
        if (($flowStatus = $this->intInput('flowStatus')) > 0) {
            $query->where('flow_status', $flowStatus);
        }
        if (($merchantId = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $merchantId);
        }
        if (($orderId = $this->intInput('orderId')) > 0) {
            $query->where('order_id', $orderId);
        }
        if (($start = $this->strInput('startDate')) !== '') {
            $query->where('created_at', '>=', "{$start} 00:00:00");
        }
        if (($end = $this->strInput('endDate')) !== '') {
            $query->where('created_at', '<=', "{$end} 23:59:59");
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 手动调账:插入流水(biz_type=5,必填原因) */
    #[Permission('finance:flow:adjust')]
    public function adjust(): array
    {
        $flowType = $this->intInput('flowType');
        if (! in_array($flowType, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 flowType 须为 1收入/2支出');
        }
        $amount = round($this->floatInput('amount'), 2);
        if ($amount <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '调账金额须大于0');
        }
        $remark = $this->requireStr('remark');
        $siteId = AdminContext::isSuper() ? $this->intInput('siteId') : (int) AdminContext::siteId();
        $flowNo = OrderNoGenerator::flowNo();
        Db::table('finance_flow')->insert([
            'flow_no' => $flowNo,
            'site_id' => $siteId,
            'flow_type' => $flowType,
            'biz_type' => 5,
            'amount' => $amount,
            'merchant_id' => $this->intInput('merchantId'),
            'flow_status' => 1,
            'remark' => mb_substr($remark, 0, 500),
            'operator_id' => AdminContext::adminId(),
        ]);
        return Result::success(['flowNo' => $flowNo], '调账流水已记录');
    }

    /** 财务月度报表:按年汇总 12 个月收入/支出/净额 + 业务类型拆分(成功流水口径) */
    public function report(): array
    {
        $year = $this->intInput('year', (int) date('Y'));
        if ($year < 2020 || $year > 2100) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 year 非法');
        }
        $query = Db::table('finance_flow')
            ->where('flow_status', 1)
            ->whereBetween('created_at', ["{$year}-01-01 00:00:00", "{$year}-12-31 23:59:59"]);
        $this->applySiteScope($query);
        $rows = $query
            ->groupByRaw("DATE_FORMAT(created_at, '%Y-%m'), flow_type, biz_type")
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') AS m, flow_type, biz_type, SUM(amount) AS total")
            ->get()->map(static fn ($row) => (array) $row)->all();

        // 按月聚合:income/expense + biz_type 1订单支付 2订单退款 3商户提现 4供应商回款 5手动调账
        $bizKeys = [1 => 'orderPay', 2 => 'orderRefund', 3 => 'withdraw', 4 => 'supplierPay', 5 => 'adjust'];
        $monthMap = [];
        foreach ($rows as $row) {
            $month = $row['m'];
            $amount = (float) $row['total'];
            $monthMap[$month]['income'] = ($monthMap[$month]['income'] ?? 0) + ((int) $row['flow_type'] === 1 ? $amount : 0);
            $monthMap[$month]['expense'] = ($monthMap[$month]['expense'] ?? 0) + ((int) $row['flow_type'] === 2 ? $amount : 0);
            $bizKey = $bizKeys[(int) $row['biz_type']] ?? null;
            if ($bizKey !== null) {
                $monthMap[$month][$bizKey] = ($monthMap[$month][$bizKey] ?? 0) + $amount;
            }
        }
        $list = [];
        $totals = ['income' => 0.0, 'expense' => 0.0];
        for ($i = 1; $i <= 12; ++$i) {
            $month = sprintf('%d-%02d', $year, $i);
            $item = ['month' => $month];
            foreach (array_merge(['income', 'expense'], array_values($bizKeys)) as $key) {
                $item[$key] = round((float) ($monthMap[$month][$key] ?? 0), 2);
            }
            $item['net'] = round($item['income'] - $item['expense'], 2);
            $totals['income'] += $item['income'];
            $totals['expense'] += $item['expense'];
            $list[] = $item;
        }

        return Result::success([
            'year' => $year,
            'list' => $list,
            'totalIncome' => round($totals['income'], 2),
            'totalExpense' => round($totals['expense'], 2),
            'totalNet' => round($totals['income'] - $totals['expense'], 2),
        ]);
    }
}
