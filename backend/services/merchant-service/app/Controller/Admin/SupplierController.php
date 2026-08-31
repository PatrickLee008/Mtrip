<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

/**
 * 供应商管理(文档 6.4.3):档案 CRUD / 审核 / 暂停恢复 / 终止 / 供货商品 / 结算账单
 * 状态机:0待审核 →(审核通过)1已合作 /(驳回)3已终止
 *        1已合作 ⇄ 2已暂停;3已终止(终态)
 * 结算单:0待审核 → 1已审核 → 2已回款;0 → 3已驳回
 */
class SupplierController extends AbstractController
{
    /** 供应商列表:筛选 名称/类型/状态/结算方式,联系电话脱敏 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('supplier_info')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($name = $this->strInput('supplierName')) !== '') {
            $query->where('supplier_name', 'like', "%{$name}%");
        }
        if (($type = $this->intInput('supplierType')) > 0) {
            $query->where('supplier_type', $type);
        }
        if (($settleType = $this->intInput('settleType')) > 0) {
            $query->where('settle_type', $settleType);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $row['contact_phone']));
                $row['account_no'] = MaskHelper::bankCard($this->decryptField((string) $row['account_no']));
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 供应商详情:含供货商品数;敏感字段脱敏(超管可见明文手机号) */
    public function detail(): array
    {
        $supplier = $this->findScoped($this->requireId());
        $phone = $this->decryptField((string) $supplier['contact_phone']);
        $supplier['contact_phone'] = AdminContext::isSuper() ? $phone : MaskHelper::mobile($phone);
        $supplier['account_no'] = MaskHelper::bankCard($this->decryptField((string) $supplier['account_no']));
        unset($supplier['deleted_at']);

        $goodsCount = Db::table('supplier_goods')
            ->where('supplier_id', $supplier['id'])->whereNull('deleted_at')->count();
        $supplyingCount = Db::table('supplier_goods')
            ->where('supplier_id', $supplier['id'])->where('status', 1)
            ->whereNull('deleted_at')->count();

        return Result::success([
            'supplier' => $supplier,
            'goodsCount' => $goodsCount,
            'supplyingCount' => $supplyingCount,
        ]);
    }

    /** 新增供应商(进入待审核);信用代码全局唯一 */
    #[Permission('supplier:list:add')]
    public function create(): array
    {
        $creditCode = strtoupper($this->requireStr('creditCode'));
        if (Db::table('supplier_info')->where('credit_code', $creditCode)->whereNull('deleted_at')->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该统一社会信用代码已存在');
        }
        $siteId = AdminContext::isSuper() ? $this->requireId('siteId') : AdminContext::siteId();
        $data = $this->collectFields();
        $data['site_id'] = $siteId;
        $data['supplier_name'] = $this->requireStr('supplierName');
        $data['credit_code'] = $creditCode;
        $data['contact_name'] = $this->requireStr('contactName');
        $data['contact_phone'] = $this->encryptField($this->requireStr('contactPhone'));
        $data['status'] = 0;
        $id = (int) Db::table('supplier_info')->insertGetId($data);
        return Result::success(['id' => $id], '供应商创建成功,待审核');
    }

    /** 编辑供应商:已终止不可编辑 */
    #[Permission('supplier:list:edit')]
    public function update(): array
    {
        $supplier = $this->findScoped($this->requireId());
        if ((int) $supplier['status'] === 3) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已终止供应商不可编辑');
        }
        $data = $this->collectFields();
        if (($name = $this->strInput('supplierName')) !== '') {
            $data['supplier_name'] = $name;
        }
        if (($contact = $this->strInput('contactName')) !== '') {
            $data['contact_name'] = $contact;
        }
        if (($phone = $this->strInput('contactPhone')) !== '') {
            $data['contact_phone'] = $this->encryptField($phone);
        }
        if ($data === []) {
            return Result::success(null, '无可更新内容');
        }
        Db::table('supplier_info')->where('id', $supplier['id'])->update($data);
        return Result::success(null, '供应商更新成功');
    }

    /** 审核:auditStatus 1通过(转已合作,记合作开始时间) 2驳回(转已终止,必填原因) */
    #[Permission('supplier:list:edit')]
    public function audit(): array
    {
        $supplier = $this->findScoped($this->requireId());
        if ((int) $supplier['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核供应商可审核');
        }
        $auditStatus = $this->intInput('auditStatus');
        $remark = $this->strInput('auditRemark');
        if ($auditStatus === 1) {
            Db::table('supplier_info')->where('id', $supplier['id'])->update([
                'status' => 1,
                'coop_start_at' => date('Y-m-d H:i:s'),
                'remark' => $remark !== '' ? mb_substr($remark, 0, 500) : $supplier['remark'],
            ]);
            return Result::success(null, '审核通过,已建立合作');
        }
        if ($auditStatus === 2) {
            if ($remark === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '驳回必须填写原因');
            }
            Db::table('supplier_info')->where('id', $supplier['id'])->update([
                'status' => 3,
                'remark' => mb_substr('审核驳回:' . $remark, 0, 500),
            ]);
            return Result::success(null, '已驳回并终止合作');
        }
        throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 auditStatus 不正确');
    }

    /** 暂停/恢复:1已合作 ⇄ 2已暂停;暂停联动停供全部供货商品 */
    #[Permission('supplier:list:status')]
    public function toggleStatus(): array
    {
        $supplier = $this->findScoped($this->requireId());
        $status = (int) $supplier['status'];
        if (! in_array($status, [1, 2], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已合作/已暂停供应商可切换状态');
        }
        $pause = $status === 1;
        $stopCount = (int) Db::transaction(static function () use ($supplier, $pause) {
            Db::table('supplier_info')->where('id', $supplier['id'])
                ->update(['status' => $pause ? 2 : 1]);
            if (! $pause) {
                return 0;
            }
            return Db::table('supplier_goods')
                ->where('supplier_id', $supplier['id'])->where('status', 1)
                ->whereNull('deleted_at')
                ->update(['status' => 2]);
        });
        $message = $pause ? "供应商已暂停,联动停供 {$stopCount} 个商品" : '供应商已恢复合作';
        return Result::success(['status' => $pause ? 2 : 1, 'stopGoods' => $stopCount], $message);
    }

    /** 终止合作(终态,必填备注):停供全部商品,记合作结束时间;存在未回款账单禁止 */
    #[Permission('supplier:list:delete')]
    public function terminate(): array
    {
        $supplier = $this->findScoped($this->requireId());
        if ((int) $supplier['status'] === 3) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '供应商已终止合作');
        }
        $remark = $this->requireStr('remark');
        $unsettled = Db::table('supplier_settle')
            ->where('supplier_id', $supplier['id'])
            ->whereIn('status', [0, 1])
            ->whereNull('deleted_at')->count();
        if ($unsettled > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "存在 {$unsettled} 张未回款结算账单,禁止终止");
        }
        $stopCount = (int) Db::transaction(static function () use ($supplier, $remark) {
            Db::table('supplier_info')->where('id', $supplier['id'])->update([
                'status' => 3,
                'coop_end_at' => date('Y-m-d H:i:s'),
                'remark' => mb_substr($remark, 0, 500),
            ]);
            return Db::table('supplier_goods')
                ->where('supplier_id', $supplier['id'])->where('status', 1)
                ->whereNull('deleted_at')
                ->update(['status' => 2]);
        });
        return Result::success(['stopGoods' => $stopCount], '已终止合作');
    }

    /** 供货商品列表:筛选 名称/类型/状态 */
    public function goodsList(): array
    {
        $supplier = $this->findScoped($this->requireId('supplierId'));
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('supplier_goods')
            ->where('supplier_id', $supplier['id'])->whereNull('deleted_at');
        if (($name = $this->strInput('goodsName')) !== '') {
            $query->where('goods_name', 'like', "%{$name}%");
        }
        if (($type = $this->intInput('goodsType')) > 0) {
            $query->where('goods_type', $type);
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
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

    /** 新增供货商品(仅已合作供应商) */
    #[Permission('supplier:goods:list')]
    public function goodsAdd(): array
    {
        $supplier = $this->findScoped($this->requireId('supplierId'));
        if ((int) $supplier['status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已合作供应商可添加供货商品');
        }
        $goodsType = $this->intInput('goodsType', 1);
        if (! in_array($goodsType, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 goodsType 不正确');
        }
        [$supplyPrice, $retailPrice] = $this->validatePrices();
        $id = (int) Db::table('supplier_goods')->insertGetId([
            'site_id' => (int) $supplier['site_id'],
            'supplier_id' => (int) $supplier['id'],
            'goods_id' => $this->intInput('goodsId'),
            'goods_name' => $this->requireStr('goodsName'),
            'goods_type' => $goodsType,
            'supply_price' => $supplyPrice,
            'retail_price' => $retailPrice,
            'sync_type' => $this->validSyncType(),
            'status' => 1,
            'remark' => mb_substr($this->strInput('remark'), 0, 255),
        ]);
        return Result::success(['id' => $id], '供货商品已添加');
    }

    /** 编辑供货商品:名称/价格/同步方式/供货状态 */
    #[Permission('supplier:goods:list')]
    public function goodsUpdate(): array
    {
        $row = $this->findGoodsScoped($this->requireId());
        $data = [];
        if (($name = $this->strInput('goodsName')) !== '') {
            $data['goods_name'] = $name;
        }
        if ($this->input('supplyPrice') !== null || $this->input('retailPrice') !== null) {
            [$data['supply_price'], $data['retail_price']] = $this->validatePrices(
                $this->floatInput('supplyPrice', (float) $row['supply_price']),
                $this->floatInput('retailPrice', (float) $row['retail_price'])
            );
        }
        if ($this->input('syncType') !== null) {
            $data['sync_type'] = $this->validSyncType();
        }
        if (($status = $this->intInput('status')) > 0 && in_array($status, [1, 2], true)) {
            $data['status'] = $status;
        }
        if ($this->input('goodsId') !== null) {
            $data['goods_id'] = $this->intInput('goodsId');
        }
        if ($this->input('remark') !== null) {
            $data['remark'] = mb_substr($this->strInput('remark'), 0, 255);
        }
        if ($data === []) {
            return Result::success(null, '无可更新内容');
        }
        Db::table('supplier_goods')->where('id', $row['id'])->update($data);
        return Result::success(null, '供货商品已更新');
    }

    /** 删除供货商品(软删) */
    #[Permission('supplier:goods:list')]
    public function goodsDelete(): array
    {
        $row = $this->findGoodsScoped($this->requireId());
        Db::table('supplier_goods')->where('id', $row['id'])
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '供货商品已删除');
    }

    /** 结算账单列表:筛选 供应商/账期/状态,附带供应商名称 */
    public function settleList(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('supplier_settle')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($supplierId = $this->intInput('supplierId')) > 0) {
            $query->where('supplier_id', $supplierId);
        }
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
        $rows = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($row) => (array) $row)->all();

        $supplierIds = array_values(array_unique(array_column($rows, 'supplier_id')));
        $names = $supplierIds === [] ? [] : Db::table('supplier_info')
            ->whereIn('id', $supplierIds)->pluck('supplier_name', 'id')->all();
        $list = array_map(static function (array $row) use ($names) {
            $row['supplier_name'] = (string) ($names[$row['supplier_id']] ?? '');
            unset($row['deleted_at']);
            return $row;
        }, $rows);
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 结算账单审核:auditStatus 1通过(待回款) 2驳回(必填原因) */
    #[Permission(['supplier:settle:confirm', 'finance:ssettle:confirm'])]
    public function settleAudit(): array
    {
        $settle = $this->findSettleScoped($this->requireId());
        if ((int) $settle['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核账单可审核');
        }
        $auditStatus = $this->intInput('auditStatus');
        $remark = $this->strInput('auditRemark');
        if (! in_array($auditStatus, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 auditStatus 不正确');
        }
        if ($auditStatus === 2 && $remark === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '驳回必须填写原因');
        }
        Db::table('supplier_settle')->where('id', $settle['id'])->update([
            'status' => $auditStatus === 1 ? 1 : 3,
            'audit_by' => AdminContext::adminId(),
            'audit_time' => date('Y-m-d H:i:s'),
            'remark' => $remark !== '' ? mb_substr($remark, 0, 500) : $settle['remark'],
        ]);
        return Result::success(null, $auditStatus === 1 ? '账单审核通过,待回款' : '账单已驳回');
    }

    /** 确认回款:已审核账单登记回款时间与凭证 */
    #[Permission(['supplier:settle:pay', 'finance:ssettle:pay'])]
    public function settleConfirmPay(): array
    {
        $settle = $this->findSettleScoped($this->requireId());
        if ((int) $settle['status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已审核账单可确认回款');
        }
        Db::table('supplier_settle')->where('id', $settle['id'])->update([
            'status' => 2,
            'pay_time' => date('Y-m-d H:i:s'),
            'pay_voucher' => $this->strInput('payVoucher'),
        ]);
        return Result::success(null, '已确认回款');
    }

    /** 取供应商并校验站点数据权限 */
    private function findScoped(int $id): array
    {
        $supplier = Db::table('supplier_info')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $supplier) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '供应商不存在');
        }
        $supplier = (array) $supplier;
        $this->assertSiteScope((int) $supplier['site_id']);
        return $supplier;
    }

    /** 取供货商品并校验站点数据权限 */
    private function findGoodsScoped(int $id): array
    {
        $row = Db::table('supplier_goods')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '供货商品不存在');
        }
        $row = (array) $row;
        $this->assertSiteScope((int) $row['site_id']);
        return $row;
    }

    /** 取结算账单并校验站点数据权限 */
    private function findSettleScoped(int $id): array
    {
        $settle = Db::table('supplier_settle')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $settle) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '结算账单不存在');
        }
        $settle = (array) $settle;
        $this->assertSiteScope((int) $settle['site_id']);
        return $settle;
    }

    /** 校验供货价/零售价:非负且底价不高于零售价 */
    private function validatePrices(?float $supply = null, ?float $retail = null): array
    {
        $supply ??= $this->floatInput('supplyPrice', -1);
        $retail ??= $this->floatInput('retailPrice', -1);
        if ($supply < 0 || $retail < 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '供货价/零售价不能为负');
        }
        if ($retail > 0 && $supply > $retail) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '供货底价不能高于建议零售价');
        }
        return [round($supply, 2), round($retail, 2)];
    }

    /** 校验库存同步方式:1API实时 2手动导入 3定时同步 */
    private function validSyncType(): int
    {
        $syncType = $this->intInput('syncType', 2);
        if (! in_array($syncType, [1, 2, 3], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 syncType 不正确');
        }
        return $syncType;
    }

    /** 收集可选编辑字段(snake_case 列 ← 驼峰入参) */
    private function collectFields(): array
    {
        $data = [];
        $map = [
            'supplier_short_name' => 'supplierShortName',
            'business_license' => 'businessLicense',
            'contact_email' => 'contactEmail',
            'bank_name' => 'bankName',
            'account_name' => 'accountName',
            'contract_file' => 'contractFile',
            'remark' => 'remark',
        ];
        foreach ($map as $column => $param) {
            $value = $this->input($param);
            if ($value !== null) {
                $data[$column] = trim((string) $value);
            }
        }
        if (($type = $this->intInput('supplierType')) > 0 && in_array($type, [1, 2, 3], true)) {
            $data['supplier_type'] = $type;
        }
        if (($settleType = $this->intInput('settleType')) > 0 && in_array($settleType, [1, 2, 3], true)) {
            $data['settle_type'] = $settleType;
        }
        if ($this->input('shareRate') !== null) {
            $rate = $this->floatInput('shareRate', -1);
            if ($rate < 0 || $rate > 100) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '分成比例须为 0-100');
            }
            $data['share_rate'] = $rate;
        }
        if (($accountNo = $this->strInput('accountNo')) !== '') {
            $data['account_no'] = $this->encryptField($accountNo);
        }
        return $data;
    }
}
