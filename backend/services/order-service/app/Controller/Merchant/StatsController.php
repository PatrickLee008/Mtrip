<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\Admin\AbstractAdminController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

/**
 * 商户端经营看板统计(Merchant App M5)。
 * 数据范围统一由 MerchantContext::scopeMerchantIds() 强制裁剪。
 */
class StatsController extends AbstractAdminController
{
    /** 工作台聚合:KPI / 趋势 / 物业表现 / 今日运营 */
    public function dashboard(): array
    {
        $merchantIds = $this->scopeMerchantIds();
        $today = date('Y-m-d');
        [$startDate, $endDate] = $this->dateRange();

        $todayOrders = Db::table('order_main')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->whereBetween('created_at', ["{$today} 00:00:00", "{$today} 23:59:59"]);

        $paidToday = Db::table('order_main')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->whereIn('order_status', [1, 2, 3])
            ->whereBetween('pay_time', ["{$today} 00:00:00", "{$today} 23:59:59"]);

        $pendingSettle = Db::table('finance_merchant_settle')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->whereIn('status', [0, 1]);

        return Result::success([
            'updatedAt' => date('Y-m-d H:i:s'),
            'kpi' => [
                'totalPropertyCount' => $this->propertyCount($merchantIds),
                'todayBookingCount' => (clone $todayOrders)->count(),
                'todayCheckInCount' => $this->dateOrderCount($merchantIds, 'use_date', $today),
                'todayCheckOutCount' => $this->dateOrderCount($merchantIds, 'end_date', $today),
                'currentGuestCount' => $this->currentGuestCount($merchantIds, $today),
                'occupancyRate' => null, // M2/M3 房型与房量域未完成,避免伪造入住率。
                'revenueToday' => round((float) (clone $paidToday)->sum('pay_amount'), 2),
                'pendingConfirmationCount' => $this->pendingConfirmationCount($merchantIds),
                'pendingSettleAmount' => round((float) (clone $pendingSettle)->sum('settle_amount'), 2),
                'activePromotionCount' => $this->activePromotionCount($merchantIds),
            ],
            'trend' => $this->trend($merchantIds, $startDate, $endDate),
            'propertyPerformance' => $this->propertyPerformance($merchantIds, $today),
            'todayOperations' => $this->todayOperations($merchantIds, $today),
            'alerts' => $this->alerts(),
        ]);
    }

    private function scopeMerchantIds(): array
    {
        $ids = MerchantContext::scopeMerchantIds();
        return $ids === [] ? [0] : $ids;
    }

    private function dateRange(): array
    {
        $end = $this->strInput('endDate', date('Y-m-d'));
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
            $end = date('Y-m-d');
        }
        $start = $this->strInput('startDate', date('Y-m-d', strtotime("{$end} -6 days")));
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $start)) {
            $start = date('Y-m-d', strtotime("{$end} -6 days"));
        }
        if ($start > $end) {
            [$start, $end] = [$end, $start];
        }
        return [$start, $end];
    }

    private function propertyCount(array $merchantIds): int
    {
        $query = Db::table('merchant_store')->whereNull('deleted_at')->whereIn('merchant_id', $merchantIds);
        $storeId = MerchantContext::scopeStoreId();
        if ($storeId !== null && $storeId > 0) {
            $query->where('id', $storeId);
        }
        return $query->count();
    }

    private function dateOrderCount(array $merchantIds, string $column, string $date): int
    {
        return Db::table('order_main')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->whereIn('order_status', [1, 2, 3])
            ->where($column, $date)
            ->count();
    }

    private function currentGuestCount(array $merchantIds, string $date): int
    {
        return Db::table('order_main')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->whereIn('order_status', [1, 2])
            ->where('use_date', '<=', $date)
            ->where(static function ($query) use ($date) {
                $query->whereNull('end_date')->orWhere('end_date', '>', $date);
            })
            ->count();
    }

    private function pendingConfirmationCount(array $merchantIds): int
    {
        return Db::table('order_main')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->where('order_status', 1)
            ->count();
    }

    private function activePromotionCount(array $merchantIds): int
    {
        $now = date('Y-m-d H:i:s');
        return Db::table('marketing_coupon')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->where('status', 1)
            ->where(static function ($query) use ($now) {
                $query->where('valid_type', 2)
                    ->orWhere(static function ($q) use ($now) {
                        $q->where('valid_type', 1)
                            ->where('valid_start', '<=', $now)
                            ->where('valid_end', '>=', $now);
                    });
            })
            ->count();
    }

    private function trend(array $merchantIds, string $startDate, string $endDate): array
    {
        $rows = Db::table('order_main')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->whereIn('order_status', [1, 2, 3])
            ->whereBetween('pay_time', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->groupBy(Db::raw('DATE(pay_time)'))
            ->selectRaw('DATE(pay_time) AS day, COUNT(*) AS booking_count, COALESCE(SUM(pay_amount),0) AS sales_amount')
            ->pluck('sales_amount', 'day')
            ->all();

        $counts = Db::table('order_main')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->whereIn('order_status', [1, 2, 3])
            ->whereBetween('pay_time', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->groupBy(Db::raw('DATE(pay_time)'))
            ->selectRaw('DATE(pay_time) AS day, COUNT(*) AS booking_count')
            ->pluck('booking_count', 'day')
            ->all();

        $list = [];
        $cursor = strtotime($startDate);
        $end = strtotime($endDate);
        while ($cursor !== false && $cursor <= $end) {
            $day = date('Y-m-d', $cursor);
            $list[] = [
                'date' => $day,
                'bookingCount' => (int) ($counts[$day] ?? 0),
                'salesAmount' => round((float) ($rows[$day] ?? 0), 2),
            ];
            $cursor = strtotime('+1 day', $cursor);
        }
        return $list;
    }

    private function propertyPerformance(array $merchantIds, string $today): array
    {
        $merchants = Db::table('merchant_info')
            ->whereNull('deleted_at')
            ->whereIn('id', $merchantIds)
            ->get(['id', 'merchant_name', 'status'])
            ->map(static fn ($row) => (array) $row)
            ->all();

        $bookingRows = Db::table('order_main')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->whereBetween('created_at', ["{$today} 00:00:00", "{$today} 23:59:59"])
            ->groupBy('merchant_id')
            ->selectRaw('merchant_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'merchant_id')
            ->all();

        $revenueRows = Db::table('order_main')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $merchantIds)
            ->whereIn('order_status', [1, 2, 3])
            ->whereBetween('pay_time', ["{$today} 00:00:00", "{$today} 23:59:59"])
            ->groupBy('merchant_id')
            ->selectRaw('merchant_id, COALESCE(SUM(pay_amount),0) AS total')
            ->pluck('total', 'merchant_id')
            ->all();

        return array_map(static function (array $merchant) use ($bookingRows, $revenueRows) {
            $id = (int) $merchant['id'];
            return [
                'propertyId' => $id,
                'propertyName' => (string) $merchant['merchant_name'],
                'todayBookings' => (int) ($bookingRows[$id] ?? 0),
                'occupancyRate' => null,
                'revenueToday' => round((float) ($revenueRows[$id] ?? 0), 2),
                'status' => (int) $merchant['status'],
            ];
        }, $merchants);
    }

    private function todayOperations(array $merchantIds, string $today): array
    {
        return Db::table('order_main as o')
            ->leftJoin('merchant_info as m', 'm.id', '=', 'o.merchant_id')
            ->whereNull('o.deleted_at')
            ->whereIn('o.merchant_id', $merchantIds)
            ->where(static function ($query) use ($today) {
                $query->where('o.use_date', $today)
                    ->orWhere('o.end_date', $today)
                    ->orWhereBetween('o.created_at', ["{$today} 00:00:00", "{$today} 23:59:59"]);
            })
            ->orderByDesc('o.id')
            ->limit(12)
            ->get([
                'o.id', 'o.order_no', 'o.contact_name', 'o.contact_phone', 'o.sku_name',
                'o.use_date', 'o.end_date', 'o.order_status', 'm.merchant_name',
            ])
            ->map(function ($row) {
                $row = (array) $row;
                return [
                    'orderId' => (int) $row['id'],
                    'orderNo' => (string) $row['order_no'],
                    'hotel' => (string) ($row['merchant_name'] ?? ''),
                    'guest' => (string) $row['contact_name'],
                    'guestPhone' => MaskHelper::mobile($this->decryptField((string) $row['contact_phone'])),
                    'room' => (string) $row['sku_name'],
                    'checkIn' => (string) ($row['use_date'] ?? ''),
                    'checkOut' => (string) ($row['end_date'] ?? ''),
                    'status' => (int) $row['order_status'],
                ];
            })
            ->all();
    }

    private function alerts(): array
    {
        return [
            [
                'type' => 'sync',
                'level' => 'warning',
                'title' => 'dashboard.alerts.syncTitle',
                'message' => 'dashboard.alerts.syncMessage',
            ],
        ];
    }
}
