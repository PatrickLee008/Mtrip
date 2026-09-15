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
 * 酒店经营数据统一由 MerchantContext::scopePropertyIds() 强制裁剪。
 */
class StatsController extends AbstractAdminController
{
    /** 工作台聚合:KPI / 趋势 / 物业表现 / 今日运营 */
    public function dashboard(): array
    {
        $merchantIds = $this->scopeMerchantIds();
        $propertyIds = $this->scopePropertyIds();
        $today = date('Y-m-d');
        [$startDate, $endDate] = $this->dateRange();

        $todayOrders = Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())
            ->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->whereBetween('created_at', ["{$today} 00:00:00", "{$today} 23:59:59"]);

        $paidToday = Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())
            ->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->whereIn('order_status', [1, 2, 3])
            ->whereBetween('pay_time', ["{$today} 00:00:00", "{$today} 23:59:59"]);

        $pendingSettle = Db::table('finance_merchant_settle')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())
            ->whereIn('property_id', $propertyIds)
            ->whereIn('status', [0, 1]);

        return Result::success([
            'updatedAt' => date('Y-m-d H:i:s'),
            'kpi' => [
                'totalPropertyCount' => $this->propertyCount($propertyIds),
                'todayBookingCount' => (clone $todayOrders)->count(),
                'todayCheckInCount' => $this->dateOrderCount($propertyIds, 'use_date', $today),
                'todayCheckOutCount' => $this->dateOrderCount($propertyIds, 'end_date', $today),
                'currentGuestCount' => $this->currentGuestCount($propertyIds, $today),
                'occupancyRate' => null,
                'revenueToday' => round((float) (clone $paidToday)->sum('pay_amount'), 2),
                'pendingConfirmationCount' => $this->pendingConfirmationCount($propertyIds),
                'pendingSettleAmount' => round((float) (clone $pendingSettle)->sum('settle_amount'), 2),
                'activePromotionCount' => $this->activePromotionCount($propertyIds),
            ],
            'trend' => $this->trend($propertyIds, $startDate, $endDate),
            'propertyPerformance' => $this->propertyPerformance($propertyIds, $today),
            'todayOperations' => $this->todayOperations($propertyIds, $today),
            'alerts' => $this->alerts(),
        ]);
    }

    private function scopeMerchantIds(): array
    {
        $ids = MerchantContext::scopeMerchantIds();
        return $ids === [] ? [0] : $ids;
    }

    private function scopePropertyIds(): array
    {
        return MerchantContext::scopePropertyIds() ?: [-1];
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

    private function propertyCount(array $propertyIds): int
    {
        return Db::table('merchant_store')->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())->where('business_type', 'hotel')
            ->whereIn('id', $propertyIds)->count();
    }

    private function dateOrderCount(array $propertyIds, string $column, string $date): int
    {
        return Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->whereIn('order_status', [1, 2, 3])
            ->where($column, $date)
            ->count();
    }

    private function currentGuestCount(array $propertyIds, string $date): int
    {
        return Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->whereIn('order_status', [1, 2])
            ->where('use_date', '<=', $date)
            ->where(static function ($query) use ($date) {
                $query->whereNull('end_date')->orWhere('end_date', '>', $date);
            })
            ->count();
    }

    private function pendingConfirmationCount(array $propertyIds): int
    {
        return Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->where('order_status', 1)
            ->count();
    }

    private function activePromotionCount(array $propertyIds): int
    {
        $now = date('Y-m-d H:i:s');
        return Db::table('marketing_coupon')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())
            ->whereRaw('JSON_OVERLAPS(COALESCE(property_ids, JSON_ARRAY()), ?)', [json_encode($propertyIds)])
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

    private function trend(array $propertyIds, string $startDate, string $endDate): array
    {
        $rows = Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->whereIn('order_status', [1, 2, 3])
            ->whereBetween('pay_time', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->groupBy(Db::raw('DATE(pay_time)'))
            ->selectRaw('DATE(pay_time) AS day, COUNT(*) AS booking_count, COALESCE(SUM(pay_amount),0) AS sales_amount')
            ->pluck('sales_amount', 'day')
            ->all();

        $counts = Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
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

    private function propertyPerformance(array $propertyIds, string $today): array
    {
        $properties = Db::table('merchant_store')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())->where('business_type', 'hotel')
            ->whereIn('id', $propertyIds)
            ->get(['id', 'store_name', 'operating_status'])
            ->map(static fn ($row) => (array) $row)
            ->all();

        $bookingRows = Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->whereBetween('created_at', ["{$today} 00:00:00", "{$today} 23:59:59"])
            ->groupBy('property_id')
            ->selectRaw('property_id, COUNT(*) AS cnt')
            ->pluck('cnt', 'property_id')
            ->all();

        $revenueRows = Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->whereIn('order_status', [1, 2, 3])
            ->whereBetween('pay_time', ["{$today} 00:00:00", "{$today} 23:59:59"])
            ->groupBy('property_id')
            ->selectRaw('property_id, COALESCE(SUM(pay_amount),0) AS total')
            ->pluck('total', 'property_id')
            ->all();

        return array_map(static function (array $property) use ($bookingRows, $revenueRows) {
            $id = (int) $property['id'];
            return [
                'propertyId' => $id,
                'propertyName' => (string) $property['store_name'],
                'todayBookings' => (int) ($bookingRows[$id] ?? 0),
                'occupancyRate' => null,
                'revenueToday' => round((float) ($revenueRows[$id] ?? 0), 2),
                'status' => (int) $property['operating_status'],
            ];
        }, $properties);
    }

    private function todayOperations(array $propertyIds, string $today): array
    {
        return Db::table('order_main as o')
            ->leftJoin('merchant_store as p', 'p.id', '=', 'o.property_id')
            ->whereNull('o.deleted_at')
            ->where('o.site_id', MerchantContext::siteId())->where('o.order_type', 1)
            ->whereIn('o.property_id', $propertyIds)
            ->where(static function ($query) use ($today) {
                $query->where('o.use_date', $today)
                    ->orWhere('o.end_date', $today)
                    ->orWhereBetween('o.created_at', ["{$today} 00:00:00", "{$today} 23:59:59"]);
            })
            ->orderByDesc('o.id')
            ->limit(12)
            ->get([
                'o.id', 'o.order_no', 'o.contact_name', 'o.contact_phone', 'o.sku_name',
                'o.use_date', 'o.end_date', 'o.order_status', 'p.store_name',
            ])
            ->map(function ($row) {
                $row = (array) $row;
                return [
                    'orderId' => (int) $row['id'],
                    'orderNo' => (string) $row['order_no'],
                    'hotel' => (string) ($row['store_name'] ?? ''),
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
