<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 管理端多酒店 Trip(PRD 模块1.1):列表 / 详情(含各预订)
 */
class AdminTripController extends AbstractAdminController
{
    /** Trip 列表:筛选 tripNo/支付状态/日期 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('order_trip')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($tripNo = $this->strInput('tripNo')) !== '') {
            $query->where('trip_no', $tripNo);
        }
        $payStatus = $this->input('payStatus');
        if ($payStatus !== null && $payStatus !== '') {
            $query->where('pay_status', (int) $payStatus);
        }
        if (($start = $this->strInput('startDate')) !== '') {
            $query->where('created_at', '>=', "{$start} 00:00:00");
        }
        if (($end = $this->strInput('endDate')) !== '') {
            $query->where('created_at', '<=', "{$end} 23:59:59");
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get()->map(static function ($row) {
                $row = (array) $row;
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** Trip 详情:主单 + 各预订 */
    public function detail(): array
    {
        $trip = Db::table('order_trip')->where('id', $this->requireId())->whereNull('deleted_at')->first();
        if (! $trip) {
            throw new BusinessException(ErrorCode::NOT_FOUND, 'Trip 不存在');
        }
        $trip = (array) $trip;
        $this->assertSiteScope((int) $trip['site_id']);
        unset($trip['deleted_at']);
        $bookings = Db::table('order_main')->where('trip_id', $trip['id'])->whereNull('deleted_at')
            ->orderBy('use_date')->orderBy('id')
            ->get(['id', 'order_no', 'goods_name', 'sku_name', 'quantity', 'total_amount',
                'alloc_coupon_discount', 'pay_amount', 'order_status', 'refund_status', 'use_date', 'end_date'])
            ->map(static fn ($row) => (array) $row)->all();
        $trip['bookings'] = $bookings;
        return Result::success($trip);
    }
}
