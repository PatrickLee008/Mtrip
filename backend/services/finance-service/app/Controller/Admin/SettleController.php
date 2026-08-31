<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户结算单管理(文档 6.4.5)
 * 状态机:0待确认 →(确认)1已确认 →(打款)2已打款;0→(争议)3有争议 →(处理后)0
 * 结算单按周期自动生成归模块08 定时任务;本期支持查询与状态流转
 */
class SettleController extends AbstractController
{
    /** 结算单列表:筛选 结算单号/商户/周期/状态 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('finance_merchant_settle')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($settleNo = $this->strInput('settleNo')) !== '') {
            $query->where('settle_no', $settleNo);
        }
        if (($merchantId = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $merchantId);
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
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 结算单详情 */
    public function detail(): array
    {
        $settle = $this->findScoped($this->requireId());
        unset($settle['deleted_at']);
        return Result::success($settle);
    }

    /** 确认结算单:0待确认 → 1已确认 */
    #[Permission('finance:msettle:confirm')]
    public function confirm(): array
    {
        $settle = $this->findScoped($this->requireId());
        if ((int) $settle['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待确认结算单可确认');
        }
        Db::table('finance_merchant_settle')->where('id', $settle['id'])->update([
            'status' => 1,
            'confirm_by' => AdminContext::adminId(),
            'confirm_time' => date('Y-m-d H:i:s'),
        ]);
        return Result::success(null, '结算单已确认');
    }

    /** 标记打款:1已确认 → 2已打款(可传打款凭证) */
    #[Permission('finance:msettle:pay')]
    public function markPaid(): array
    {
        $settle = $this->findScoped($this->requireId());
        if ((int) $settle['status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已确认结算单可标记打款');
        }
        Db::table('finance_merchant_settle')->where('id', $settle['id'])->update([
            'status' => 2,
            'pay_time' => date('Y-m-d H:i:s'),
            'pay_voucher' => $this->strInput('payVoucher'),
        ]);
        return Result::success(null, '结算单已标记打款');
    }

    /** 标记争议 / 解除争议:0→3(必填说明);3→0(争议处理完毕重新待确认) */
    #[Permission('finance:msettle:confirm')]
    public function dispute(): array
    {
        $settle = $this->findScoped($this->requireId());
        $status = (int) $settle['status'];
        if ($status === 0) {
            $remark = $this->requireStr('remark');
            Db::table('finance_merchant_settle')->where('id', $settle['id'])->update([
                'status' => 3,
                'remark' => mb_substr($remark, 0, 500),
            ]);
            return Result::success(null, '结算单已标记争议');
        }
        if ($status === 3) {
            Db::table('finance_merchant_settle')->where('id', $settle['id'])->update([
                'status' => 0,
                'remark' => mb_substr($this->strInput('remark'), 0, 500),
            ]);
            return Result::success(null, '争议已解除,结算单重新待确认');
        }
        throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待确认/有争议结算单可操作');
    }

    /** 取结算单并校验站点数据权限 */
    private function findScoped(int $id): array
    {
        $settle = Db::table('finance_merchant_settle')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $settle) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '结算单不存在');
        }
        $settle = (array) $settle;
        $this->assertSiteScope((int) $settle['site_id']);
        return $settle;
    }
}
