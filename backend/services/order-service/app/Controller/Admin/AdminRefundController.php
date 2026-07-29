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
use Mtrip\Shared\Support\OrderNoGenerator;
use Mtrip\Shared\Support\Result;

/**
 * 退款管理(文档 6.4.1 退款审核)
 * 状态机:0待商户审核 →(通过)1待平台审核 →(通过)2退款中 →(到账确认)3已退款
 *        0/1 →(驳回)4已驳回(订单恢复已支付);5已撤销(用户侧)
 * 平台后台可代商户审核;实际打款对接 payment-service(模块08 联调),此处以人工确认到账闭环
 */
class AdminRefundController extends AbstractAdminController
{
    #[Inject]
    protected OrderStockService $stockService;

    /** 退款单列表:筛选 退款单号/订单号/状态/商户/申请日期 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('order_refund')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($refundNo = $this->strInput('refundNo')) !== '') {
            $query->where('refund_no', $refundNo);
        }
        if (($orderNo = $this->strInput('orderNo')) !== '') {
            $query->where('order_no', $orderNo);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        if (($merchantId = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $merchantId);
        }
        if (($start = $this->strInput('startDate')) !== '') {
            $query->where('created_at', '>=', "{$start} 00:00:00");
        }
        if (($end = $this->strInput('endDate')) !== '') {
            $query->where('created_at', '<=', "{$end} 23:59:59");
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['images'] = $this->jsonDecode($row['images']);
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 退款单详情:含订单快照 */
    public function detail(): array
    {
        $refund = $this->findScoped($this->requireId());
        $refund['images'] = $this->jsonDecode($refund['images']);
        unset($refund['deleted_at']);
        $order = Db::table('order_main')
            ->where('id', $refund['order_id'])
            ->first(['id', 'order_no', 'order_type', 'goods_name', 'sku_name', 'quantity',
                'total_amount', 'pay_amount', 'order_status', 'refund_status',
                'use_date', 'end_date', 'contact_name', 'pay_method', 'pay_time', 'created_at']);
        return Result::success([
            'refund' => $refund,
            'order' => $order !== null ? (array) $order : null,
        ]);
    }

    /**
     * 退款审核:auditStatus 1通过 2驳回(必填原因)
     * 待商户审核(0)→ 通过进入待平台审核(1);待平台审核(1)→ 通过进入退款中(2,可传 refundAmount 核定金额)
     */
    #[Permission('order:refund:audit')]
    public function audit(): array
    {
        $refund = $this->findScoped($this->requireId());
        $status = (int) $refund['status'];
        if (! in_array($status, [0, 1], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核退款单可审核');
        }
        $auditStatus = $this->intInput('auditStatus');
        $remark = $this->strInput('auditRemark');
        if (! in_array($auditStatus, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 auditStatus 不正确');
        }
        if ($auditStatus === 2 && $remark === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '驳回必须填写原因');
        }

        // 驳回:订单恢复已支付
        if ($auditStatus === 2) {
            Db::transaction(function () use ($refund, $status, $remark) {
                Db::table('order_refund')->where('id', $refund['id'])->update(array_merge([
                    'status' => 4,
                    'audit_remark' => mb_substr($remark, 0, 500),
                ], $this->auditStamp($status)));
                Db::table('order_main')->where('id', $refund['order_id'])->update([
                    'order_status' => 1,
                    'refund_status' => 0,
                ]);
            });
            return Result::success(null, '退款已驳回,订单恢复已支付');
        }

        // 商户环节通过 → 待平台审核
        if ($status === 0) {
            Db::table('order_refund')->where('id', $refund['id'])->update(array_merge([
                'status' => 1,
                'audit_remark' => mb_substr($remark, 0, 500),
            ], $this->auditStamp(0)));
            return Result::success(null, '商户环节审核通过,待平台审核');
        }

        // 平台环节通过 → 退款中(核定实际退款金额)
        $refundAmount = $this->input('refundAmount') !== null
            ? round($this->floatInput('refundAmount'), 2)
            : (float) $refund['apply_amount'];
        if ($refundAmount <= 0 || $refundAmount > (float) $refund['apply_amount']) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '核定退款金额须大于0且不超过申请金额');
        }
        Db::table('order_refund')->where('id', $refund['id'])->update(array_merge([
            'status' => 2,
            'refund_amount' => $refundAmount,
            'deduct_amount' => round((float) $refund['apply_amount'] - $refundAmount, 2),
            'audit_remark' => mb_substr($remark, 0, 500),
        ], $this->auditStamp(1)));
        return Result::success(['refundAmount' => $refundAmount], '平台审核通过,进入退款中(原路退回)');
    }

    /** 确认退款到账:退款中(2)→ 已退款(3);更新订单、回补库存、落资金流水 */
    #[Permission('order:refund:audit')]
    public function confirm(): array
    {
        $refund = $this->findScoped($this->requireId());
        if ((int) $refund['status'] !== 2) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅退款中的退款单可确认到账');
        }
        $tradeNo = $this->strInput('refundTradeNo');
        $order = Db::table('order_main')->where('id', $refund['order_id'])->first();
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '关联订单不存在');
        }
        $order = (array) $order;
        $fullRefund = (float) $refund['refund_amount'] >= (float) $order['pay_amount'];

        Db::transaction(function () use ($refund, $order, $tradeNo, $fullRefund) {
            Db::table('order_refund')->where('id', $refund['id'])->update([
                'status' => 3,
                'refund_trade_no' => $tradeNo,
                'refund_time' => date('Y-m-d H:i:s'),
            ]);
            Db::table('order_main')->where('id', $order['id'])->update([
                'order_status' => $fullRefund ? 6 : 1,
                'refund_status' => $fullRefund ? 3 : 2,
            ]);
            // 全额退款回补库存(change_type=4);部分退款订单仍有效不回补
            if ($fullRefund) {
                $this->stockService->refundRestore($order);
            }
            // 资金流水:订单退款支出
            Db::table('finance_flow')->insert([
                'flow_no' => OrderNoGenerator::flowNo(),
                'site_id' => (int) $refund['site_id'],
                'flow_type' => 2,
                'biz_type' => 2,
                'amount' => (float) $refund['refund_amount'],
                'order_id' => (int) $refund['order_id'],
                'merchant_id' => (int) $refund['merchant_id'],
                'pay_channel' => (int) $order['pay_method'],
                'trade_no' => $tradeNo,
                'flow_status' => 1,
                'remark' => "退款单 {$refund['refund_no']} 到账确认",
                'operator_id' => AdminContext::adminId(),
            ]);
        });
        return Result::success(null, $fullRefund ? '退款已完成,订单已关闭并回补库存' : '部分退款已完成,订单继续有效');
    }

    /** 取退款单并校验站点数据权限 */
    private function findScoped(int $id): array
    {
        $refund = Db::table('order_refund')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $refund) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '退款单不存在');
        }
        $refund = (array) $refund;
        $this->assertSiteScope((int) $refund['site_id']);
        return $refund;
    }

    /** 按审核环节生成审核人/时间字段 */
    private function auditStamp(int $stage): array
    {
        $prefix = $stage === 0 ? 'merchant' : 'platform';
        return [
            "{$prefix}_audit_by" => AdminContext::adminId(),
            "{$prefix}_audit_time" => date('Y-m-d H:i:s'),
        ];
    }

    private function jsonDecode(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : [];
        }
        return [];
    }
}
