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

        $occupancyTrend = $this->occupancyTrend($propertyIds, $startDate, $endDate);
        $arrivals = $this->guestFlow($propertyIds, 'use_date', $today, 3);
        $departures = $this->guestFlow($propertyIds, 'end_date', $today, 4);

        return Result::success([
            'updatedAt' => date('Y-m-d H:i:s'),
            'startDate' => $startDate,
            'endDate' => $endDate,
            'kpi' => [
                'totalPropertyCount' => $this->propertyCount($propertyIds),
                'todayBookingCount' => (clone $todayOrders)->count(),
                'todayCheckInCount' => $this->dateOrderCount($propertyIds, 'use_date', $today),
                'todayCheckOutCount' => $this->dateOrderCount($propertyIds, 'end_date', $today),
                'currentGuestCount' => $this->currentGuestCount($propertyIds, $today),
                // 区间日均入住率;无日库存时回退房型基础库存,两者都取不到才为 null
                'occupancyRate' => $this->occupancyAverage($occupancyTrend),
                // 近 7 日均值 − 前 7 日均值(百分点)
                'occupancyWeekDelta' => $this->occupancyWeekDelta($propertyIds),
                'todayArrivalGuestCount' => $arrivals['guests'],
                'todayArrivalGroupCount' => $arrivals['groups'],
                'todayArrivalRemainingCount' => $arrivals['pending'],
                'todayDepartureGuestCount' => $departures['guests'],
                'todayDepartureGroupCount' => $departures['groups'],
                'todayDeparturePendingCount' => $departures['pending'],
                'syncErrorCount' => $this->syncErrorCount($propertyIds, $startDate, $endDate),
                'revenueToday' => round((float) (clone $paidToday)->sum('pay_amount'), 2),
                'pendingConfirmationCount' => $this->pendingConfirmationCount($propertyIds),
                'pendingSettleAmount' => round((float) (clone $pendingSettle)->sum('settle_amount'), 2),
                'activePromotionCount' => $this->activePromotionCount($propertyIds),
            ],
            'trend' => $this->trend($propertyIds, $startDate, $endDate),
            'occupancyTrend' => $occupancyTrend,
            'roomTypePerformance' => $this->roomTypePerformance($propertyIds, $startDate, $endDate),
            'propertyPerformance' => $this->propertyPerformance($propertyIds, $today),
            'todayOperations' => $this->todayOperations($propertyIds, $today),
            'recentBookings' => $this->recentBookings($propertyIds),
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

    /**
     * 区间内每日入住率(口径见 README/HANDOFF):
     * 逐物业计算后汇总 —— 该物业该日有 goods_daily_stock 行时取 已售/总量,
     * 没有日库存行时回退「房型基础库存为分母 + 在住间夜数为分子」。
     * 混合组合(部分物业有日库存、部分没有)下两侧都能计入,不会漏掉无日库存的物业。
     * 全部物业都取不到库存时该日返回 null,前端显示占位。
     */
    private function occupancyWindow(array $propertyIds, string $startDate, string $endDate): array
    {
        $stockRows = Db::table('goods_daily_stock')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())
            ->where('sku_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->whereBetween('stock_date', [$startDate, $endDate])
            ->groupBy('property_id', 'stock_date')
            ->selectRaw('property_id, stock_date AS day, COALESCE(SUM(stock_sold),0) AS sold, COALESCE(SUM(stock_total),0) AS total')
            ->get();

        $stock = [];
        foreach ($stockRows as $row) {
            $row = (array) $row;
            $stock[(int) $row['property_id']][substr((string) $row['day'], 0, 10)] = [(int) $row['sold'], (int) $row['total']];
        }

        $baseStock = [];
        foreach (Db::table('hotel_room_type')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())
            ->whereIn('property_id', $propertyIds)
            ->where('status', 1)
            ->groupBy('property_id')
            ->selectRaw('property_id, COALESCE(SUM(base_stock),0) AS total')
            ->get() as $row) {
            $row = (array) $row;
            $baseStock[(int) $row['property_id']] = (int) $row['total'];
        }

        $occupied = $this->occupiedRoomNights($propertyIds, $startDate, $endDate);

        $result = [];
        $cursor = strtotime($startDate);
        $end = strtotime($endDate);
        while ($cursor !== false && $cursor <= $end) {
            $day = date('Y-m-d', $cursor);
            $sold = 0;
            $total = 0;
            foreach ($propertyIds as $propertyId) {
                $propertyId = (int) $propertyId;
                if (isset($stock[$propertyId][$day])) {
                    $sold += $stock[$propertyId][$day][0];
                    $total += $stock[$propertyId][$day][1];
                } else {
                    $total += $baseStock[$propertyId] ?? 0;
                    $sold += $occupied[$propertyId][$day] ?? 0;
                }
            }
            $result[$day] = $total > 0 ? round($sold / $total * 100, 1) : null;
            $cursor = strtotime('+1 day', $cursor);
        }
        return $result;
    }

    /** 区间内每日在住间夜数(use_date ≤ 当日 < end_date),按物业分组;用于日库存缺失时的分子 */
    private function occupiedRoomNights(array $propertyIds, string $startDate, string $endDate): array
    {
        $rows = Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())
            ->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->whereIn('order_status', [1, 2, 3])
            ->where('use_date', '<=', $endDate)
            ->where(static function ($query) use ($startDate) {
                $query->whereNull('end_date')->orWhere('end_date', '>', $startDate);
            })
            ->get(['property_id', 'use_date', 'end_date', 'quantity']);

        $counts = [];
        foreach ($rows as $row) {
            $row = (array) $row;
            $propertyId = (int) $row['property_id'];
            $from = max($startDate, (string) $row['use_date']);
            $to = (string) ($row['end_date'] ?? '');
            if ($to === '' || $to > $endDate) {
                $to = $endDate;
            }
            $qty = max(1, (int) $row['quantity']);
            $cursor = strtotime($from);
            $limit = strtotime($to);
            while ($cursor !== false && $limit !== false && $cursor < $limit) {
                $day = date('Y-m-d', $cursor);
                $counts[$propertyId][$day] = ($counts[$propertyId][$day] ?? 0) + $qty;
                $cursor = strtotime('+1 day', $cursor);
            }
        }
        return $counts;
    }

    private function occupancyTrend(array $propertyIds, string $startDate, string $endDate): array
    {
        $window = $this->occupancyWindow($propertyIds, $startDate, $endDate);
        $list = [];
        foreach ($window as $day => $rate) {
            $list[] = ['date' => $day, 'occupancyRate' => $rate];
        }
        return $list;
    }

    /** 区间日均入住率(null 值不参与平均;全为 null 时返回 null) */
    private function occupancyAverage(array $trend): ?float
    {
        $values = [];
        foreach ($trend as $item) {
            if (($item['occupancyRate'] ?? null) !== null) {
                $values[] = (float) $item['occupancyRate'];
            }
        }
        return $values === [] ? null : round(array_sum($values) / count($values), 1);
    }

    /** 近 7 日均值 − 前 7 日均值(百分点) */
    private function occupancyWeekDelta(array $propertyIds): ?float
    {
        $today = date('Y-m-d');
        $recent = $this->occupancyAverage($this->occupancyTrend(
            $propertyIds,
            date('Y-m-d', strtotime("{$today} -6 days")),
            $today,
        ));
        $prior = $this->occupancyAverage($this->occupancyTrend(
            $propertyIds,
            date('Y-m-d', strtotime("{$today} -13 days")),
            date('Y-m-d', strtotime("{$today} -7 days")),
        ));
        if ($recent === null || $prior === null) {
            return null;
        }
        return round($recent - $prior, 1);
    }

    /**
     * 今日到达 / 离店的住客数与单量。
     * 人数取 order_main.guests(AES 密文里的住客名单条数),为空(到店付/历史单)回退订单间数。
     * $doneStatus 为「已完成」的 booking_status:到达=3 已入住,离店=4 已退房。
     */
    private function guestFlow(array $propertyIds, string $column, string $date, int $doneStatus): array
    {
        $rows = Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())
            ->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->whereIn('order_status', [1, 2, 3])
            ->where($column, $date)
            ->get(['guests', 'quantity', 'booking_status']);

        $guests = 0;
        $groups = 0;
        $pending = 0;
        foreach ($rows as $row) {
            $row = (array) $row;
            $guests += $this->guestCountOf($row);
            $groups++;
            if ((int) $row['booking_status'] !== $doneStatus) {
                $pending++;
            }
        }
        return ['guests' => $guests, 'groups' => $groups, 'pending' => $pending];
    }

    private function guestCountOf(array $row): int
    {
        $plain = $this->decryptField((string) ($row['guests'] ?? ''));
        if ($plain !== '') {
            $list = json_decode($plain, true);
            if (is_array($list) && $list !== []) {
                return count($list);
            }
        }
        return max(1, (int) ($row['quantity'] ?? 1));
    }

    /** 运营告警项:区间内 PMS/渠道同步失败次数(按订单归属物业收窄) */
    private function syncErrorCount(array $propertyIds, string $startDate, string $endDate): int
    {
        return Db::table('order_sync_log as l')
            ->join('order_main as o', 'o.id', '=', 'l.order_id')
            ->whereNull('o.deleted_at')
            ->where('o.site_id', MerchantContext::siteId())
            ->where('o.order_type', 1)
            ->whereIn('o.property_id', $propertyIds)
            ->where('l.status', 2)
            ->whereBetween('l.created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->count();
    }

    /** 房型预订占比(环形图):区间内已支付订单按房型聚合,取前 6,percent 为占比 */
    private function roomTypePerformance(array $propertyIds, string $startDate, string $endDate): array
    {
        $rows = Db::table('order_main')
            ->whereNull('deleted_at')
            ->where('site_id', MerchantContext::siteId())
            ->where('order_type', 1)
            ->whereIn('property_id', $propertyIds)
            ->whereIn('order_status', [1, 2, 3])
            ->whereBetween('created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->groupBy('room_type_id', 'sku_name')
            ->selectRaw('room_type_id, sku_name, COUNT(*) AS booking_count')
            ->orderByDesc('booking_count')
            ->limit(6)
            ->get()
            ->map(static fn ($row) => (array) $row)
            ->all();

        $total = 0;
        foreach ($rows as $row) {
            $total += (int) $row['booking_count'];
        }

        return array_map(static function (array $row) use ($total) {
            $count = (int) $row['booking_count'];
            return [
                'roomTypeId' => (int) $row['room_type_id'],
                'roomName' => (string) $row['sku_name'],
                'bookingCount' => $count,
                'percent' => $total > 0 ? round($count / $total * 100, 1) : 0.0,
            ];
        }, $rows);
    }

    /** 近期预订结算行(表格):支付状态与预订状态原样下发,文案与配色由前端映射 */
    private function recentBookings(array $propertyIds): array
    {
        return Db::table('order_main as o')
            ->leftJoin('merchant_store as p', 'p.id', '=', 'o.property_id')
            ->whereNull('o.deleted_at')
            ->where('o.site_id', MerchantContext::siteId())
            ->where('o.order_type', 1)
            ->whereIn('o.property_id', $propertyIds)
            ->orderByDesc('o.id')
            ->limit(10)
            ->get([
                'o.id', 'o.order_no', 'o.contact_name', 'o.sku_name', 'o.use_date', 'o.end_date',
                'o.total_amount', 'o.payment_status', 'o.booking_status', 'o.order_status',
                'o.pay_method', 'p.store_name',
            ])
            ->map(static function ($row) {
                $row = (array) $row;
                return [
                    'orderId' => (int) $row['id'],
                    'orderNo' => (string) $row['order_no'],
                    'guest' => (string) $row['contact_name'],
                    'propertyName' => (string) ($row['store_name'] ?? ''),
                    'roomType' => (string) $row['sku_name'],
                    'checkIn' => (string) ($row['use_date'] ?? ''),
                    'checkOut' => (string) ($row['end_date'] ?? ''),
                    'totalAmount' => round((float) $row['total_amount'], 2),
                    'paymentStatus' => (int) $row['payment_status'],
                    'bookingStatus' => (int) $row['booking_status'],
                    'orderStatus' => (int) $row['order_status'],
                    'payMethod' => (int) $row['pay_method'],
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
