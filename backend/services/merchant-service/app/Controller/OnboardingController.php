<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户入驻流水线(Onboarding,原型 stir-long v4.2.1 / Merchant Verification)
 * 设计源:docs/plans 商户验证原型对齐整改方案;docs/redesign 模块 02
 *
 * 阶段机(merchant_application.stage,对齐 stir-long 原型四节点流程):
 *   1 New Lead → 2 Contacted → 3 KYC Access Granted(Send KYC) → 4 KYC In Progress
 *   → 5 Approved(approve 转 merchant_info status=0 进入 Pending Verification) / 6 Rejected(reject 关闭入驻)
 * 队列口径:queues/index 的 queue 参数 pending=stage1,2,3,4 / approved=5 / rejected=6
 * 每个写动作写入 merchant_verify_timeline(application_id 维度)。
 */
class OnboardingController extends AbstractController
{
    /** 阶段文案(审计/日志用) */
    private const STAGE_LABEL = [
        1 => 'New Lead',
        2 => 'Contacted',
        3 => 'KYC Access Granted',
        4 => 'KYC In Progress',
        5 => 'Approved',
        6 => 'Rejected',
    ];

    /** 业态 → merchant_info.merchant_type */
    private const TYPE_MAP = ['hotel' => 1, 'attraction' => 2];

    /** 线索列表:队列/业态/国家/关键词筛选;附首个业务单元名+城市(列表 Business Name / 城市列) */
    #[Permission('merchant:onboarding:list')]
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_application')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($queue = $this->strInput('queue')) !== '') {
            switch ($queue) {
                case 'pending':
                    $query->whereBetween('stage', [1, 4]);
                    break;
                case 'approved':
                    $query->where('stage', 5);
                    break;
                case 'rejected':
                    $query->where('stage', 6);
                    break;
                case 'resubmission':
                    $query->where('stage', 4);
                    break;
                default:
                    break;
            }
        }
        if (($stage = $this->intInput('stage')) > 0) {
            $query->where('stage', $stage);
        }
        if (($country = $this->strInput('country')) !== '') {
            $query->where('country', $country);
        }
        if (($category = $this->strInput('category')) !== '') {
            $query->where('business_types', 'like', "%{$category}%");
        }
        $regStart = $this->strInput('regDateStart');
        if ($regStart !== '') {
            $query->where('created_at', '>=', $regStart . ' 00:00:00');
        }
        $regEnd = $this->strInput('regDateEnd');
        if ($regEnd !== '') {
            $query->where('created_at', '<=', $regEnd . ' 23:59:59');
        }
        if (($kw = $this->strInput('keyword')) !== '') {
            $bizAppIds = Db::table('merchant_application_business')
                ->where('business_name', 'like', "%{$kw}%")->pluck('application_id')->all();
            $query->where(function ($q) use ($kw, $bizAppIds) {
                $q->where('app_no', 'like', "%{$kw}%")
                    ->orWhere('merchant_name', 'like', "%{$kw}%")
                    ->orWhere('company_name', 'like', "%{$kw}%")
                    ->orWhere('reg_number', 'like', "%{$kw}%");
                if ($bizAppIds !== []) {
                    $q->orWhereIn('id', $bizAppIds);
                }
            });
        }
        $total = (clone $query)->count();
        $rows = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        $ids = array_column($rows, 'id');
        $firstBiz = [];
        $firstBizCity = [];
        if ($ids !== []) {
            foreach (Db::table('merchant_application_business')->whereIn('application_id', $ids)->orderBy('id')->get() as $biz) {
                $firstBiz[(int) $biz->application_id] ??= (string) $biz->business_name;
                $firstBizCity[(int) $biz->application_id] ??= (string) $biz->city;
            }
        }
        foreach ($rows as &$row) {
            $row['business_name'] = $firstBiz[(int) $row['id']] ?? '';
            $row['business_city'] = $firstBizCity[(int) $row['id']] ?? '';
        }
        return Result::page($rows, $total, $page, $pageSize);
    }

    /** 四队列计数(原型顶部统计卡:待审核/已通过/已驳回/重新提交) */
    #[Permission('merchant:onboarding:list')]
    public function queues(): array
    {
        $base = Db::table('merchant_application')->whereNull('deleted_at');
        $this->applySiteScope($base);
        return Result::success([
            'pending' => (clone $base)->whereBetween('stage', [1, 4])->count(),
            'approved' => (clone $base)->where('stage', 5)->count(),
            'rejected' => (clone $base)->where('stage', 6)->count(),
            'resubmission' => (clone $base)->where('stage', 4)->count(),
        ]);
    }

    /** 详情:申请 + 业务单元 + KYC 文档 + 时间线 + 内部备注 */
    #[Permission('merchant:onboarding:list')]
    public function detail(): array
    {
        $app = $this->findApplication($this->requireId());
        $businesses = Db::table('merchant_application_business')
            ->where('application_id', $app['id'])->orderBy('id')->get()
            ->map(function ($r) {
                $r = (array) $r;
                // 手机号加密存储,详情接口解密后明文返回(入驻阶段需完整联系方式跟进线索)
                $r['contact_phone'] = $this->decryptField((string) ($r['contact_phone'] ?? ''));
                return $r;
            })->all();
        $documents = Db::table('merchant_verify_document')
            ->where('application_id', $app['id'])->whereNull('deleted_at')->orderBy('id')->get()
            ->map(static fn ($r) => (array) $r)->all();
        $timeline = Db::table('merchant_verify_timeline')
            ->where('application_id', $app['id'])->orderByDesc('id')->limit(100)->get()
            ->map(static fn ($r) => (array) $r)->all();
        $notes = Db::table('merchant_application_note')
            ->where('application_id', $app['id'])->orderByDesc('id')->limit(100)->get()
            ->map(static fn ($r) => (array) $r)->all();
        $template = (int) $app['kyc_template_id'] > 0
            ? (array) Db::table('merchant_kyc_template')->where('id', $app['kyc_template_id'])->first()
            : null;

        return Result::success([
            'application' => $app,
            'businesses' => $businesses,
            'documents' => $documents,
            'timeline' => $timeline,
            'notes' => $notes,
            'template' => $template,
        ]);
    }

    /** KYC 模板列表(按业态过滤可选) */
    #[Permission('merchant:onboarding:list')]
    public function kycTemplates(): array
    {
        $query = Db::table('merchant_kyc_template')->where('status', 1);
        if (($type = $this->strInput('businessType')) !== '') {
            $query->where('business_type', $type);
        }
        return Result::success($query->orderBy('sort')->get()->map(static fn ($r) => (array) $r)->all());
    }

    /** 编辑 KYC 验证模板:名称/业态/所需文档清单(含必填标记),平台级配置 */
    #[Permission('merchant:onboarding:kyc')]
    public function kycTemplateUpdate(): array
    {
        $id = $this->requireId('id');
        $tpl = Db::table('merchant_kyc_template')->where('id', $id)->first();
        if (! $tpl) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '验证模板不存在');
        }
        $tpl = (array) $tpl;
        $this->assertSiteScope((int) $tpl['site_id']);

        $name = $this->requireStr('name');
        $businessType = $this->requireStr('businessType');
        $docs = [];
        foreach ((array) $this->input('docs', []) as $doc) {
            $doc = (array) $doc;
            $docName = trim((string) ($doc['name'] ?? ''));
            if ($docName === '') {
                continue;
            }
            $docs[] = [
                'name' => mb_substr($docName, 0, 100),
                'doc_type' => mb_substr((string) ($doc['doc_type'] ?? ''), 0, 50),
                'required' => (bool) ($doc['required'] ?? true),
            ];
        }
        if ($docs === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '验证模板至少需要一份所需文档');
        }
        Db::table('merchant_kyc_template')->where('id', $id)->update([
            'name' => mb_substr($name, 0, 100),
            'business_type' => mb_substr($businessType, 0, 30),
            'docs' => json_encode($docs, JSON_UNESCAPED_UNICODE),
            'status' => in_array($this->intInput('status', 1), [1, 2], true) ? $this->intInput('status', 1) : 1,
            'sort' => $this->intInput('sort', (int) $tpl['sort']),
        ]);
        return Result::success(null, '验证模板已更新');
    }

    /** 录入线索:公司信息 + 可选业务单元数组,初始 New Lead */
    #[Permission('merchant:onboarding:create')]
    public function create(): array
    {
        $companyName = $this->requireStr('companyName');
        $siteId = (int) (AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId());
        $businesses = (array) $this->input('businesses', []);
        $now = date('Y-m-d H:i:s');

        $appId = 0;
        Db::transaction(function () use ($companyName, $siteId, $businesses, $now, &$appId) {
            $appId = Db::table('merchant_application')->insertGetId([
                'site_id' => $siteId,
                'app_no' => $this->nextAppNo(),
                'merchant_name' => mb_substr($this->strInput('merchantName'), 0, 100),
                'company_name' => mb_substr($companyName, 0, 100),
                'company_group_name' => mb_substr($this->strInput('companyGroupName'), 0, 100),
                'reg_number' => mb_substr($this->strInput('regNumber'), 0, 50),
                'country' => mb_substr($this->strInput('country'), 0, 50),
                'city' => mb_substr($this->strInput('city'), 0, 50),
                'address' => mb_substr($this->strInput('address'), 0, 255),
                'business_types' => mb_substr($this->strInput('businessTypes'), 0, 100),
                'num_businesses' => max(1, $this->intInput('numBusinesses', 1)),
                'stage' => 1,
                'operator_type' => mb_substr($this->strInput('operatorType'), 0, 30),
                'expected_launch_date' => $this->strInput('expectedLaunchDate') ?: null,
                'operations_notes' => mb_substr($this->strInput('operationsNotes'), 0, 500),
                'submitted_at' => $now,
                'last_updated_at' => $now,
            ]);
            foreach ($businesses as $biz) {
                $biz = (array) $biz;
                if (trim((string) ($biz['businessName'] ?? '')) === '') {
                    continue;
                }
                Db::table('merchant_application_business')->insert([
                    'site_id' => $siteId,
                    'application_id' => $appId,
                    'business_name' => mb_substr((string) $biz['businessName'], 0, 100),
                    'business_type' => mb_substr((string) ($biz['businessType'] ?? ''), 0, 30),
                    'city' => mb_substr((string) ($biz['city'] ?? ''), 0, 50),
                    'kyc_scope' => in_array((int) ($biz['kycScope'] ?? 1), [1, 2], true) ? (int) ($biz['kycScope'] ?? 1) : 1,
                    'contact_name' => mb_substr((string) ($biz['contactName'] ?? ''), 0, 50),
                    'contact_phone' => $this->encryptField(mb_substr((string) ($biz['contactPhone'] ?? ''), 0, 30)),
                    'contact_email' => mb_substr((string) ($biz['contactEmail'] ?? ''), 0, 100),
                    'kyc_status' => 2,
                ]);
            }
        });

        $app = $this->findApplication($appId);
        $this->pushTimeline($app, 'lead_created', '入驻线索录入');
        return Result::success($app, '线索已录入');
    }

    /** 人工调整阶段(仅 1-4;通过/驳回走 approve/reject 接口) */
    #[Permission('merchant:onboarding:update')]
    public function updateStage(): array
    {
        $app = $this->findApplication($this->requireId());
        $this->assertEditable($app);
        $stage = $this->intInput('stage');
        if ($stage < 1 || $stage > 4) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '阶段仅支持 1-4,通过/驳回请使用对应接口');
        }
        if ($stage === (int) $app['stage']) {
            return Result::success(null, '阶段未变化');
        }
        Db::table('merchant_application')->where('id', $app['id'])->update([
            'stage' => $stage,
            'last_updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->pushTimeline($app, 'stage_changed', sprintf('%s → %s', self::STAGE_LABEL[(int) $app['stage']], self::STAGE_LABEL[$stage]));
        return Result::success(null, '阶段已更新');
    }

    /** 指派运营专员 */
    #[Permission('merchant:onboarding:assign')]
    public function assignOps(): array
    {
        $app = $this->findApplication($this->requireId());
        $this->assertEditable($app);
        $opsId = $this->intInput('opsId');
        $opsName = mb_substr($this->strInput('opsName'), 0, 50);
        if ($opsId <= 0) {
            $opsName = '';
        }
        Db::table('merchant_application')->where('id', $app['id'])->update([
            'assigned_ops_id' => max(0, $opsId),
            'assigned_ops_name' => $opsName,
            'last_updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->pushTimeline($app, 'ops_assigned', $opsName === '' ? 'Unassigned' : $opsName);
        return Result::success(null, $opsName === '' ? '已取消指派' : '已指派运营');
    }

    /** 保存运营评估(Operator Type / 预计上线 / 备注) */
    #[Permission('merchant:onboarding:update')]
    public function saveAssessment(): array
    {
        $app = $this->findApplication($this->requireId());
        $this->assertEditable($app);
        Db::table('merchant_application')->where('id', $app['id'])->update([
            'operator_type' => mb_substr($this->strInput('operatorType'), 0, 30),
            'expected_launch_date' => $this->strInput('expectedLaunchDate') ?: null,
            'operations_notes' => mb_substr($this->strInput('operationsNotes'), 0, 500),
            'business_types' => mb_substr($this->strInput('businessTypes', (string) $app['business_types']), 0, 100),
            'num_businesses' => max(1, $this->intInput('numBusinesses', (int) $app['num_businesses'])),
            'last_updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->pushTimeline($app, 'assessment_saved', '运营评估已保存');
        return Result::success(null, '评估已保存');
    }

    /** 发送 KYC 请求:按模板生成文档占位行,阶段 → KYC已开放;businessId 可选(业务单元级 scope/模板同步) */
    #[Permission('merchant:onboarding:kyc')]
    public function sendKyc(): array
    {
        $app = $this->findApplication($this->requireId());
        $this->assertEditable($app);
        $templateId = $this->requireId('templateId');
        $template = Db::table('merchant_kyc_template')->where('id', $templateId)->where('status', 1)->first();
        if (! $template) {
            throw new BusinessException(ErrorCode::NOT_FOUND, 'KYC模板不存在');
        }
        $kycScope = in_array($this->intInput('kycScope', 1), [1, 2], true) ? $this->intInput('kycScope', 1) : 1;
        $businessId = $this->intInput('businessId');
        $docs = json_decode((string) $template->docs, true) ?: [];
        $now = date('Y-m-d H:i:s');

        Db::transaction(function () use ($app, $templateId, $template, $docs, $now, $kycScope, $businessId) {
            Db::table('merchant_application')->where('id', $app['id'])->update([
                'stage' => 3,
                'kyc_scope' => $kycScope,
                'kyc_template_id' => $templateId,
                'submission_method' => in_array($this->intInput('submissionMethod', 1), [1, 2], true) ? $this->intInput('submissionMethod', 1) : 1,
                'last_updated_at' => $now,
            ]);
            // 业务单元级 KYC 配置(原型 KYC Management 按注册企业卡片切换)
            if ($businessId > 0) {
                Db::table('merchant_application_business')
                    ->where('id', $businessId)->where('application_id', $app['id'])
                    ->update(['kyc_scope' => $kycScope, 'kyc_template_id' => $templateId]);
            }
            // 已生成过占位文档则不重复生成(重发 KYC 仅刷新状态)
            $exists = Db::table('merchant_verify_document')->where('application_id', $app['id'])->whereNull('deleted_at')->exists();
            if (! $exists) {
                foreach ($docs as $doc) {
                    $doc = (array) $doc;
                    Db::table('merchant_verify_document')->insert([
                        'site_id' => (int) $app['site_id'],
                        'merchant_id' => 0,
                        'application_id' => (int) $app['id'],
                        'doc_type' => mb_substr((string) ($doc['doc_type'] ?? ''), 0, 50),
                        'name' => mb_substr((string) ($doc['name'] ?? ''), 0, 100),
                        'status' => 2,
                        'uploaded_at' => $now,
                    ]);
                }
            }
        });
        $this->pushTimeline($app, 'kyc_sent', (string) $template->name);
        return Result::success(null, 'KYC 请求已发送');
    }

    /** 发送提醒(暂仅审计留痕,真实通知通道后续接) */
    #[Permission('merchant:onboarding:kyc')]
    public function sendReminder(): array
    {
        $app = $this->findApplication($this->requireId());
        $this->pushTimeline($app, 'reminder_sent', $this->strInput('note'));
        return Result::success(null, '提醒已发送');
    }

    /** 新增内部备注 */
    #[Permission('merchant:onboarding:update')]
    public function addNote(): array
    {
        $app = $this->findApplication($this->requireId());
        $note = $this->requireStr('note');
        Db::table('merchant_application_note')->insert([
            'site_id' => (int) $app['site_id'],
            'application_id' => (int) $app['id'],
            'note' => mb_substr($note, 0, 1000),
            'author_id' => AdminContext::adminId(),
            'author_name' => AdminContext::adminName(),
        ]);
        return Result::success(null, '备注已添加');
    }

    /**
     * 入驻通过(KYC 完成):生成 merchant_info(status=0 待审核)进入 Pending Verification,
     * KYC 占位文档迁移挂到新商户
     */
    #[Permission('merchant:onboarding:approve')]
    public function approve(): array
    {
        $app = $this->findApplication($this->requireId());
        $this->assertEditable($app);
        $regNumber = (string) $app['reg_number'];
        $creditCode = $regNumber !== '' ? $regNumber : (string) $app['app_no'];
        if (Db::table('merchant_info')->where('credit_code', $creditCode)->whereNull('deleted_at')->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '注册号已存在对应商户,不可重复入驻');
        }

        $merchantId = 0;
        Db::transaction(function () use ($app, $creditCode, &$merchantId) {
            $template = (int) $app['kyc_template_id'] > 0
                ? Db::table('merchant_kyc_template')->where('id', $app['kyc_template_id'])->first()
                : null;
            $bizType = $template ? (string) $template->business_type : explode(',', (string) $app['business_types'])[0];
            $merchantId = Db::table('merchant_info')->insertGetId([
                'site_id' => (int) $app['site_id'],
                'merchant_name' => (string) $app['company_name'],
                'merchant_short_name' => (string) $app['company_name'],
                'merchant_type' => self::TYPE_MAP[$bizType] ?? 3,
                'credit_code' => $creditCode,
                'legal_person' => '',
                'contact_name' => (string) $app['company_name'],
                'contact_phone' => '',
                'contact_email' => '',
                'address' => (string) $app['country'],
                'status' => 0,
                'remark' => 'Onboarding ' . (string) $app['app_no'] . ' 通过入驻验证',
            ]);
            Db::table('merchant_verify_document')
                ->where('application_id', $app['id'])->where('merchant_id', 0)
                ->update(['merchant_id' => $merchantId]);
            Db::table('merchant_application')->where('id', $app['id'])->update([
                'stage' => 5,
                'merchant_id' => $merchantId,
                'last_updated_at' => date('Y-m-d H:i:s'),
            ]);
            Db::table('merchant_application_business')
                ->where('application_id', $app['id'])
                ->update(['kyc_status' => 1]);
        });
        $this->pushTimeline($app, 'approved', '入驻通过,转商户 #' . $merchantId . ' 进入待审核');
        return Result::success(['merchant_id' => $merchantId], '入驻已通过,商户进入待审核');
    }

    /** 入驻驳回:预置原因码 + 补充说明,关闭入驻 */
    #[Permission('merchant:onboarding:reject')]
    public function reject(): array
    {
        $app = $this->findApplication($this->requireId());
        $this->assertEditable($app);
        $reasonCode = $this->intInput('reasonCode');
        if ($reasonCode < 1 || $reasonCode > 9) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择驳回原因');
        }
        $note = $this->strInput('note');
        Db::table('merchant_application')->where('id', $app['id'])->update([
            'stage' => 6,
            'reject_reason_code' => $reasonCode,
            'reject_note' => mb_substr($note, 0, 500),
            'last_updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->pushTimeline($app, 'rejected', '原因码#' . $reasonCode . ($note !== '' ? ':' . $note : ''), true);
        return Result::success(null, '入驻申请已驳回');
    }

    /**
     * KYC 提交确认(整改 B4,原型 Merchant Confirmation):
     * 本期为接口契约(merchant-web 端接入时改挂 /api/v1/merchant/* 并换 MerchantAuthMiddleware);
     * 管理端侧保留入口便于联调,确认后 verify/detail 的 kyc_submission.confirmation 显示 Confirmed
     */
    #[Permission('merchant:onboarding:update')]
    public function confirm(): array
    {
        $app = $this->findApplication($this->requireId());
        // 商户确认 KYC 提交 → 进入「等待文件」(stage 4,仅向前推进)
        $stage = (int) $app['stage'] < 4 ? 4 : (int) $app['stage'];
        Db::table('merchant_application')->where('id', $app['id'])->update([
            'confirmation_status' => 1,
            'confirmed_at' => date('Y-m-d H:i:s'),
            'stage' => $stage,
            'last_updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->pushTimeline($app, 'kyc_confirmed', '商户确认 KYC 提交,进入等待文件');
        return Result::success(null, '已确认商户 KYC 提交');
    }

    // ── 私有助手 ──────────────────────────────────────────────

    /** 取申请并校验站点数据权限 */
    private function findApplication(int $id): array
    {
        $app = Db::table('merchant_application')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $app) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '入驻申请不存在');
        }
        $app = (array) $app;
        $this->assertSiteScope((int) $app['site_id']);
        return $app;
    }

    /** 已通过(5)/已驳回(6)的申请不可再编辑 */
    private function assertEditable(array $app): void
    {
        if (in_array((int) $app['stage'], [5, 6], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该申请已终结,不可操作');
        }
    }

    /** 线索编号:APP-{年份}{4位序号}(冲突重试) */
    private function nextAppNo(): string
    {
        $base = 'APP-' . date('Y');
        $seq = (int) Db::table('merchant_application')->where('app_no', 'like', $base . '%')->count() + 1;
        do {
            $appNo = $base . str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
            ++$seq;
        } while (Db::table('merchant_application')->where('app_no', $appNo)->exists());
        return $appNo;
    }

    /** 写申请维度时间线 */
    private function pushTimeline(array $app, string $action, string $note = '', bool $exception = false): void
    {
        Db::table('merchant_verify_timeline')->insert([
            'site_id' => (int) $app['site_id'],
            'merchant_id' => (int) $app['merchant_id'],
            'application_id' => (int) $app['id'],
            'action' => $action,
            'actor_type' => 2,
            'operator_id' => AdminContext::adminId(),
            'operator_name' => AdminContext::adminName(),
            'note' => mb_substr($note, 0, 500),
            'is_exception' => $exception ? 1 : 0,
        ]);
    }
}
