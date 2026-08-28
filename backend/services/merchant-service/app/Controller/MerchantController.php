<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\MerchantService;
use App\Service\MerchantStatusService;
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
 *        3已启用 ⇄ 4已暂停；黑名单独立叠加，状态变化不批量改动商品。
 */
class MerchantController extends AbstractController
{
    #[\Hyperf\Di\Annotation\Inject]
    protected \Hyperf\HttpServer\Contract\ResponseInterface $response;
    #[Inject]
    protected MerchantService $service;

    #[Inject]
    protected MerchantStatusService $statusService;

    /** M12目录：稳定分页、精确电话索引、同一物业的位置过滤；不返回登录凭证。 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_info as m')->whereNull('m.deleted_at');
        $siteId = AdminContext::scopeSiteId($this->intInput('siteId'));
        if (! AdminContext::isSuper() || ($siteId !== null && $siteId > 0)) {
            $query->where('m.site_id', $siteId);
        }
        $businesses = Db::table('merchant_application_business as b')
            ->join('merchant_application as a', 'a.id', '=', 'b.application_id')
            ->whereNull('a.deleted_at')->whereColumn('a.merchant_id', 'm.id')
            ->whereColumn('a.site_id', 'm.site_id')->whereColumn('b.site_id', 'm.site_id');
        $properties = Db::table('merchant_store as s')->whereNull('s.deleted_at')
            ->whereColumn('s.merchant_id', 'm.id')->whereColumn('s.site_id', 'm.site_id');
        $keyword = $this->strInput('keyword', $this->strInput('merchantName'));
        if (mb_strlen($keyword) > 100) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '关键词最多100字');
        }
        if ($keyword !== '') {
            $like = '%' . addcslashes($keyword, '\\%_') . '%';
            $phoneIndex = \Mtrip\Shared\Merchant\MerchantPhoneIndex::hash($keyword, $this->aesKey());
            $query->where(function ($q) use ($keyword, $like, $phoneIndex, $businesses, $properties) {
                $q->where('m.merchant_name', 'like', $like)->orWhere('m.merchant_code', 'like', $like)
                    ->orWhere('m.contact_email', 'like', $like)->orWhere('m.credit_code', 'like', $like);
                if (ctype_digit($keyword) && strlen($keyword) < 19) {
                    $q->orWhere('m.id', (int) $keyword);
                }
                if ($phoneIndex !== null) {
                    $q->orWhere('m.contact_phone_index', $phoneIndex);
                }
                $q->addWhereExistsQuery((clone $businesses)->where(function ($b) use ($like, $phoneIndex) {
                    $b->where('b.business_name', 'like', $like)->orWhere('a.company_name', 'like', $like)
                        ->orWhere('b.contact_email', 'like', $like);
                    if ($phoneIndex !== null) {
                        $b->orWhere('b.contact_phone_index', $phoneIndex);
                    }
                }), 'or')->addWhereExistsQuery((clone $properties)->where('s.store_name', 'like', $like), 'or');
            });
        }
        if (($type = $this->intInput('merchantType')) > 0) {
            $query->where('m.merchant_type', $type);
        }
        $category = $this->strInput('category');
        if ($category !== '') {
            if (! in_array($category, ['hotel', 'restaurant', 'airline', 'car_rental', 'attraction'], true)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '业务类型无效');
            }
            $applications = Db::table('merchant_application as a')->whereNull('a.deleted_at')
                ->whereColumn('a.merchant_id', 'm.id')->whereColumn('a.site_id', 'm.site_id');
            $query->where(function ($q) use ($businesses, $applications, $category) {
                $q->addWhereExistsQuery((clone $applications)->whereRaw('FIND_IN_SET(?, REPLACE(a.business_types, \' \', \'\')) > 0', [$category]))
                    ->addWhereExistsQuery((clone $businesses)->where('b.business_type', $category), 'or');
                if (in_array($category, ['hotel', 'attraction'], true)) {
                    $q->orWhere(function ($legacy) use ($applications, $category) {
                        $legacy->where('m.merchant_type', $category === 'hotel' ? 1 : 2)
                            ->addWhereExistsQuery(clone $applications, 'and', true);
                    });
                }
            });
        }
        $blacklist = Db::table('merchant_blacklist as bl')->whereColumn('bl.merchant_id', 'm.id')
            ->where('bl.status', 1);
        // 卡片统计保留同一站点范围，独立于分页和当前状态选择。
        $statsQuery = clone $query;
        $stats = [
            'total' => (clone $statsQuery)->count(),
            'active' => (clone $statsQuery)->where('m.status', 3)->addWhereExistsQuery(clone $blacklist, 'and', true)->count(),
            'suspended' => (clone $statsQuery)->where('m.status', 4)->addWhereExistsQuery(clone $blacklist, 'and', true)->count(),
            'blacklisted' => (clone $statsQuery)->addWhereExistsQuery(clone $blacklist)->count(),
        ];
        $status = $this->input('status');
        if ($status === 'blacklisted') {
            $query->addWhereExistsQuery(clone $blacklist);
        } elseif ($status !== null && $status !== '') {
            if (! in_array((string) $status, ['0', '1', '2', '3', '4', '5', '6'], true)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '商户状态无效');
            }
            $query->where('m.status', (int) $status)->addWhereExistsQuery(clone $blacklist, 'and', true);
        }
        if ($this->intInput('excludeBlacklisted') === 1) {
            $query->addWhereExistsQuery(clone $blacklist, 'and', true);
        }
        $country = strtoupper($this->strInput('country'));
        $city = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $this->strInput('city'))));
        if ($country !== '' || $city !== '') {
            $location = (clone $properties)->where('s.business_type', 'hotel');
            if ($country !== '') $location->where('s.country_code', $country);
            if ($city !== '') $location->where('s.city_key', $city);
            $query->addWhereExistsQuery($location);
        }
        $from = $this->strInput('registeredFrom');
        $to = $this->strInput('registeredTo');
        foreach ([$from, $to] as $date) {
            if ($date !== '' && (! preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date) || date('Y-m-d', strtotime($date)) !== $date)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '注册日期格式应为YYYY-MM-DD');
            }
        }
        if ($from !== '' && $to !== '' && $from > $to) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '注册日期范围无效');
        }
        if ($from !== '') $query->where('m.created_at', '>=', $from . ' 00:00:00');
        if ($to !== '') $query->where('m.created_at', '<', date('Y-m-d', strtotime($to . ' +1 day')) . ' 00:00:00');
        $groupId = $this->input('groupId');
        if ($groupId !== null && $groupId !== '') $query->where('m.group_id', (int) $groupId);
        if ($this->intInput('unboundOnly') === 1) $query->where('m.group_id', 0)->whereIn('m.status', [3, 4]);
        $sorts = ['id' => 'm.id', 'merchantName' => 'm.merchant_name', 'registeredAt' => 'm.created_at', 'lastLoginAt' => 'last_login_at'];
        $sort = $this->strInput('sortField', 'id');
        $order = strtolower($this->strInput('sortOrder', 'desc'));
        if (! isset($sorts[$sort]) || ! in_array($order, ['asc', 'desc'], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '排序参数无效');
        }
        $total = (clone $query)->count();
        $query->select(array_map(static fn ($col) => 'm.' . $col, [
            'id', 'merchant_code', 'site_id', 'group_id', 'merchant_name', 'merchant_short_name',
            'merchant_type', 'credit_code', 'legal_person', 'contact_name', 'contact_phone',
            'contact_email', 'address', 'remark', 'commission_rate', 'commission_plan', 'settlement_cycle', 'status',
            'status_version', 'suspended_until', 'reactivation_requires_super', 'created_at',
        ]))->selectSub((clone $blacklist)->selectRaw('COUNT(*)'), 'is_blacklisted')
            ->selectSub(Db::table('merchant_admin as login')->whereNull('login.deleted_at')
                ->whereColumn('login.merchant_id', 'm.id')->whereColumn('login.site_id', 'm.site_id')
                ->selectRaw("NULLIF(GREATEST(COALESCE(MAX(login.last_login_at), ''), COALESCE(m.last_login_at, '')), '')"), 'last_login_at');
        $query->orderBy($sorts[$sort], $order);
        if ($sort !== 'id') $query->orderBy('m.id', $order);
        $list = $query->forPage($page, $pageSize)->get()->map(function ($row) {
            $row = (array) $row;
            $row['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $row['contact_phone']));
            $row['is_blacklisted'] = (bool) $row['is_blacklisted'];
            return $row;
        })->all();
        $result = Result::page($this->directoryFields($list), $total, $page, $pageSize);
        $result['data']['stats'] = $stats;
        return $result;
    }

    /** 入驻申请及业务单元是真实业态来源；老商户无申请时才回退旧分类。 */
    private function directoryFields(array $rows): array
    {
        if ($rows === []) return [];
        $applications = Db::table('merchant_application as a')
            ->join('merchant_info as m', 'm.id', '=', 'a.merchant_id')
            ->whereColumn('a.site_id', 'm.site_id')->whereNull('a.deleted_at')
            ->whereIn('a.merchant_id', array_column($rows, 'id'))
            ->leftJoin('merchant_application_business as b', function ($join) {
                $join->on('b.application_id', '=', 'a.id')->on('b.site_id', '=', 'a.site_id');
            })->get(['a.merchant_id', 'a.business_types', 'b.business_type']);
        $types = [];
        foreach ($applications as $app) {
            $types[$app->merchant_id] ??= [];
            foreach (explode(',', $app->business_types . ',' . ($app->business_type ?? '')) as $type) {
                if (trim($type) !== '') $types[$app->merchant_id][trim($type)] = true;
            }
        }
        foreach ($rows as &$row) {
            $row['business_types'] = isset($types[$row['id']]) ? array_keys($types[$row['id']])
                : match ((int) $row['merchant_type']) { 1 => ['hotel'], 2 => ['attraction'], default => [] };
            sort($row['business_types']);
            $row['verification_status'] = match ((int) $row['status']) {
                0 => 'pending', 6 => 'resubmission', 2 => 'rejected', 1, 3, 4 => 'approved', default => 'unknown',
            };
            $row['account_status'] = $row['is_blacklisted'] ? 'blacklisted' : match ((int) $row['status']) {
                3 => 'active', 4 => 'suspended', 5 => 'closed', default => 'inactive',
            };
        }
        return $rows;
    }

    /** 商户详情:含结算账户与主账号;敏感字段脱敏(超管可见明文手机号) */
    public function detail(): array
    {
        $merchant = $this->findScoped($this->requireId());
        $phone = $this->decryptField((string) $merchant['contact_phone']);
        $merchant['contact_phone'] = AdminContext::isSuper() ? $phone : MaskHelper::mobile($phone);
        $merchant['legal_id_card'] = MaskHelper::idCard($this->decryptField((string) $merchant['legal_id_card']));

        $merchant['is_blacklisted'] = Db::table('merchant_blacklist')->where('merchant_id', $merchant['id'])->where('status', 1)->exists();
        $merchant['access_code_configured'] = ! empty($merchant['access_code']);
        $merchant = array_intersect_key($merchant, array_flip([
            'id', 'merchant_code', 'site_id', 'group_id', 'merchant_name', 'merchant_short_name', 'merchant_type',
            'credit_code', 'legal_person', 'legal_id_card', 'contact_name', 'contact_phone', 'contact_email',
            'address', 'remark', 'commission_rate', 'commission_plan', 'settlement_cycle', 'status', 'status_version', 'suspended_until',
            'reactivation_requires_super', 'created_at', 'updated_at', 'last_login_at', 'is_blacklisted',
            'is_vip', 'two_fa_enabled', 'two_fa_method', 'two_fa_enrolled_at', 'two_fa_last_reset_at',
            'two_fa_status', 'access_status', 'access_code_configured',
        ]));

        $merchant = $this->directoryFields([$merchant])[0];

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
            ->where('merchant_id', $merchant['id'])->where('site_id', $merchant['site_id'])->whereNull('deleted_at');
        $paid = (clone $orderQuery)->whereIn('order_status', [1, 2, 3]);
        $merchant['revenue_mtd'] = round((float) (clone $paid)->where('created_at', '>=', $monthStart)->sum('pay_amount'), 2);
        $merchant['bookings_mtd'] = (int) (clone $paid)->where('created_at', '>=', $monthStart)->count();

        $accounts = Db::table('merchant_account')
            ->where('merchant_id', $merchant['id'])->where('site_id', $merchant['site_id'])->whereNull('deleted_at')
            ->orderByDesc('is_default')->orderBy('id')->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['account_no'] = MaskHelper::bankCard($this->decryptField((string) $row['account_no']));
                unset($row['deleted_at']);
                return $row;
            })->all();
        $admins = Db::table('merchant_admin')
            ->where('merchant_id', $merchant['id'])->where('site_id', $merchant['site_id'])->whereNull('deleted_at')
            ->get(['id', 'username', 'real_name', 'account_type', 'store_id', 'is_owner', 'status', 'last_login_at', 'created_at'])
            ->map(static fn ($row) => (array) $row)->all();

        $applications = Db::table('merchant_application')->where('merchant_id', $merchant['id'])
            ->where('site_id', $merchant['site_id'])->whereNull('deleted_at')->orderBy('id')
            ->get(['id', 'app_no', 'company_name', 'company_group_name', 'reg_number', 'country', 'submitted_at'])
            ->map(static fn ($row) => (array) $row)->all();
        $loginTimes = array_filter(array_merge([$merchant['last_login_at']], array_column($admins, 'last_login_at')));
        $merchant['last_login_at'] = $loginTimes === [] ? null : max($loginTimes);
        $businesses = Db::table('merchant_application_business')
            ->whereIn('application_id', array_column($applications, 'id'))->where('site_id', $merchant['site_id'])->orderBy('id')
            ->get(['id', 'application_id', 'business_name', 'business_type', 'city', 'kyc_status', 'contact_name', 'contact_phone', 'contact_email'])
            ->map(function ($row) {
                $row = (array) $row;
                $row['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $row['contact_phone']));
                return $row;
            })->all();
        $properties = Db::table('merchant_store')->where('merchant_id', $merchant['id'])
            ->where('site_id', $merchant['site_id'])
            ->where(static fn ($q) => $q->whereNull('deleted_at')->orWhereNotNull('source_business_id'))->orderBy('id')
            ->get(['id', 'store_name', 'business_type', 'source_business_id', 'country_code', 'city_key', 'mapping_version', 'display_enabled', 'status', 'deleted_at'])
            ->map(static fn ($row) => (array) $row)->all();
        $group = empty($merchant['group_id']) ? null : Db::table('merchant_group')
            ->where('id', $merchant['group_id'])->where('site_id', $merchant['site_id'])->whereNull('deleted_at')
            ->first(['id', 'group_name', 'status']);
        return Result::success([
            'merchant' => $merchant, 'accounts' => $accounts, 'admins' => $admins,
            'applications' => $applications, 'businesses' => $businesses, 'properties' => $properties,
            'group' => $group === null ? null : (array) $group,
        ]);
    }

    /**
     * 暂停商户(整改 A4,原型 Suspend Merchant):阻止新预订,不影响已确认订单
     * status 3已启用 → 4已禁用(=Suspended);必填原因;写活动日志
     */
    #[Permission('merchant:status:suspend')]
    public function suspend(): array
    {
        return Result::success($this->statusService->change($this->requireId(), 'suspend', $this->request->all(), $this->clientIp()));
    }

    /** 恢复商户(整改 A4,原型 Reactivate):Suspended → Active */
    #[Permission('merchant:status:activate')]
    public function activate(): array
    {
        return Result::success($this->statusService->change($this->requireId(), 'activate', $this->request->all(), $this->clientIp()));
    }

    #[Permission('merchant:list:2fa')]
    public function resetTwoFa(): array
    {
        (new \App\Service\MerchantAccountSecurityService())->reset($this->requireId('merchantId'), $this->requireId('accountId'), $this->requireId('expectedVersion'), $this->requireStr('reason'));
        return Result::success(null, '2FA已重置，目标账号下次登录需重新注册');
    }

    #[Permission('merchant:list:impersonate')]
    public function impersonateStart(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response->json(Result::success((new \App\Service\MerchantImpersonationService())->start($this->requireId('merchantId'), $this->requireId('accountId'), $this->requireStr('reason'))))->withHeader('Cache-Control', 'no-store');
    }

    #[Permission('merchant:list:impersonate')]
    public function impersonateEnd(): array
    {
        (new \App\Service\MerchantImpersonationService())->end($this->requireId('sessionId'));
        return Result::success(null, '代为登录会话已结束');
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
        $data['contact_phone_index'] = \Mtrip\Shared\Merchant\MerchantPhoneIndex::hash($this->requireStr('contactPhone'), $this->aesKey());
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
            $data['contact_phone_index'] = \Mtrip\Shared\Merchant\MerchantPhoneIndex::hash($phone, $this->aesKey());
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

    /** 旧入口保留，但备注、版本、权限与新状态服务完全一致。 */
    #[Permission(['merchant:status:suspend', 'merchant:status:activate', 'merchant:status:reactivate'])]
    public function toggleStatus(): array
    {
        $merchant = $this->findScoped($this->requireId());
        $action = (int) $merchant['status'] === 3 ? 'suspend'
            : ((int) $merchant['reactivation_requires_super'] === 1 ? 'reactivate' : 'activate');
        return Result::success($this->statusService->change((int) $merchant['id'], $action, $this->request->all(), $this->clientIp()));
    }

    #[Permission('merchant:status:reactivate')]
    public function reactivate(): array
    {
        return Result::success($this->statusService->change($this->requireId(), 'reactivate', $this->request->all(), $this->clientIp()));
    }

    #[Permission('merchant:status:history')]
    public function statusHistory(): array
    {
        $merchant = $this->findScoped($this->requireId());
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_status_history')->where('merchant_id', $merchant['id'])->where('site_id', $merchant['site_id']);

        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get([
            'id', 'action', 'from_status', 'to_status', 'note', 'evidence', 'suspended_until',
            'from_version', 'to_version', 'actor_type', 'actor_id', 'actor_name', 'created_at',
        ])->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
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
        $plan = $this->input('commissionPlan') === null ? $merchant['commission_plan'] : $this->strInput('commissionPlan');
        if ($plan !== null && ! in_array($plan, ['vip', 'premium', 'standard'], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '佣金计划仅支持VIP、Premium、Standard');
        }
        if (! in_array($cycle, [7, 15, 30], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '结算周期仅支持 T+7 / T+15 / 30(月结)');
        }
        Db::table('merchant_info')->where('id', $merchant['id'])->update([
            'commission_rate' => $rate,
            'commission_plan' => $plan,
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


}
