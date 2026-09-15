<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;
use App\Service\OnboardingAdminContactService;
use App\Service\OnboardingCredentialDeliveryService;
use App\Service\OnboardingFinalApprovalService;
use App\Service\OnboardingKycService;

use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpMessage\Upload\UploadedFile;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户入驻流水线(Onboarding,原型 stir-long v4.2.1 / Merchant Verification)
 * 设计源:docs/plans 商户验证原型对齐整改方案;docs/redesign 模块 02
 *
 * 基础注册状态由 merchant_application.registration_status 驱动；stage 仅供旧流程读取。
 * 每个写动作写入 merchant_verify_timeline(application_id 维度)。
 */
class OnboardingController extends AbstractController
{
    #[Inject]
    protected OnboardingKycService $onboardingKyc;

    #[Inject]
    protected OnboardingFinalApprovalService $finalApproval;

    #[Inject]
    protected OnboardingCredentialDeliveryService $credentialDelivery;

    #[Inject]
    protected OnboardingAdminContactService $adminContacts;

    #[Inject]
    protected \Hyperf\HttpServer\Contract\ResponseInterface $response;

    private const BUSINESS_TYPES = ['hotel', 'car_rental', 'restaurant', 'airline', 'attraction'];

    /** 阶段文案(审计/日志用) */
    private const STAGE_LABEL = [
        1 => 'New Lead',
        2 => 'Contacted',
        3 => 'KYC Access Granted',
        4 => 'KYC In Progress',
        5 => 'Approved',
        6 => 'Rejected',
    ];

    /** 协助商户上传 KYC 文件允许的扩展名(PDF/图片) */
    private const UPLOAD_ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

    /** 协助商户上传单文件大小上限(字节,nginx client_max_body_size=20m) */
    private const UPLOAD_MAX_SIZE = 10 * 1024 * 1024;

    /** 文件类型映射(mime → sys_file.file_type) */
    private const UPLOAD_FILE_TYPE = [
        'pdf' => 2,  // 文档
        'jpg' => 1, 'jpeg' => 1, 'png' => 1, 'webp' => 1, // 图片
    ];

    /** 线索列表:队列/业态/国家/关键词筛选;附全部业务名称及首个业务城市 */
    #[Permission('merchant:onboarding:list')]
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_application')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($queue = $this->strInput('queue')) !== '') {
            switch ($queue) {
                case 'pending':
                    $query->whereIn('registration_status', [1, 2]);
                    break;
                case 'approved':
                    $query->where('registration_status', 3);
                    break;
                case 'rejected':
                    $query->where('registration_status', 5);
                    break;
                case 'resubmission':
                    $query->where('registration_status', 4);
                    break;
                default:
                    break;
            }
        }
        if ($this->strInput('registrationStatus') !== '') {
            $status = $this->intInput('registrationStatus', -1);
            if ($status >= 0 && $status <= 5) $query->where('registration_status', $status);
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
        $businessNames = [];
        $firstBizCity = [];
        if ($ids !== []) {
            foreach (Db::table('merchant_application_business')->whereIn('application_id', $ids)->orderBy('id')->get() as $biz) {
                $applicationId = (int) $biz->application_id;
                $businessName = trim((string) $biz->business_name);
                if ($businessName !== '') {
                    $businessNames[$applicationId][] = $businessName;
                }
                $firstBizCity[$applicationId] ??= (string) $biz->city;
            }
        }
        foreach ($rows as &$row) {
            $row['business_names'] = implode(', ', $businessNames[(int) $row['id']] ?? []);
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
            'pending' => (clone $base)->whereIn('registration_status', [1, 2])->count(),
            'approved' => (clone $base)->where('registration_status', 3)->count(),
            'rejected' => (clone $base)->where('registration_status', 5)->count(),
            'resubmission' => (clone $base)->where('registration_status', 4)->count(),
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
                unset($r['contact_phone_index']);
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

        $kyc = null;
        if ((int) ($app['state_model_version'] ?? 0) >= 1
            && (int) $app['registration_status'] === 3 && (int) $app['merchant_kyc_status'] > 0) {
            $kyc = $this->onboardingKyc->requirements($app);
            $kyc['testAgreementAvailable'] = $this->onboardingKyc->testAgreementEnabled() && AdminContext::isSuper();
        }

        return Result::success([
            'application' => $app,
            'businesses' => $businesses,
            'documents' => $documents,
            'timeline' => $timeline,
            'notes' => $notes,
            'template' => $template,
            'kyc' => $kyc,
            'finalApproval' => $this->finalApproval->status((int) $app['id']),
        ]);
    }

    /** 唯一的申请级 KYC 资料清单；不按商户业务类型分流。 */
    #[Permission('merchant:onboarding:list')]
    public function kycTemplates(): array
    {
        $query = Db::table('merchant_kyc_template')->where('business_type', 'unified')->where('status', 1);
        return Result::success($query->orderByDesc('site_id')->orderBy('sort')->get()->map(static fn ($r) => (array) $r)->all());
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
        if ((string) $tpl['business_type'] !== 'unified') {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅可编辑统一 KYC 资料清单');
        }
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
            'business_type' => 'unified',
            'docs' => json_encode($docs, JSON_UNESCAPED_UNICODE),
            'status' => in_array($this->intInput('status', 1), [1, 2], true) ? $this->intInput('status', 1) : 1,
            'sort' => $this->intInput('sort', (int) $tpl['sort']),
        ]);
        return Result::success(null, '验证模板已更新');
    }

    /** 管理端代录完整基础注册申请，直接进入待审核队列。 */
    #[Permission('merchant:onboarding:create')]
    public function create(): array
    {
        $companyName = $this->requireStr('companyName');
        $siteId = (int) (AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId());
        if ($siteId <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择所属站点');
        }
        $merchantName = $this->strInput('merchantName') ?: $companyName;
        $regNumber = mb_substr($this->strInput('regNumber'), 0, 50);
        if ($regNumber !== '' && Db::table('merchant_application')
            ->where('reg_number', $regNumber)
            ->whereNull('deleted_at')
            ->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该公司注册号已存在');
        }
        $businesses = array_values(array_filter((array) $this->input('businesses', []), static function ($business): bool {
            $business = (array) $business;
            return trim((string) ($business['businessName'] ?? '')) !== '';
        }));
        if ($businesses === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请至少录入一家注册商家');
        }
        $businessTypes = [];
        foreach ($businesses as $business) {
            $type = strtolower(trim((string) ((array) $business)['businessType'] ?? ''));
            if (! in_array($type, self::BUSINESS_TYPES, true)) throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择有效的业务类型');
            if (! in_array($type, $businessTypes, true)) $businessTypes[] = $type;
        }
        $numBusinesses = count($businesses);
        $now = date('Y-m-d H:i:s');
        $contacts = $this->adminContacts->fields($siteId, $this->requireStr('registrationPhone'), $this->requireStr('registrationEmail'));

        $appId = 0;
        Db::transaction(function () use ($companyName, $merchantName, $regNumber, $siteId, $businesses, $businessTypes, $numBusinesses, $now, $contacts, &$appId) {
            $appId = Db::table('merchant_application')->insertGetId([
                ...$contacts,
                'site_id' => $siteId,
                'app_no' => $this->nextAppNo(),
                'merchant_name' => mb_substr($merchantName, 0, 100),
                'company_name' => mb_substr($companyName, 0, 100),
                'company_group_name' => mb_substr($this->strInput('companyGroupName'), 0, 100),
                'reg_number' => $regNumber,
                'country' => mb_substr($this->strInput('country'), 0, 50),
                'city' => mb_substr($this->strInput('city'), 0, 50),
                'address' => mb_substr($this->strInput('address'), 0, 255),
                'business_types' => implode(',', $businessTypes),
                'primary_business_type' => $businessTypes[0],
                'num_businesses' => $numBusinesses,
                'registration_status' => 1,
                'merchant_kyc_status' => 0,
                'account_status' => 0,
                'state_model_version' => 1,
                'current_step' => 4,
                'completion_percent' => 100,
                'operator_type' => mb_substr($this->strInput('operatorType'), 0, 30),
                'expected_launch_date' => $this->strInput('expectedLaunchDate') ?: null,
                'operations_notes' => mb_substr($this->strInput('operationsNotes'), 0, 500),
                'submitted_at' => $now,
                'last_activity_at' => $now,
                'last_updated_at' => $now,
            ]);
            foreach ($businesses as $biz) {
                $biz = (array) $biz;
                Db::table('merchant_application_business')->insert([
                    'site_id' => $siteId,
                    'application_id' => $appId,
                    'business_name' => mb_substr((string) $biz['businessName'], 0, 100),
                    'business_type' => mb_substr((string) ($biz['businessType'] ?? ''), 0, 30),
                    'city' => mb_substr((string) ($biz['city'] ?? ''), 0, 50),
                    'country_code' => strtoupper(mb_substr((string) ($biz['countryCode'] ?? ''), 0, 2)),
                    'city_key' => mb_substr((string) ($biz['cityKey'] ?? ''), 0, 80),
                    'address' => mb_substr((string) ($biz['address'] ?? ''), 0, 255),
                    'kyc_scope' => in_array((int) ($biz['kycScope'] ?? 1), [1, 2], true) ? (int) ($biz['kycScope'] ?? 1) : 1,
                    'contact_name' => mb_substr((string) ($biz['contactName'] ?? ''), 0, 50),
                    'contact_phone' => $this->encryptField(mb_substr((string) ($biz['contactPhone'] ?? ''), 0, 30)),
                    'contact_phone_index' => \Mtrip\Shared\Merchant\MerchantPhoneIndex::hash(mb_substr((string) ($biz['contactPhone'] ?? ''), 0, 30), $this->aesKey()),
                    'contact_email' => mb_substr((string) ($biz['contactEmail'] ?? ''), 0, 100),
                    'kyc_status' => 0,
                ]);
            }
            $app = $this->findApplication($appId);
            $this->pushTimeline($app, 'lead_created', '入驻线索录入');
            $this->pushTimeline($app, 'registration_contacts_admin_confirmed', '后台代录注册手机号和邮箱，默认由管理员确认；未执行 OTP，账号凭证默认投递至注册邮箱');
        });

        $app = $this->findApplication($appId);
        return Result::success($app, '线索已录入');
    }

    /** 人工调整阶段(仅 1-4;通过/驳回走 approve/reject 接口) */
    #[Permission('merchant:onboarding:update')]
    public function updateStage(): array
    {
        $app = $this->findApplication($this->requireId());
        $this->assertLegacyWorkflow($app);
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

    /** Send one application-level KYC request using the platform's unified document list. */
    #[Permission('merchant:onboarding:kyc')]
    public function sendKyc(): array
    {
        $app = $this->findApplication($this->requireId());
        $this->assertLegacyWorkflow($app);
        $this->assertEditable($app);
        $template = Db::table('merchant_kyc_template')
            ->whereIn('site_id', [0, (int) $app['site_id']])
            ->where('business_type', 'unified')->where('status', 1)
            ->orderByDesc('site_id')->orderBy('sort')->first();
        if (! $template) throw new BusinessException(ErrorCode::NOT_FOUND, '未配置启用的统一 KYC 资料清单');
        $docs = json_decode((string) $template->docs, true);
        if (! is_array($docs) || $docs === []) throw new BusinessException(ErrorCode::DATA_CONFLICT, '统一 KYC 资料清单为空');
        $now = date('Y-m-d H:i:s');
        $submissionMethod = in_array($this->intInput('submissionMethod', 1), [1, 2], true) ? $this->intInput('submissionMethod', 1) : 1;

        Db::transaction(function () use ($app, $template, $docs, $now, $submissionMethod): void {
            Db::table('merchant_application')->where('id', $app['id'])->update([
                'stage' => 3, 'kyc_scope' => 1, 'kyc_template_id' => (int) $template->id,
                'submission_method' => $submissionMethod, 'last_updated_at' => $now,
            ]);
            Db::table('merchant_application_business')->where('application_id', $app['id'])->update([
                'kyc_scope' => 1, 'kyc_template_id' => (int) $template->id, 'kyc_status' => 0,
                'kyc_submitted_at' => null, 'kyc_submitted_by' => 0,
            ]);
            $exists = Db::table('merchant_verify_document')->where('application_id', $app['id'])->where('biz_unit', '')->whereNull('deleted_at')->exists();
            if (! $exists) foreach ($docs as $doc) {
                $doc = (array) $doc;
                $docType = trim((string) ($doc['doc_type'] ?? ''));
                if ($docType === '') continue;
                Db::table('merchant_verify_document')->insert([
                    'site_id' => (int) $app['site_id'], 'merchant_id' => 0, 'application_id' => (int) $app['id'], 'biz_unit' => '',
                    'doc_type' => mb_substr($docType, 0, 50), 'name' => mb_substr((string) ($doc['name'] ?? $docType), 0, 100),
                    'status' => 2, 'uploaded_at' => $now,
                ]);
            }
        });
        $this->pushTimeline($app, 'kyc_sent', 'Unified KYC request: ' . (string) $template->name);
        return Result::success(null, '统一 KYC 请求已发送');
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

    /** 已提交的基础注册进入人工审核。 */
    #[Permission('merchant:onboarding:update')]
    public function registrationReviewStart(): array
    {
        $app = $this->findApplication($this->requireId());
        $now = date('Y-m-d H:i:s');
        $updated = Db::table('merchant_application')->where('id', $app['id'])->where('registration_status', 1)->update([
            'registration_status' => 2,
            'registration_reviewed_by' => AdminContext::adminId(),
            'registration_reviewed_at' => $now,
            'registration_review_reason' => '',
            'last_updated_at' => $now,
        ]);
        if ($updated !== 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已提交申请可以开始审核');
        $this->pushTimeline($app, 'registration_review_started', '基础注册开始审核');
        return Result::success(null, '已开始基础注册审核');
    }

    /** 审核中的基础注册退回申请人补正。 */
    #[Permission('merchant:onboarding:update')]
    public function registrationResubmit(): array
    {
        $app = $this->findApplication($this->requireId());
        $reason = mb_substr($this->requireStr('reason'), 0, 500);
        $now = date('Y-m-d H:i:s');
        $updated = Db::table('merchant_application')->where('id', $app['id'])->where('registration_status', 2)->update([
            'registration_status' => 4,
            'registration_reviewed_by' => AdminContext::adminId(),
            'registration_reviewed_at' => $now,
            'registration_review_reason' => $reason,
            'last_updated_at' => $now,
        ]);
        if ($updated !== 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅审核中的申请可以要求补正');
        $this->pushTimeline($app, 'registration_resubmit_required', $reason, true);
        return Result::success(null, '已要求申请人补正基础资料');
    }

    /** 基础注册通过：只开放 KYC，不创建正式商户、账号、物业或访问码。 */
    #[Permission('merchant:onboarding:registration-approve')]
    public function approve(): array
    {
        $app = $this->findApplication($this->requireId());
        $now = date('Y-m-d H:i:s');
        Db::transaction(function () use ($app, $now): void {
            $updated = Db::table('merchant_application')->where('id', $app['id'])->where('registration_status', 2)->update([
                'registration_status' => 3,
                'merchant_kyc_status' => 1,
                'registration_reviewed_by' => AdminContext::adminId(),
                'registration_reviewed_at' => $now,
                'registration_review_reason' => '',
                'last_updated_at' => $now,
            ]);
            if ($updated !== 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅审核中的申请可以批准');
            $this->onboardingKyc->initialize(array_replace($app, ['registration_status' => 3, 'merchant_kyc_status' => 1]));
        });
        $this->pushTimeline($app, 'registration_approved', '基础注册已批准，KYC 已开放');
        return Result::success(null, '基础注册已批准，KYC 已开放');
    }

    /** 最终批准：原子创建正式商户、待激活主账号、全部首批物业和凭证 outbox。 */
    #[Permission('merchant:onboarding:final-approve')]
    public function finalApprove(): array
    {
        $app = $this->findApplication($this->requireId());
        $channels = $this->input('channels', []);
        if (! is_array($channels)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'channels 格式不正确');
        }
        $result = $this->finalApproval->approve((int) $app['id'], $this->requireStr('requestId'), $channels);
        return Result::success($result, '最终批准已完成，账号等待激活');
    }

    /** 只重试已落库的凭证投递，不重复创建任何正式实体。 */
    #[Permission('merchant:onboarding:credential-retry')]
    public function credentialRetry(): array
    {
        if (! AdminContext::isSuper()) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅超级管理员可重试凭证投递');
        }
        return Result::success($this->credentialDelivery->retry($this->requireId('deliveryId')), '已完成一次投递尝试');
    }

    #[Permission('merchant:onboarding:final-approve')]
    public function testCredentials(): \Psr\Http\Message\ResponseInterface
    {
        $app = $this->findApplication($this->requireId());
        $data = $this->credentialDelivery->testCredentials((int) $app['id']);
        return $this->response->json(Result::success($data))->withHeader('Cache-Control', 'no-store');
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
        $reason = 'reason_code:' . $reasonCode . ($note !== '' ? ' ' . mb_substr($note, 0, 450) : '');
        $now = date('Y-m-d H:i:s');
        $updated = Db::table('merchant_application')->where('id', $app['id'])->where('registration_status', 2)->update([
            'registration_status' => 5,
            'registration_reviewed_by' => AdminContext::adminId(),
            'registration_reviewed_at' => $now,
            'registration_review_reason' => mb_substr($reason, 0, 500),
            'reject_reason_code' => $reasonCode,
            'reject_note' => mb_substr($note, 0, 500),
            'last_updated_at' => $now,
        ]);
        if ($updated !== 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅审核中的申请可以驳回');
        $this->pushTimeline($app, 'rejected', '原因码#' . $reasonCode . ($note !== '' ? ':' . $note : ''), true);
        return Result::success(null, '入驻申请已驳回');
    }

    #[Permission('merchant:onboarding:kyc')]
    public function testConfirmAgreement(): array
    {
        $app = $this->findApplication($this->requireId());
        return Result::success($this->onboardingKyc->testConfirmAgreement(
            $app, $this->requireId('agreementId'), $this->requireStr('version'), $this->requireStr('reason')
        ), '测试协议确认已记录（非商户真实签署）');
    }

    /** 商户确认 KYC 信息与提交授权；与“提交核验”工作流动作相互独立。 */
    #[Permission('merchant:onboarding:update')]
    public function confirm(): array
    {
        $app = $this->findApplication($this->requireId());
        $this->assertLegacyWorkflow($app);
        Db::table('merchant_application')->where('id', $app['id'])->update([
            'confirmation_status' => 1,
            'confirmed_at' => date('Y-m-d H:i:s'),
            'last_updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->pushTimeline($app, 'kyc_confirmed', '商户已确认 KYC 信息与提交授权');
        return Result::success(null, '商户 KYC 确认已记录');
    }

    /** 当前业务单元正式提交核验：必需文件齐全后，KYC 状态由待办中进入待核验。 */
    #[Permission('merchant:onboarding:kyc')]
    public function submitVerification(): array
    {
        $app = $this->findApplication($this->requireId());
        if ((int) ($app['state_model_version'] ?? 0) >= 1) {
            return Result::success($this->onboardingKyc->submit($app, true), '已协助提交 KYC 核验');
        }
        $this->assertLegacyWorkflow($app);
        $this->assertEditable($app);
        $businessId = $this->requireId('businessId');
        $business = Db::table('merchant_application_business')
            ->where('id', $businessId)
            ->where('application_id', (int) $app['id'])
            ->first();
        if (! $business) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '业务单元不属于该申请');
        }
        $business = (array) $business;
        if ((int) $business['kyc_status'] === 2 && ! empty($business['kyc_submitted_at'])) {
            return Result::success(null, '该商家 KYC 已提交核验');
        }

        $templateId = (int) ($business['kyc_template_id'] ?? 0);
        $template = $templateId > 0
            ? Db::table('merchant_kyc_template')->where('id', $templateId)->where('status', 1)->first()
            : Db::table('merchant_kyc_template')
                ->where('business_type', (string) $business['business_type'])
                ->where('status', 1)->orderBy('sort')->first();
        if (! $template) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前商家尚未配置有效的 KYC 模板');
        }

        $templateDocs = json_decode((string) ($template->docs ?? '[]'), true);
        $requiredDocs = [];
        foreach (is_array($templateDocs) ? $templateDocs : [] as $doc) {
            $doc = (array) $doc;
            $docType = trim((string) ($doc['doc_type'] ?? ''));
            if ($docType !== '' && (bool) ($doc['required'] ?? true)) {
                $requiredDocs[$docType] = (string) ($doc['name'] ?? $docType);
            }
        }
        if ($requiredDocs === []) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前 KYC 模板未配置必需文件');
        }

        $uploadedTypes = Db::table('merchant_verify_document')
            ->where('application_id', (int) $app['id'])
            ->where('biz_unit', (string) $businessId)
            ->where('file_url', '!=', '')
            ->whereNull('deleted_at')
            ->pluck('doc_type')->all();
        $missingTypes = array_diff(array_keys($requiredDocs), array_map('strval', $uploadedTypes));
        if ($missingTypes !== []) {
            $missingNames = array_map(static fn ($type) => $requiredDocs[$type], $missingTypes);
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '请先上传全部必需文件：' . implode('、', $missingNames));
        }

        $now = date('Y-m-d H:i:s');
        Db::transaction(function () use ($app, $businessId, $now) {
            Db::table('merchant_application_business')->where('id', $businessId)->update([
                'kyc_status' => 2,
                'kyc_submitted_at' => $now,
                'kyc_submitted_by' => AdminContext::adminId(),
            ]);
            Db::table('merchant_application')->where('id', $app['id'])->update([
                'stage' => max(4, (int) $app['stage']),
                'last_updated_at' => $now,
            ]);
        });
        $this->pushTimeline($app, 'kyc_submitted', '商家「' . (string) $business['business_name'] . '」已提交核验');
        return Result::success(null, 'KYC 已提交核验');
    }

    /**
     * 协助商户上传 KYC 文件(商户运营代传):
     * 保存到本地共享存储 → 写系统文件库 sys_file → 落商户资质文档表 merchant_verify_document → 写时间线。
     * 上传后文件须由授权验证管理员/超管独立审核。
     */
    #[Permission('merchant:onboarding:kyc')]
    public function kycUpload(): array
    {
        $app = $this->findApplication($this->requireId());
        if ((int) ($app['state_model_version'] ?? 0) >= 1) {
            return Result::success($this->onboardingKyc->upload(
                $app, $this->requireStr('scopeType'), $this->intInput('applicationBusinessId'),
                $this->requireStr('docType'), $this->request->file('file'), true
            ), '已协助上传 KYC 文件');
        }
        $this->assertLegacyWorkflow($app);
        $this->assertEditable($app);
        $docType = $this->requireStr('docType');
        // 业务单元维度(协助 KYC 关联所选注册商户);biz_unit 存业务单元 id
        $bizUnit = $this->strInput('bizUnit', '');
        if ($bizUnit === '') {
            $businessIds = Db::table('merchant_application_business')
                ->where('application_id', (int) $app['id'])->orderBy('id')->pluck('id')->all();
            if (count($businessIds) === 1) {
                $bizUnit = (string) $businessIds[0];
            } elseif (count($businessIds) > 1) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '多商家申请上传 KYC 文件时必须指定业务单元');
            }
        }
        if ($bizUnit !== '') {
            $belongs = Db::table('merchant_application_business')
                ->where('id', (int) $bizUnit)->where('application_id', (int) $app['id'])->exists();
            if (! $belongs) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '业务单元不属于该申请');
            }
            $bizUnit = (string) (int) $bizUnit;
        }

        /** @var UploadedFile|null $file */
        $file = $this->request->file('file');
        if (! $file || ! $file->isValid()) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '未接收到有效的上传文件');
        }
        $ext = strtolower((string) pathinfo($file->getClientFilename() ?: '', PATHINFO_EXTENSION));
        if (! in_array($ext, self::UPLOAD_ALLOWED_EXT, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '仅支持 PDF/JPG/JPEG/PNG/WebP 文件');
        }
        $fileSize = $file->getSize();
        if ($fileSize > self::UPLOAD_MAX_SIZE) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '文件大小不能超过 10MB');
        }
        // 先缓存元数据,moveTo 后仍可用(moveTo 会保留元数据,这里显式取一次更稳)
        $clientName = (string) ($file->getClientFilename() ?? '');
        $mime = (string) ($file->getMimeType() ?? '');

        // 本地共享存储落盘(路径 uploads/kyc/{applicationId}/{唯一名}.{ext})
        $uploadRoot = rtrim((string) $this->config->get('storage.upload_root', '/opt/www/uploads'), '/\\');
        $urlPrefix = rtrim((string) $this->config->get('storage.url_prefix', '/uploads'), '/');
        $relativeDir = '/kyc/' . (int) $app['id'] . '/' . date('Ym');
        $realDir = $uploadRoot . $relativeDir;
        if (! is_dir($realDir) && ! @mkdir($realDir, 0775, true) && ! is_dir($realDir)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '上传目录创建失败,请联系管理员');
        }
        $unique = date('His') . '-' . bin2hex(random_bytes(8));
        $relativePath = $relativeDir . '/' . $unique . '.' . $ext;
        $realPath = $uploadRoot . $relativePath;
        $file->moveTo($realPath);
        if (! is_file($realPath)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '文件保存失败,请联系管理员');
        }
        // 容器内以 root 写入默认 600,网关 nginx 用户需读到,统一放宽到 664
        @chmod($realPath, 0664);
        $fileUrl = $urlPrefix . $relativePath;

        $docId = 0;
        $now = date('Y-m-d H:i:s');
        Db::transaction(function () use (
            $app, $docType, $bizUnit, $clientName, $mime, $fileUrl, $relativePath, $fileSize, $ext, &$docId, $now
        ) {
            // 1) 系统文件库(sys_file)
            Db::connection('system')->table('sys_file')->insertGetId([
                'site_id' => (int) $app['site_id'],
                'storage_id' => 0,
                'file_name' => mb_substr($clientName, 0, 255),
                'file_path' => mb_substr($relativePath, 0, 500),
                'file_url' => mb_substr($fileUrl, 0, 500),
                'file_type' => self::UPLOAD_FILE_TYPE[$ext] ?? 2,
                'mime_type' => mb_substr($mime, 0, 100),
                'file_size' => $fileSize,
                'biz_type' => 'merchant_kyc',
                'uploader_id' => AdminContext::adminId(),
            ]);

            // 2) 资质文档表:按 application + biz_unit + doc_type 定位占位行,未命中则新建
            $doc = Db::table('merchant_verify_document')
                ->where('application_id', (int) $app['id'])
                ->where('biz_unit', $bizUnit)
                ->where('doc_type', $docType)
                ->whereNull('deleted_at')
                ->orderBy('id')->lockForUpdate()
                ->first();
            $documents = new \App\Service\MerchantDocumentService();
            if ($doc) {
                if ($documents->approved((array) $doc)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '已批准商户请使用证件替换流程');
                $documents->snapshot((array) $doc);
                Db::table('merchant_verify_document')->where('id', (int) $doc->id)->update([
                    'document_version' => (int) $doc->document_version + 1,
                    'reviewer_id' => 0, 'reviewer_name' => '', 'reject_reason' => '', 'last_verified_at' => null,
                    'file_url' => $fileUrl,
                    'file_size' => (string) $fileSize,
                    'name' => mb_substr($clientName, 0, 100),
                    'status' => 2,
                    'uploaded_at' => $now,
                    'updated_at' => $now,
                ]);
                $docId = (int) $doc->id;
            } else {
                $docId = Db::table('merchant_verify_document')->insertGetId([
                    'site_id' => (int) $app['site_id'],
                    'merchant_id' => (int) $app['merchant_id'],
                    'application_id' => (int) $app['id'],
                    'biz_unit' => $bizUnit,
                    'doc_type' => mb_substr($docType, 0, 50),
                    'name' => mb_substr($clientName, 0, 100),
                    'file_url' => $fileUrl,
                    'file_size' => (string) $fileSize,
                    'status' => 2,
                    'remark' => '协助商户(KYC 代传)',
                    'uploaded_at' => $now,
                ]);
            }
            $savedDoc = (array) Db::table('merchant_verify_document')->where('id', $docId)->first();
            $documents->snapshot($savedDoc, 'onboarding_draft', hash_file('sha256', $documents->localPath($fileUrl)));
            $documents->event($savedDoc, 'upload', 'Module11 draft upload; verification submission is still required');
            // 上传/替换文件属于草稿编辑；已提交资料发生变化时退回待办中，必须重新提交核验。
            if ($bizUnit !== '') {
                Db::table('merchant_application_business')
                    ->where('id', (int) $bizUnit)
                    ->where('application_id', (int) $app['id'])
                    ->update([
                        'kyc_status' => 0,
                        'kyc_submitted_at' => null,
                        'kyc_submitted_by' => 0,
                    ]);
            }
        });

        $this->pushTimeline($app, 'assist_kyc_upload', '协助商户上传 KYC 文件:' . $docType);
        return Result::success([
            'id' => (int) $docId,
            'file_url' => $fileUrl,
            'file_size' => (string) $fileSize,
            'file_name' => $clientName,
            'doc_type' => $docType,
        ], '文件上传成功');
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

    /** 终态申请不可再修改运营信息。 */
    private function assertEditable(array $app): void
    {
        if ((int) ($app['state_model_version'] ?? 0) >= 1) {
            if (in_array((int) $app['registration_status'], [3, 5], true)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该申请已终结,不可操作');
            }
            return;
        }
        if (in_array((int) $app['stage'], [5, 6], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该申请已终结,不可操作');
        }
    }

    private function assertLegacyWorkflow(array $app): void
    {
        if ((int) ($app['state_model_version'] ?? 0) >= 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '新入驻流程不再使用旧阶段或旧 KYC 操作');
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
