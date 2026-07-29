<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Service\OrderStockService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

/**
 * 订单管理(文档 6.4.1)
 * 状态机:0待支付 1已支付 2已入住/已核销 3已完成 4已取消 5退款中 6已退款 7已过期
 * 管理端仅可:待支付改价/取消;备注任意状态;退款与核销走专属控制器
 */
class AdminOrderController extends AbstractAdminController
{
    #[Inject]
    protected OrderStockService $stockService;

    /** 订单列表:筛选 订单号/类型/状态/商户/用户/下单与使用日期,手机号脱敏 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('order_main')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($orderNo = $this->strInput('orderNo')) !== '') {
            $query->where('order_no', $orderNo);
        }
        if (($type = $this->intInput('orderType')) > 0) {
            $query->where('order_type', $type);
        }
        $status = $this->input('orderStatus');
        if ($status !== null && $status !== '') {
            $query->where('order_status', (int) $status);
        }
        if (($merchantId = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $merchantId);
        }
        if (($userId = $this->intInput('userId')) > 0) {
            $query->where('user_id', $userId);
        }
        if (($name = $this->strInput('contactName')) !== '') {
            $query->where('contact_name', 'like', "%{$name}%");
        }
        if (($start = $this->strInput('startDate')) !== '') {
            $query->where('created_at', '>=', "{$start} 00:00:00");
        }
        if (($end = $this->strInput('endDate')) !== '') {
            $query->where('created_at', '<=', "{$end} 23:59:59");
        }
        if (($useDate = $this->strInput('useDate')) !== '') {
            $query->where('use_date', $useDate);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $row['contact_phone']));
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 订单详情:含退款单与核销日志;超管可见明文手机号 */
    public function detail(): array
    {
        $order = $this->findScoped($this->requireId());
        $phone = $this->decryptField((string) $order['contact_phone']);
        $order['contact_phone'] = AdminContext::isSuper() ? $phone : MaskHelper::mobile($phone);
        unset($order['deleted_at']);

        $refunds = Db::table('order_refund')
            ->where('order_id', $order['id'])->whereNull('deleted_at')
            ->orderByDesc('id')->get()
            ->map(static function ($row) {
                $row = (array) $row;
                unset($row['deleted_at']);
                return $row;
            })->all();
        $verifyLogs = Db::table('order_verify_log')
            ->where('order_id', $order['id'])->orderByDesc('id')->get()
            ->map(static fn ($row) => (array) $row)->all();

        return Result::success([
            'order' => $order,
            'refunds' => $refunds,
            'verifyLogs' => $verifyLogs,
        ]);
    }

    /** 订单统计:按下单日期区间汇总(默认近30天) */
    public function statistics(): array
    {
        $startDate = $this->strInput('startDate', date('Y-m-d', strtotime('-29 days')));
        $endDate = $this->strInput('endDate', date('Y-m-d'));
        $base = Db::table('order_main')
            ->whereBetween('created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->whereNull('deleted_at');
        $this->applySiteScope($base);
        if (($merchantId = $this->intInput('merchantId')) > 0) {
            $base->where('merchant_id', $merchantId);
        }

        $statusCounts = (clone $base)
            ->groupBy('order_status')
            ->selectRaw('order_status, COUNT(*) AS cnt')
            ->pluck('cnt', 'order_status')->all();
        $paid = (clone $base)->whereIn('order_status', [1, 2, 3]);
        $salesAmount = (float) (clone $paid)->sum('pay_amount');
        $commission = (float) (clone $paid)->sum('platform_commission');
        $refundAmount = (float) Db::table('order_refund')
            ->whereBetween('created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->where('status', 3)->whereNull('deleted_at')
            ->when(! AdminContext::isSuper(), static fn ($q) => $q->where('site_id', AdminContext::siteId()))
            ->sum('refund_amount');

        return Result::success([
            'startDate' => $startDate,
            'endDate' => $endDate,
            'orderCount' => array_sum($statusCounts),
            'paidCount' => ($statusCounts[1] ?? 0) + ($statusCounts[2] ?? 0) + ($statusCounts[3] ?? 0),
            'verifiedCount' => (int) ($statusCounts[2] ?? 0),
            'finishedCount' => (int) ($statusCounts[3] ?? 0),
            'cancelledCount' => (int) ($statusCounts[4] ?? 0) + (int) ($statusCounts[7] ?? 0),
            'refundingCount' => (int) ($statusCounts[5] ?? 0),
            'refundedCount' => (int) ($statusCounts[6] ?? 0),
            'salesAmount' => round($salesAmount, 2),
            'commission' => round($commission, 2),
            'refundAmount' => round((float) $refundAmount, 2),
            'statusCounts' => (object) $statusCounts,
        ]);
    }

    /** 改价:仅待支付订单;新实付不得高于订单总额,差额记入优惠 */
    #[Permission('order:all:cancel')]
    public function modifyPrice(): array
    {
        $order = $this->findScoped($this->requireId());
        if ((int) $order['order_status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待支付订单可改价');
        }
        $newAmount = round($this->floatInput('payAmount', -1), 2);
        if ($newAmount < 0 || $newAmount > (float) $order['total_amount']) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '实付金额须在 0 与订单总额之间');
        }
        $reason = $this->requireStr('reason');
        Db::table('order_main')->where('id', $order['id'])->update([
            'pay_amount' => $newAmount,
            'discount_amount' => round((float) $order['total_amount'] - $newAmount, 2),
            'remark' => mb_substr("[改价]{$reason} " . $order['remark'], 0, 500),
        ]);
        return Result::success(['payAmount' => $newAmount], '订单已改价');
    }

    /** 取消订单:仅待支付;释放锁定库存并记录原因 */
    #[Permission('order:all:cancel')]
    public function cancel(): array
    {
        $order = $this->findScoped($this->requireId());
        if ((int) $order['order_status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待支付订单可直接取消,已支付请走退款流程');
        }
        $reason = $this->requireStr('reason');
        Db::transaction(function () use ($order, $reason) {
            Db::table('order_main')->where('id', $order['id'])->update([
                'order_status' => 4,
                'cancel_reason' => mb_substr($reason, 0, 500),
                'cancel_time' => date('Y-m-d H:i:s'),
            ]);
            $this->stockService->release($order);
        });
        return Result::success(null, '订单已取消,库存已释放');
    }

    /** 更新订单备注(任意状态) */
    #[Permission('order:all:list')]
    public function remark(): array
    {
        $order = $this->findScoped($this->requireId());
        Db::table('order_main')->where('id', $order['id'])->update([
            'remark' => mb_substr($this->requireStr('remark'), 0, 500),
        ]);
        return Result::success(null, '备注已更新');
    }

    /** 取订单并校验站点数据权限 */
    private function findScoped(int $id): array
    {
        $order = Db::table('order_main')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '订单不存在');
        }
        $order = (array) $order;
        $this->assertSiteScope((int) $order['site_id']);
        return $order;
    }
}
