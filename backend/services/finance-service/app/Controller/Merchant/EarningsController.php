<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户端收益与结算(Merchant App M5)。
 * 只开放商户自身查询与申诉,确认/打款仍归平台管理端。
 */
class EarningsController extends AbstractController
{
    /** 收益总览:按订单分账分录 + 结算单状态汇总 */
    public function overview(): array
    {
        [$startDate, $endDate] = $this->dateRange(true);
        $merchantIds = $this->scopeMerchantIds();

        $entry = (array) Db::table('finance_account_entry')
            ->whereIn('merchant_id', $merchantIds)
            ->whereBetween('created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->first([
                Db::raw('COUNT(*) AS booking_count'),
                Db::raw('COALESCE(SUM(order_amount),0) AS gross_revenue'),
                Db::raw('COALESCE(SUM(commission),0) AS commission'),
                Db::raw('COALESCE(SUM(discount_amount),0) AS discount_amount'),
                Db::raw('COALESCE(SUM(mtrip_pays),0) AS mtrip_pays'),
                Db::raw('COALESCE(SUM(merchant_pays),0) AS merchant_pays'),
                Db::raw('COALESCE(SUM(merchant_settlement),0) AS net_settlement'),
            ]);

        $settleRows = Db::table('finance_merchant_settle')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->groupBy('status')
            ->selectRaw('status, COUNT(*) AS cnt, COALESCE(SUM(settle_amount),0) AS amount')
            ->get()
            ->map(static fn ($row) => (array) $row)
            ->all();

        $statusSummary = [
            'pendingAmount' => 0.0,
            'processingAmount' => 0.0,
            'paidAmount' => 0.0,
            'disputedAmount' => 0.0,
            'pendingCount' => 0,
            'processingCount' => 0,
            'paidCount' => 0,
            'disputedCount' => 0,
        ];
        foreach ($settleRows as $row) {
            $status = (int) $row['status'];
            $amount = round((float) $row['amount'], 2);
            $count = (int) $row['cnt'];
            if ($status === 0) {
                $statusSummary['pendingAmount'] = $amount;
                $statusSummary['pendingCount'] = $count;
            } elseif ($status === 1) {
                $statusSummary['processingAmount'] = $amount;
                $statusSummary['processingCount'] = $count;
            } elseif ($status === 2) {
                $statusSummary['paidAmount'] = $amount;
                $statusSummary['paidCount'] = $count;
            } elseif ($status === 3) {
                $statusSummary['disputedAmount'] = $amount;
                $statusSummary['disputedCount'] = $count;
            }
        }

        return Result::success([
            'startDate' => $startDate,
            'endDate' => $endDate,
            'bookingVolume' => (int) ($entry['booking_count'] ?? 0),
            'grossRevenue' => round((float) ($entry['gross_revenue'] ?? 0), 2),
            'commission' => round((float) ($entry['commission'] ?? 0), 2),
            'discountAmount' => round((float) ($entry['discount_amount'] ?? 0), 2),
            'mtripPays' => round((float) ($entry['mtrip_pays'] ?? 0), 2),
            'merchantPays' => round((float) ($entry['merchant_pays'] ?? 0), 2),
            'netSettlement' => round((float) ($entry['net_settlement'] ?? 0), 2),
            'settlement' => $statusSummary,
        ]);
    }

    /** 结算单列表 */
    public function settleList(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('finance_merchant_settle')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $this->scopeMerchantIds());

        if (($settleNo = $this->strInput('settleNo')) !== '') {
            $query->where('settle_no', $settleNo);
        }
        if (($cycle = $this->strInput('settleCycle')) !== '') {
            $query->where('settle_cycle', 'like', "%{$cycle}%");
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }

        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static function ($row) {
                $row = (array) $row;
                unset($row['deleted_at']);
                return $row;
            })
            ->all();

        return Result::page($list, $total, $page, $pageSize);
    }

    /** 结算单详情 + 订单级分账明细 */
    public function settleDetail(): array
    {
        $settle = $this->findScopedSettle($this->requireId());
        unset($settle['deleted_at']);

        [$startDate, $endDate] = $this->cycleRange((string) $settle['settle_cycle']);
        $entries = Db::table('finance_account_entry')
            ->where('merchant_id', (int) $settle['merchant_id'])
            ->whereBetween('created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(static fn ($row) => (array) $row)
            ->all();

        return Result::success([
            'settle' => $settle,
            'entries' => $entries,
        ]);
    }

    /** 商户提交结算差异申诉:待确认/处理中 → 有争议 */
    #[Permission('mch:earnings:dispute')]
    public function settleDispute(): array
    {
        $settle = $this->findScopedSettle($this->requireId());
        $status = (int) $settle['status'];
        if (! in_array($status, [0, 1], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待确认/处理中结算单可提交申诉');
        }
        $remark = $this->requireStr('remark');
        Db::table('finance_merchant_settle')->where('id', $settle['id'])->update([
            'status' => 3,
            'remark' => mb_substr($remark, 0, 500),
        ]);

        return Result::success(null, '申诉已提交');
    }

    private function scopeMerchantIds(): array
    {
        $ids = MerchantContext::scopeMerchantIds();
        return $ids === [] ? [0] : $ids;
    }

    private function findScopedSettle(int $id): array
    {
        $settle = Db::table('finance_merchant_settle')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $settle) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '结算单不存在');
        }
        $row = (array) $settle;
        if (! in_array((int) $row['merchant_id'], $this->scopeMerchantIds(), true)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $row;
    }

    private function dateRange(bool $defaultMonth = false): array
    {
        $defaultStart = $defaultMonth ? date('Y-m-01') : date('Y-m-d', strtotime('-6 days'));
        $defaultEnd = date('Y-m-d');
        $start = $this->strInput('startDate', $defaultStart);
        $end = $this->strInput('endDate', $defaultEnd);
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $start)) {
            $start = $defaultStart;
        }
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
            $end = $defaultEnd;
        }
        if ($start > $end) {
            [$start, $end] = [$end, $start];
        }
        return [$start, $end];
    }

    private function cycleRange(string $cycle): array
    {
        if (preg_match('/^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/', $cycle, $matches)) {
            return [$matches[1], $matches[2]];
        }
        if (preg_match('/^(\d{4}-\d{2})$/', $cycle)) {
            return ["{$cycle}-01", date('Y-m-t', strtotime("{$cycle}-01"))];
        }
        return $this->dateRange(true);
    }
}
