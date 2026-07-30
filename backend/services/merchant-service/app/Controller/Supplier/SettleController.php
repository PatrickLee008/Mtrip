<?php

declare(strict_types=1);

namespace App\Controller\Supplier;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\SupplierContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 供应商端对账结算查看:仅只读本供应商(supplier_id)的结算账单
 * 结算单由平台生成/审核/回款,供应商侧仅查看进度。
 * 状态:0待审核 1已审核 2已回款 3已驳回
 */
class SettleController extends AbstractController
{
    /** 结算账单列表:筛选 账期/单号/状态 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('supplier_settle')
            ->where('supplier_id', SupplierContext::supplierId())->whereNull('deleted_at');
        if (($month = $this->strInput('settleMonth')) !== '') {
            $query->where('settle_month', $month);
        }
        if (($settleNo = $this->strInput('settleNo')) !== '') {
            $query->where('settle_no', $settleNo);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static function ($row) {
                $row = (array) $row;
                unset($row['deleted_at'], $row['audit_by']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 结算账单详情 */
    public function detail(): array
    {
        $settle = Db::table('supplier_settle')->where('id', $this->requireId())
            ->where('supplier_id', SupplierContext::supplierId())
            ->whereNull('deleted_at')->first();
        if (! $settle) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '结算账单不存在或无权查看');
        }
        $settle = (array) $settle;
        unset($settle['deleted_at'], $settle['audit_by']);
        return Result::success(['settle' => $settle]);
    }
}
