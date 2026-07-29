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
 * 商户提现管理(文档 6.4.5)
 * 状态机:0待审核 →(通过)1打款中 →(确认打款)2已打款;0→(驳回)3;1→(打款失败)4
 */
class WithdrawController extends AbstractController
{
    /** 提现申请列表:筛选 提现单号/商户/状态/日期 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('finance_withdraw')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($withdrawNo = $this->strInput('withdrawNo')) !== '') {
            $query->where('withdraw_no', $withdrawNo);
        }
        if (($merchantId = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $merchantId);
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
            ->map(static function ($row) {
                $row = (array) $row;
                // 收款账户快照列表不下发,详情解密展示
                unset($row['account_info'], $row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 提现详情:收款账户信息解密展示 */
    public function detail(): array
    {
        $withdraw = $this->findScoped($this->requireId());
        $withdraw['account_info'] = $this->decryptField((string) $withdraw['account_info']);
        unset($withdraw['deleted_at']);
        return Result::success($withdraw);
    }

    /** 审核:auditStatus 1通过(0→1打款中) 2驳回(0→3,必填原因) */
    #[Permission('finance:msettle:confirm')]
    public function audit(): array
    {
        $withdraw = $this->findScoped($this->requireId());
        if ((int) $withdraw['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核提现单可审核');
        }
        $auditStatus = $this->intInput('auditStatus');
        $remark = $this->strInput('auditRemark');
        if (! in_array($auditStatus, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 auditStatus 不正确');
        }
        if ($auditStatus === 2 && $remark === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '驳回必须填写原因');
        }
        Db::table('finance_withdraw')->where('id', $withdraw['id'])->update([
            'status' => $auditStatus === 1 ? 1 : 3,
            'audit_by' => AdminContext::adminId(),
            'audit_time' => date('Y-m-d H:i:s'),
            'audit_remark' => mb_substr($remark, 0, 500),
        ]);
        return Result::success(null, $auditStatus === 1 ? '审核通过,进入打款中' : '提现申请已驳回');
    }

    /** 确认打款结果:payStatus 1成功(1→2,落支出流水) 2失败(1→4,必填原因) */
    #[Permission('finance:msettle:pay')]
    public function confirmPay(): array
    {
        $withdraw = $this->findScoped($this->requireId());
        if ((int) $withdraw['status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅打款中的提现单可确认打款结果');
        }
        $payStatus = $this->intInput('payStatus');
        if (! in_array($payStatus, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 payStatus 不正确');
        }
        if ($payStatus === 2) {
            $reason = $this->requireStr('failReason');
            Db::table('finance_withdraw')->where('id', $withdraw['id'])->update([
                'status' => 4,
                'audit_remark' => mb_substr("[打款失败]{$reason}", 0, 500),
            ]);
            return Result::success(null, '已标记打款失败');
        }
        $tradeNo = $this->strInput('tradeNo');
        Db::transaction(function () use ($withdraw, $tradeNo) {
            Db::table('finance_withdraw')->where('id', $withdraw['id'])->update([
                'status' => 2,
                'trade_no' => $tradeNo,
                'pay_time' => date('Y-m-d H:i:s'),
            ]);
            // 提现支出流水
            Db::table('finance_flow')->insert([
                'flow_no' => OrderNoGenerator::flowNo(),
                'site_id' => (int) $withdraw['site_id'],
                'flow_type' => 2,
                'biz_type' => 3,
                'amount' => (float) $withdraw['actual_amount'],
                'merchant_id' => (int) $withdraw['merchant_id'],
                'trade_no' => $tradeNo,
                'flow_status' => 1,
                'remark' => "提现单 {$withdraw['withdraw_no']} 打款",
                'operator_id' => AdminContext::adminId(),
            ]);
        });
        return Result::success(null, '打款完成,支出流水已记录');
    }

    /** 取提现单并校验站点数据权限 */
    private function findScoped(int $id): array
    {
        $withdraw = Db::table('finance_withdraw')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $withdraw) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '提现单不存在');
        }
        $withdraw = (array) $withdraw;
        $this->assertSiteScope((int) $withdraw['site_id']);
        return $withdraw;
    }
}
