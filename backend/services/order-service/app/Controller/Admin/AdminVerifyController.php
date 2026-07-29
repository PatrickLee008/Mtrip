<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 核销管理:后台手工核销 / 撤销核销(需备注审批) / 核销日志
 * 核销:订单 1已支付 → 2已核销,日志 verify_type=3 后台手工
 * 撤销:订单 2 → 1,原成功日志置 3已撤销(永久留痕,不删除)
 */
class AdminVerifyController extends AbstractAdminController
{
    /** 手工核销:按订单ID或核销码;仅已支付订单 */
    #[Permission('order:verify:list')]
    public function verify(): array
    {
        $order = $this->resolveOrder();
        if ((int) $order['order_status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已支付订单可核销');
        }
        // 使用日期未到不可核销(允许当日及之后补核销)
        if ($order['use_date'] !== null && (string) $order['use_date'] > date('Y-m-d')) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "订单使用日期为 {$order['use_date']},尚未到期");
        }
        Db::transaction(static function () use ($order) {
            Db::table('order_main')->where('id', $order['id'])->update(['order_status' => 2]);
            Db::table('order_verify_log')->insert([
                'site_id' => (int) $order['site_id'],
                'order_id' => (int) $order['id'],
                'order_no' => (string) $order['order_no'],
                'verify_code' => (string) $order['verify_code'],
                'merchant_id' => (int) $order['merchant_id'],
                'device_id' => 0,
                'operator_id' => AdminContext::adminId(),
                'operator_name' => AdminContext::adminName(),
                'verify_type' => 3,
                'status' => 1,
            ]);
        });
        return Result::success(['orderId' => (int) $order['id']], '核销成功');
    }

    /** 撤销核销(需审批备注):订单 2→1,原成功日志置已撤销 */
    #[Permission('order:verify:revoke')]
    public function verifyCancel(): array
    {
        $order = $this->resolveOrder();
        if ((int) $order['order_status'] !== 2) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已核销订单可撤销核销');
        }
        $reason = $this->requireStr('reason');
        Db::transaction(static function () use ($order, $reason) {
            Db::table('order_main')->where('id', $order['id'])->update(['order_status' => 1]);
            Db::table('order_verify_log')
                ->where('order_id', $order['id'])->where('status', 1)
                ->update([
                    'status' => 3,
                    'revoke_reason' => mb_substr($reason, 0, 500),
                    'revoke_by' => AdminContext::adminId(),
                ]);
        });
        return Result::success(null, '核销已撤销,订单恢复已支付');
    }

    /** 核销日志:筛选 订单号/商户/方式/状态/日期 */
    public function logs(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('order_verify_log');
        $this->applySiteScope($query);
        if (($orderNo = $this->strInput('orderNo')) !== '') {
            $query->where('order_no', $orderNo);
        }
        if (($merchantId = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $merchantId);
        }
        if (($verifyType = $this->intInput('verifyType')) > 0) {
            $query->where('verify_type', $verifyType);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
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

    /** 按订单ID或核销码取订单并校验站点权限 */
    private function resolveOrder(): array
    {
        $orderId = $this->intInput('id');
        $verifyCode = $this->strInput('verifyCode');
        if ($orderId <= 0 && $verifyCode === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请提供订单ID或核销码');
        }
        $query = Db::table('order_main')->whereNull('deleted_at');
        $orderId > 0 ? $query->where('id', $orderId) : $query->where('verify_code', $verifyCode);
        $order = $query->first();
        if (! $order) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '订单不存在');
        }
        $order = (array) $order;
        $this->assertSiteScope((int) $order['site_id']);
        return $order;
    }
}
