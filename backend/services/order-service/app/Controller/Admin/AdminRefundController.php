<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Service\Payment\RefundSettleService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;
use Mtrip\Shared\Support\UserNotify;

/**
 * 退款管理(文档 6.4.1 退款审核)
 * 状态机:0待商户审核 →(通过)1待平台审核 →(通过)2退款中 →(到账确认)3已退款
 *        0/1 →(驳回)4已驳回(订单恢复已支付);5已撤销(用户侧)
 * 平台后台可代商户审核;钱包 / 人工原路退款以人工确认到账闭环;
 * KBZPay MMQR 支付的订单(refund_channel=2)与迟到支付自动退款单(late_pay=1)经 payment-service 原路退款(方案 22):
 * 平台审核通过即排队(独立单立即提交,行程支付合并提交;同一笔支付超 3 次改退钱包),
 * 「确认到账」用于立即提交 / 失败后重试,到账由支付中心通知收敛。
 * 列表 / 详情行附带订单 pay_method,以及 order_refund 的 pay_no / late_pay / channel_submit_status。
 */
class AdminRefundController extends AbstractAdminController
{
    /** 退款到账落账 + KBZ 原路退款(与支付中心通知共用) */
    #[Inject]
    protected RefundSettleService $refundSettle;

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
        $rows = $query->orderByDesc('id')->forPage($page, $pageSize)->get()->map(static fn ($row) => (array) $row)->all();
        // 订单支付方式(前端据此判断 KBZ 原路退款行:late_pay=1,或 refund_channel=2 且 pay_method=5);order_main 为单表直查
        $payMethods = $rows === [] ? [] : Db::table('order_main')
            ->whereIn('id', array_values(array_unique(array_map(static fn ($r) => (int) $r['order_id'], $rows))))
            ->pluck('pay_method', 'id')->all();
        $list = array_map(function (array $row) use ($payMethods) {
            $row['images'] = $this->jsonDecode($row['images']);
            $row['pay_method'] = (int) ($payMethods[$row['order_id']] ?? 0);
            unset($row['deleted_at']);
            return $row;
        }, $rows);
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
        $refund['pay_method'] = $order !== null ? (int) $order->pay_method : 0;
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
        // KBZPay MMQR 支付的订单:审核通过即进入原路退款队列(channel_submit_status=1)——独立单立即提交支付中心,
        // 行程支付等合并窗口由 kbz-refund-batch 合并提交;结果由 refunded / refund_failed 通知收敛。
        // 提交失败不回滚审核,退款单保持「退款中」并记原因,可在「确认到账」重试
        $order = (array) Db::table('order_main')->where('id', $refund['order_id'])->first();
        $kbz = $order !== [] && RefundSettleService::isKbzRefund($refund, $order);
        Db::table('order_refund')->where('id', $refund['id'])->update(array_merge([
            'status' => 2,
            'refund_amount' => $refundAmount,
            'deduct_amount' => round((float) $refund['apply_amount'] - $refundAmount, 2),
            'audit_remark' => mb_substr($remark, 0, 500),
        ], $this->auditStamp(1), $kbz ? RefundSettleService::queueFields($order) : []));

        if ($kbz) {
            $refund = (array) Db::table('order_refund')->where('id', $refund['id'])->first();
            $r = $this->refundSettle->afterQueued($refund, $order, AdminContext::adminId());
            return Result::success(['refundAmount' => $refundAmount, 'kbzRefund' => $r], '平台审核通过,' . $r['message']);
        }
        return Result::success(['refundAmount' => $refundAmount], '平台审核通过,进入退款中(原路退回)');
    }

    /**
     * 确认退款到账:退款中(2)→ 已退款(3);更新订单、回补库存、落资金流水
     * PRD v1.0:退款默认入 mTrip 钱包(refund_channel=1)——事务内给用户余额入账并写 user_balance_log;
     *          refund_channel=2 保留原路退回(仅记 finance_flow,不动钱包)。
     */
    #[Permission('order:refund:audit')]
    public function confirm(): array
    {
        $refund = $this->findScoped($this->requireId());
        if ((int) $refund['status'] !== 2) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅退款中的退款单可确认到账');
        }
        $order = Db::table('order_main')->where('id', $refund['order_id'])->first();
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '关联订单不存在');
        }
        $order = (array) $order;
        // KBZPay 原路退款(KBZ 支付订单 / 迟到支付自动退款):不人工确认到账,改为(重新)提交支付中心——
        // 排队中的立即合并提交(不等窗口);已提交的旧请求仍在处理则不重发;次数超限改退钱包;
        // 结果由 refunded / refund_failed 通知或同步结果收敛
        if (RefundSettleService::isKbzRefund($refund, $order)) {
            $r = $this->refundSettle->submit($refund, AdminContext::adminId());
            return Result::success($r, $r['message']);
        }
        $toWallet = (int) ($refund['refund_channel'] ?? 1) === 1;
        // 原路退回需第三方退款流水号;钱包退款不需要
        $tradeNo = $this->strInput('refundTradeNo');
        if (! $toWallet && $tradeNo === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '原路退回需填写第三方退款流水号');
        }

        // 到账落账(退款单 / 订单状态 / 库存 / 返券 / 钱包 / 支出流水 / 时间线)与 KBZ 原路退款完成共用一套实现
        $done = Db::transaction(fn () => $this->refundSettle->completeRow(
            $refund,
            $tradeNo,
            $toWallet,
            (int) $order['pay_method'],
            \App\Constants\BookingConst::OPERATOR_PLATFORM,
            AdminContext::adminId(),
        ));
        $order = $done['order'];
        $refundAmount = $done['refundAmount'];
        $fullRefund = $done['fullRefund'];
        // 住客站内通知:退款到账(PRD 模块 10 / 退款到账通知),后置容错
        try {
            UserNotify::order($order, 'refund_completed', ['amount' => $refundAmount, 'toWallet' => $toWallet]);
        } catch (\Throwable) {
        }
        $channelMsg = $toWallet ? '已退入 mTrip 钱包' : '已原路退回';
        return Result::success(null, ($fullRefund ? '退款已完成,订单已关闭并回补库存' : '部分退款已完成,订单继续有效') . ",{$channelMsg}");
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
