<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\MerchantService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

/**
 * 商户管理(文档 6.4.2,11 接口)
 * 状态机:0待审核 →(审核通过)3已启用 /(驳回)2审核驳回(编辑后重提)
 *        3已启用 ⇄ 4已禁用(禁用联动下架在售商品);5已注销(终态)
 */
class MerchantController extends AbstractController
{
    #[Inject]
    protected MerchantService $service;

    /** 商户列表:筛选 商户名称/类型/状态,联系电话脱敏 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_info')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($name = $this->strInput('merchantName')) !== '') {
            $query->where('merchant_name', 'like', "%{$name}%");
        }
        if (($type = $this->intInput('merchantType')) > 0) {
            $query->where('merchant_type', $type);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        // 集团维度筛选:groupId(含0=独立商户) / unboundOnly=1(仅未绑集团且已启用/禁用,供集团绑定选择器使用)
        $groupId = $this->input('groupId');
        if ($groupId !== null && $groupId !== '') {
            $query->where('group_id', (int) $groupId);
        }
        if ($this->intInput('unboundOnly') === 1) {
            $query->where('group_id', 0)->whereIn('status', [3, 4]);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $row['contact_phone']));
                unset($row['legal_id_card'], $row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 商户详情:含结算账户与主账号;敏感字段脱敏(超管可见明文手机号) */
    public function detail(): array
    {
        $merchant = $this->findScoped($this->requireId());
        $phone = $this->decryptField((string) $merchant['contact_phone']);
        $merchant['contact_phone'] = AdminContext::isSuper() ? $phone : MaskHelper::mobile($phone);
        $merchant['legal_id_card'] = MaskHelper::idCard($this->decryptField((string) $merchant['legal_id_card']));
        $merchant['legal_id_images'] = $this->jsonDecode($merchant['legal_id_images']);
        unset($merchant['deleted_at']);

        $accounts = Db::table('merchant_account')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')
            ->orderByDesc('is_default')->orderBy('id')->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['account_no'] = MaskHelper::bankCard($this->decryptField((string) $row['account_no']));
                unset($row['deleted_at']);
                return $row;
            })->all();
        $admins = Db::table('merchant_admin')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')
            ->get(['id', 'username', 'real_name', 'is_owner', 'status', 'last_login_at', 'created_at'])
            ->map(static fn ($row) => (array) $row)->all();

        return Result::success([
            'merchant' => $merchant,
            'accounts' => $accounts,
            'admins' => $admins,
        ]);
    }

    /** 新增商户(平台代录入,进入待审核) */
    #[Permission('merchant:list:add')]
    public function create(): array
    {
        $creditCode = strtoupper($this->requireStr('creditCode'));
        if (Db::table('merchant_info')->where('credit_code', $creditCode)->whereNull('deleted_at')->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该统一社会信用代码已存在');
        }
        $siteId = AdminContext::isSuper() ? $this->requireId('siteId') : AdminContext::siteId();
        $data = $this->collectFields();
        $data['site_id'] = $siteId;
        $data['merchant_name'] = $this->requireStr('merchantName');
        $data['credit_code'] = $creditCode;
        $data['legal_person'] = $this->requireStr('legalPerson');
        $data['contact_name'] = $this->requireStr('contactName');
        $data['contact_phone'] = $this->encryptField($this->requireStr('contactPhone'));
        $data['status'] = 0;
        $id = (int) Db::table('merchant_info')->insertGetId($data);
        return Result::success(['id' => $id], '商户创建成功,待审核');
    }

    /** 编辑商户:驳回状态编辑后自动重新提交审核 */
    #[Permission('merchant:list:edit')]
    public function update(): array
    {
        $merchant = $this->findScoped($this->requireId());
        if ((int) $merchant['status'] === 5) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已注销商户不可编辑');
        }
        $data = $this->collectFields();
        if (($name = $this->strInput('merchantName')) !== '') {
            $data['merchant_name'] = $name;
        }
        if (($legal = $this->strInput('legalPerson')) !== '') {
            $data['legal_person'] = $legal;
        }
        if (($contact = $this->strInput('contactName')) !== '') {
            $data['contact_name'] = $contact;
        }
        if (($phone = $this->strInput('contactPhone')) !== '') {
            $data['contact_phone'] = $this->encryptField($phone);
        }
        // 驳回后编辑 → 重新进入待审核(可重提)
        if ((int) $merchant['status'] === 2) {
            $data['status'] = 0;
            $data['audit_remark'] = '';
        }
        Db::table('merchant_info')->where('id', $merchant['id'])->update($data);
        return Result::success(null, (int) $merchant['status'] === 2 ? '已重新提交审核' : '商户更新成功');
    }

    /** 审核:auditStatus 1通过(生成商户主账号并启用) 2驳回(必填原因) */
    #[Permission('merchant:list:audit')]
    public function audit(): array
    {
        $merchant = $this->findScoped($this->requireId());
        if ((int) $merchant['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核商户可审核');
        }
        $auditStatus = $this->intInput('auditStatus');
        $remark = $this->strInput('auditRemark');
        if ($auditStatus === 1) {
            $account = $this->service->approve($merchant, $remark);
            return Result::success($account, '审核通过,商户账号已生成');
        }
        if ($auditStatus === 2) {
            if ($remark === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '驳回必须填写原因');
            }
            $this->service->reject($merchant, $remark);
            return Result::success(null, '已驳回,商户可修改后重新提交');
        }
        throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 auditStatus 不正确');
    }

    /** 启停:3已启用 ⇄ 4已禁用;禁用联动下架该商户全部在售商品 */
    #[Permission('merchant:list:status')]
    public function toggleStatus(): array
    {
        $merchant = $this->findScoped($this->requireId());
        $status = (int) $merchant['status'];
        if (! in_array($status, [3, 4], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已启用/已禁用商户可切换状态');
        }
        $offCount = $this->service->toggle($merchant);
        $enabled = $status === 4;
        $message = $enabled ? '商户已启用' : "商户已禁用,联动下架 {$offCount} 个在售商品";
        return Result::success(['status' => $enabled ? 3 : 4, 'offGoods' => $offCount], $message);
    }

    /** 设置抽佣比例与结算周期 */
    #[Permission('merchant:list:edit')]
    public function commission(): array
    {
        $merchant = $this->findScoped($this->requireId());
        $rate = $this->floatInput('commissionRate', -1);
        if ($rate < 0 || $rate > 100) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '抽佣比例须为 0-100');
        }
        $cycle = $this->intInput('settlementCycle', (int) $merchant['settlement_cycle']);
        if (! in_array($cycle, [7, 15, 30], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '结算周期仅支持 T+7 / T+15 / 30(月结)');
        }
        Db::table('merchant_info')->where('id', $merchant['id'])->update([
            'commission_rate' => $rate,
            'settlement_cycle' => $cycle,
        ]);
        return Result::success(null, '佣金设置已更新');
    }

    /** 结算账户列表(账号脱敏) */
    public function accounts(): array
    {
        $merchant = $this->findScoped($this->requireId('merchantId'));
        $list = Db::table('merchant_account')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')
            ->orderByDesc('is_default')->orderBy('id')->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['account_no'] = MaskHelper::bankCard($this->decryptField((string) $row['account_no']));
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::success($list);
    }

    /** 保存结算账户:带 id 编辑(账号留空=保留原值),不带 id 新增;isDefault=1 互斥置默认 */
    #[Permission('merchant:account:edit')]
    public function saveAccount(): array
    {
        $merchant = $this->findScoped($this->requireId('merchantId'));
        $accountId = $this->intInput('id');
        $accountNo = $this->strInput('accountNo');
        $data = [
            'bank_name' => $this->requireStr('bankName'),
            'account_name' => $this->requireStr('accountName'),
            'swift_code' => strtoupper($this->strInput('swiftCode')),
            'currency' => strtoupper($this->strInput('currency', 'EUR')),
            'remark' => mb_substr($this->strInput('remark'), 0, 255),
        ];
        $isDefault = $this->intInput('isDefault') === 1;

        Db::transaction(function () use ($merchant, $accountId, $accountNo, $data, $isDefault) {
            if ($accountId > 0) {
                $exists = Db::table('merchant_account')
                    ->where('id', $accountId)->where('merchant_id', $merchant['id'])
                    ->whereNull('deleted_at')->exists();
                if (! $exists) {
                    throw new BusinessException(ErrorCode::NOT_FOUND, '结算账户不存在');
                }
                if ($accountNo !== '') {
                    $data['account_no'] = $this->encryptField($accountNo);
                }
                if ($isDefault) {
                    $data['is_default'] = 1;
                }
                Db::table('merchant_account')->where('id', $accountId)->update($data);
            } else {
                if ($accountNo === '') {
                    throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 accountNo 不能为空');
                }
                $data['site_id'] = (int) $merchant['site_id'];
                $data['merchant_id'] = (int) $merchant['id'];
                $data['account_no'] = $this->encryptField($accountNo);
                $data['is_default'] = $isDefault ? 1 : 0;
                $accountId = (int) Db::table('merchant_account')->insertGetId($data);
            }
            if ($isDefault) {
                Db::table('merchant_account')->where('merchant_id', $merchant['id'])
                    ->where('id', '<>', $accountId)->update(['is_default' => 0]);
            }
        });
        return Result::success(['id' => $accountId], '结算账户已保存');
    }

    /** 注销商户(终态,必填备注;存在进行中订单禁止) */
    #[Permission('merchant:list:delete')]
    public function close(): array
    {
        $merchant = $this->findScoped($this->requireId());
        if ((int) $merchant['status'] === 5) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '商户已注销');
        }
        $remark = $this->requireStr('remark');
        $pending = Db::table('order_main')
            ->where('merchant_id', $merchant['id'])
            ->whereIn('order_status', [0, 1, 5])
            ->whereNull('deleted_at')->count();
        if ($pending > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "存在 {$pending} 笔进行中订单,禁止注销");
        }
        $offCount = $this->service->close($merchant, $remark);
        return Result::success(['offGoods' => $offCount], '商户已注销');
    }

    /** 经营统计:订单数/销售额/退款额/待结算(默认近30天,可传 startDate/endDate) */
    public function statistics(): array
    {
        $merchant = $this->findScoped($this->requireId('merchantId'));
        $startDate = $this->strInput('startDate', date('Y-m-d', strtotime('-29 days')));
        $endDate = $this->strInput('endDate', date('Y-m-d'));
        $orderQuery = Db::table('order_main')
            ->where('merchant_id', $merchant['id'])
            ->whereBetween('created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->whereNull('deleted_at');

        $paid = (clone $orderQuery)->whereIn('order_status', [1, 2, 3]);
        $orderCount = (clone $orderQuery)->count();
        $paidCount = (clone $paid)->count();
        $salesAmount = (float) (clone $paid)->sum('pay_amount');
        $commission = (float) (clone $paid)->sum('platform_commission');
        $refundAmount = (float) Db::table('order_refund')
            ->where('merchant_id', $merchant['id'])->where('status', 3)
            ->whereBetween('created_at', ["{$startDate} 00:00:00", "{$endDate} 23:59:59"])
            ->sum('refund_amount');
        $goodsCount = Db::table('goods_info')
            ->where('merchant_id', $merchant['id'])->where('status', 3)
            ->whereNull('deleted_at')->count();

        return Result::success([
            'startDate' => $startDate,
            'endDate' => $endDate,
            'orderCount' => $orderCount,
            'paidCount' => $paidCount,
            'salesAmount' => round($salesAmount, 2),
            'commission' => round($commission, 2),
            'refundAmount' => round($refundAmount, 2),
            'merchantReceivable' => round($salesAmount - $commission - $refundAmount, 2),
            'onSaleGoods' => $goodsCount,
        ]);
    }

    /** 对账单:商户结算单分页(finance_merchant_settle) */
    public function statement(): array
    {
        $merchant = $this->findScoped($this->requireId('merchantId'));
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('finance_merchant_settle')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at');
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

    /** 取商户并校验站点数据权限 */
    private function findScoped(int $id): array
    {
        $merchant = Db::table('merchant_info')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $merchant) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商户不存在');
        }
        $merchant = (array) $merchant;
        $this->assertSiteScope((int) $merchant['site_id']);
        return $merchant;
    }

    /** 收集可选编辑字段(snake_case 列 ← 驼峰入参) */
    private function collectFields(): array
    {
        $data = [];
        $map = [
            'merchant_short_name' => 'merchantShortName',
            'business_license' => 'businessLicense',
            'contact_email' => 'contactEmail',
            'address' => 'address',
            'logo' => 'logo',
            'cover_image' => 'coverImage',
            'remark' => 'remark',
        ];
        foreach ($map as $column => $param) {
            $value = $this->input($param);
            if ($value !== null) {
                $data[$column] = trim((string) $value);
            }
        }
        if (($type = $this->intInput('merchantType')) > 0 && in_array($type, [1, 2, 3], true)) {
            $data['merchant_type'] = $type;
        }
        if (($idCard = $this->strInput('legalIdCard')) !== '') {
            $data['legal_id_card'] = $this->encryptField($idCard);
        }
        $idImages = $this->input('legalIdImages');
        if (is_array($idImages)) {
            $data['legal_id_images'] = json_encode($idImages, JSON_UNESCAPED_UNICODE);
        }
        if ($this->input('longitude') !== null) {
            $data['longitude'] = $this->floatInput('longitude');
        }
        if ($this->input('latitude') !== null) {
            $data['latitude'] = $this->floatInput('latitude');
        }
        return $data;
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
