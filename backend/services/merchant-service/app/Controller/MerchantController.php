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

        // 账户安全字段(整改 A3/B3,2FA 字段来自 10-merchant-account-security.sql)
        $merchant['two_fa_enabled'] = (int) ($merchant['two_fa_enabled'] ?? 0);
        $merchant['two_fa_method'] = (string) ($merchant['two_fa_method'] ?? '');
        $merchant['two_fa_enrolled_at'] = $merchant['two_fa_enrolled_at'] ?? null;
        $merchant['two_fa_last_reset_at'] = $merchant['two_fa_last_reset_at'] ?? null;
        $merchant['two_fa_status'] = (int) ($merchant['two_fa_status'] ?? 0);
        $merchant['access_status'] = (int) ($merchant['access_status'] ?? 0);

        // 月度绩效(原型 Monthly Performance:Revenue MTD / Bookings MTD,口径与 statistics 一致)
        $monthStart = date('Y-m-01 00:00:00');
        $orderQuery = Db::table('order_main')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at');
        $paid = (clone $orderQuery)->whereIn('order_status', [1, 2, 3]);
        $merchant['revenue_mtd'] = round((float) (clone $paid)->where('created_at', '>=', $monthStart)->sum('pay_amount'), 2);
        $merchant['bookings_mtd'] = (int) (clone $paid)->where('created_at', '>=', $monthStart)->count();

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
            ->get(['id', 'username', 'real_name', 'account_type', 'store_id', 'is_owner', 'status', 'last_login_at', 'created_at'])
            ->map(static fn ($row) => (array) $row)->all();

        return Result::success([
            'merchant' => $merchant,
            'accounts' => $accounts,
            'admins' => $admins,
        ]);
    }

    /**
     * 暂停商户(整改 A4,原型 Suspend Merchant):阻止新预订,不影响已确认订单
     * status 3已启用 → 4已禁用(=Suspended);必填原因;写活动日志
     */
    #[Permission('merchant:list:status')]
    public function suspend(): array
    {
        $merchant = $this->findScoped($this->requireId());
        if ((int) $merchant['status'] !== 3) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已启用商户可暂停');
        }
        $reason = $this->requireStr('reason');
        Db::table('merchant_info')->where('id', $merchant['id'])->update([
            'status' => 4,
            'audit_remark' => mb_substr($reason, 0, 500),
            'audit_by' => AdminContext::adminId(),
            'audit_time' => date('Y-m-d H:i:s'),
        ]);
        $this->pushActivityLog($merchant, 'suspension', '商户暂停:' . $reason);
        return Result::success(null, '商户已暂停,新预订已阻止(已确认订单不受影响)');
    }

    /** 恢复商户(整改 A4,原型 Reactivate):Suspended → Active */
    #[Permission('merchant:list:status')]
    public function activate(): array
    {
        $merchant = $this->findScoped($this->requireId());
        if ((int) $merchant['status'] !== 4) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已暂停商户可恢复');
        }
        Db::table('merchant_info')->where('id', $merchant['id'])->update([
            'status' => 3,
            'audit_by' => AdminContext::adminId(),
            'audit_time' => date('Y-m-d H:i:s'),
        ]);
        $this->pushActivityLog($merchant, 'reactivation', '商户恢复启用');
        return Result::success(null, '商户已恢复启用');
    }

    /**
     * 重置商户 2FA(PRD 模块 12 账户安全):置 two_fa_status=需要重置、失效现有绑定、
     * 生成新设置密钥(加密存储,供商户下次登录注册流程消费);管理端不展示二维码/密钥
     */
    #[Permission('merchant:list:2fa')]
    public function resetTwoFa(): array
    {
        $merchant = $this->findScoped($this->requireId());
        Db::table('merchant_info')->where('id', $merchant['id'])->update([
            'two_fa_enabled' => 0,
            'two_fa_method' => '',
            'two_fa_status' => 2,
            'two_fa_secret_enc' => $this->encryptField($this->generateBase32Secret()),
            'two_fa_last_reset_at' => date('Y-m-d H:i:s'),
        ]);
        $this->pushActivityLog($merchant, 'profile_update', '重置商户 2FA(需重新注册 Google Authenticator)');
        return Result::success(null, '2FA 已重置,商户下次登录需重新注册 Google Authenticator');
    }

    /**
     * 开始代入会话(整改 B2,原型 Start Impersonation Session):
     * 原因必选(4 类预置 + Other),全程审计;同商户同操作人仅允许一个进行中会话
     */
    #[Permission('merchant:list:impersonate')]
    public function impersonateStart(): array
    {
        $merchant = $this->findScoped($this->requireId('merchantId'));
        if ((int) $merchant['status'] === 5) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已注销商户不可代入');
        }
        $reason = $this->strInput('reason');
        if (! in_array($reason, ['technical_support', 'booking_investigation', 'payment_investigation', 'customer_complaint', 'other'], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择代入原因');
        }
        $active = Db::table('merchant_impersonation_session')
            ->where('merchant_id', $merchant['id'])
            ->where('operator_id', AdminContext::adminId())
            ->where('status', 1)->exists();
        if ($active) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该商户存在进行中的代入会话');
        }
        $sessionKey = 'IMP-' . strtoupper(substr(bin2hex(random_bytes(6)), 0, 8)) . '-' . time();
        $sessionId = Db::table('merchant_impersonation_session')->insertGetId([
            'site_id' => (int) $merchant['site_id'],
            'merchant_id' => (int) $merchant['id'],
            'operator_id' => AdminContext::adminId(),
            'operator_name' => AdminContext::adminName(),
            'reason' => $reason,
            'session_key' => $sessionKey,
            'status' => 1,
        ]);
        $this->pushActivityLog($merchant, 'impersonation', '代入会话开始:' . $reason);
        return Result::success(['session_id' => $sessionId, 'session_key' => $sessionKey], '代入会话已开始,所有操作将记录审计');
    }

    /** 结束代入会话(整改 B2):结束该商户所有进行中会话,写 end 审计 */
    #[Permission('merchant:list:impersonate')]
    public function impersonateEnd(): array
    {
        $merchantId = $this->intInput('merchantId');
        if ($merchantId <= 0) {
            $merchantId = $this->requireId('id');
        }
        $merchant = $this->findScoped($merchantId);
        $updated = Db::table('merchant_impersonation_session')
            ->where('merchant_id', $merchant['id'])->where('status', 1)
            ->update(['status' => 2, 'ended_at' => date('Y-m-d H:i:s')]);
        if ($updated <= 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '没有进行中的代入会话');
        }
        $this->pushActivityLog($merchant, 'impersonation', '代入会话结束');
        return Result::success(null, '代入会话已结束');
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
        // 驳回(2)/待重新提交(6)后编辑 → 重新进入待审核(可重提)
        $resubmit = in_array((int) $merchant['status'], [2, 6], true);
        if ($resubmit) {
            $data['status'] = 0;
            $data['audit_remark'] = '';
        }
        Db::table('merchant_info')->where('id', $merchant['id'])->update($data);
        return Result::success(null, $resubmit ? '已重新提交审核' : '商户更新成功');
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

    /** 写商户活动日志(暂停/恢复/2FA 等账户操作审计) */
    private function pushActivityLog(array $merchant, string $type, string $desc, int $status = 1): void
    {
        Db::table('merchant_activity_log')->insert([
            'site_id' => (int) $merchant['site_id'],
            'merchant_id' => (int) $merchant['id'],
            'activity_type' => $type,
            'description' => mb_substr($desc, 0, 255),
            'performed_by' => AdminContext::adminName() ?: 'Admin',
            'performed_by_id' => AdminContext::adminId(),
            'ip_address' => $this->clientIp(),
            'status' => $status,
        ]);
    }

    /** 生成 Base32 2FA 设置密钥(供商户注册流程消费,管理端不展示) */
    private function generateBase32Secret(int $bytes = 20): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bits = '';
        foreach (str_split(random_bytes($bytes)) as $ch) {
            $bits .= str_pad(decbin(ord($ch)), 8, '0', STR_PAD_LEFT);
        }
        $secret = '';
        foreach (str_split($bits, 5) as $chunk) {
            if (strlen($chunk) === 5) {
                $secret .= $alphabet[bindec($chunk)];
            }
        }
        return $secret;
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
