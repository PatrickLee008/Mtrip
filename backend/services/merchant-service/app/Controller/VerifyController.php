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
 * 商户验证工作流(Super Admin Portal / Phase 1)
 * 设计源:docs/redesign/super-admin-portal/modules/02-merchant-verification.md
 *
 * 状态机(merchant_info.status):
 *   0待审核 →(通过)3已启用 /(驳回)2审核驳回 /(要求重交)6待重新提交
 *   6/2 商户编辑后回到 0(见 MerchantController::update);3 ⇄ 4暂停;拉黑另记 merchant_blacklist
 * 每个写动作写入 merchant_verify_timeline(审计)+ merchant_activity_log(活动)。
 */
class VerifyController extends AbstractController
{
    #[Inject]
    protected MerchantService $service;

    /** tab → merchant_info.status 集合 */
    private const TAB_STATUS = [
        'pending' => [0],
        'approved' => [3],
        'rejected' => [2],
        'resubmission' => [6],
    ];

    /** 预置驳回原因(原型 Reject Application 弹窗 9 项,码值前后端对齐) */
    public const REJECT_REASONS = [
        1 => 'Expired business registration',
        2 => 'Invalid or missing operating license',
        3 => 'Incomplete documentation',
        4 => 'Identity verification failed',
        5 => 'Business does not meet platform requirements',
        6 => 'Premises / fleet documents invalid',
        7 => 'Insurance or safety certification missing',
        8 => 'Suspected fraudulent application',
        9 => 'Duplicate merchant account',
    ];

    /** 验证工单列表:按 tab(pending/approved/rejected/resubmission)分状态 */
    #[Permission('merchant:list:audit')]
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $tab = $this->strInput('tab', 'pending');
        $statuses = self::TAB_STATUS[$tab] ?? self::TAB_STATUS['pending'];

        $query = Db::table('merchant_info')->whereNull('deleted_at')->whereIn('status', $statuses);
        $this->applySiteScope($query);
        if (($kw = $this->strInput('keyword')) !== '') {
            $query->where(function ($q) use ($kw) {
                $q->where('merchant_name', 'like', "%{$kw}%")
                    ->orWhere('credit_code', 'like', "%{$kw}%")
                    ->orWhere('contact_name', 'like', "%{$kw}%")
                    ->orWhere('contact_email', 'like', "%{$kw}%")
                    ->orWhere('address', 'like', "%{$kw}%");
            });
        }
        $type = $this->intInput('merchantType');
        if ($type <= 0) {
            $type = $this->intInput('category');
        }
        if ($type > 0) {
            $query->where('merchant_type', $type);
        }
        if (($city = $this->strInput('city')) !== '') {
            $query->where('address', 'like', "%{$city}%");
        }
        $regStart = $this->strInput('regDateStart');
        if ($regStart !== '') {
            $query->where('created_at', '>=', $regStart . ' 00:00:00');
        }
        $regEnd = $this->strInput('regDateEnd');
        if ($regEnd !== '') {
            $query->where('created_at', '<=', $regEnd . ' 23:59:59');
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'site_id', 'merchant_name', 'merchant_short_name', 'merchant_type', 'credit_code', 'legal_person', 'contact_name', 'contact_phone', 'contact_email', 'address', 'status', 'audit_remark', 'audit_by', 'audit_time', 'created_at'])
            ->map(function ($row) {
                $row = (array) $row;
                $row['contact_phone'] = MaskHelper::mobile($this->decryptField((string) $row['contact_phone']));
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /**
     * 五队列汇总数量(正式 PRD 模块 11):入驻中/待验证/重新提交/已批准/已拒绝
     * 入驻中=merchant_application.stage 1-4;其余=merchant_info.status(0/6/3/2);站点口径
     */
    #[Permission('merchant:list:audit')]
    public function queues(): array
    {
        $siteId = AdminContext::scopeSiteId($this->intInput('siteId'));

        $appQuery = Db::table('merchant_application')->whereNull('deleted_at')->whereIn('stage', [1, 2, 3, 4]);
        $merchantQuery = Db::table('merchant_info')->whereNull('deleted_at');
        if ($siteId !== null && $siteId > 0) {
            $appQuery->where('site_id', $siteId);
            $merchantQuery->where('site_id', $siteId);
        }

        $counts = [
            'onboarding' => (int) (clone $appQuery)->count(),
            'pending' => (int) (clone $merchantQuery)->where('status', 0)->count(),
            'resubmission' => (int) (clone $merchantQuery)->where('status', 6)->count(),
            'approved' => (int) (clone $merchantQuery)->where('status', 3)->count(),
            'rejected' => (int) (clone $merchantQuery)->where('status', 2)->count(),
        ];
        return Result::success($counts);
    }

    /** 验证详情:商户核心 + 资质文档(含重交版本) + 时间线 + 门禁统计 + 重交/KYC提交信息 */
    #[Permission('merchant:list:audit')]
    public function detail(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        $merchant['contact_phone'] = AdminContext::isSuper()
            ? $this->decryptField((string) $merchant['contact_phone'])
            : MaskHelper::mobile($this->decryptField((string) $merchant['contact_phone']));
        $merchant['legal_id_card'] = MaskHelper::idCard($this->decryptField((string) $merchant['legal_id_card']));
        unset($merchant['legal_id_images'], $merchant['deleted_at']);
        $merchant['two_fa_status'] = (int) ($merchant['two_fa_status'] ?? 0);
        $merchant['access_status'] = (int) ($merchant['access_status'] ?? 0);

        $documents = Db::table('merchant_verify_document')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')
            ->orderBy('id')->get()
            ->map(static fn ($r) => (array) $r)->all();
        // 逐文档挂载重交版本(Original vs Resubmitted 对比视图)
        $docIds = array_column($documents, 'id');
        $revByDoc = [];
        if ($docIds !== []) {
            foreach (Db::table('merchant_verify_document_revision')->whereIn('doc_id', $docIds)->orderByDesc('version')->get() as $rev) {
                $revByDoc[(int) $rev->doc_id][] = (array) $rev;
            }
        }
        foreach ($documents as &$doc) {
            $doc['revisions'] = $revByDoc[(int) $doc['id']] ?? [];
        }
        unset($doc);

        // 最终决策门禁:reviewed = 已给出通过/驳回结论的文档数
        $totalCount = count($documents);
        $reviewedCount = count(array_filter($documents, static fn ($d) => in_array((int) $d['status'], [1, 3], true)));

        // 重交信息块:最近一次重交请求 + 需重交文档进度
        $resubmission = null;
        $lastReq = Db::table('merchant_verify_timeline')
            ->where('merchant_id', $merchant['id'])->where('action', 'resubmit_requested')
            ->orderByDesc('id')->first();
        if ($lastReq !== null) {
            $needDocs = array_filter($documents, static fn ($d) => (int) $d['status'] === 5 || $d['revisions'] !== []);
            $resubmission = [
                'requested_by' => (string) $lastReq->operator_name,
                'requested_at' => (string) $lastReq->created_at,
                'note' => (string) $lastReq->note,
                'total' => count($needDocs),
                'resubmitted' => count(array_filter($needDocs, static fn ($d) => $d['revisions'] !== [])),
            ];
        }

        // KYC 提交信息(经入驻申请带入;非入驻渠道商户不展示)
        $kycSubmission = null;
        $businesses = [];
        $rejectedDocIds = [];
        $application = Db::table('merchant_application')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')->first();
        if ($application !== null) {
            $selfService = (int) $application->submission_method === 1;
            $uploaded = array_filter($documents, static fn ($d) => $d['file_url'] !== '');
            // 确认状态优先取显式确认位(整改 B4);兼容旧数据按文档上传齐全推导
            $confirmed = (int) $application->confirmation_status === 1
                || (count($uploaded) === $totalCount && $totalCount > 0);
            $kycSubmission = [
                'method' => $selfService ? 'Self-Service' : 'Assisted',
                'submitted_by' => $selfService ? 'Merchant' : 'Admin',
                'confirmation' => $confirmed ? 'Confirmed' : 'Pending',
                'confirmed_at' => $application->confirmed_at ?? null,
            ];
            // 业务单元(PRD:公司级信息 + 业务级联系/城市/KYC 状态)
            $businesses = Db::table('merchant_application_business')
                ->where('application_id', $application->id)->orderBy('id')->get()
                ->map(function ($r) {
                    $r = (array) $r;
                    $r['contact_phone'] = MaskHelper::mobile($this->decryptField((string) ($r['contact_phone'] ?? '')));
                    return $r;
                })->all();
            // 拒绝快照:标记受影响文件
            if (! empty($application->rejected_doc_ids)) {
                $rejectedDocIds = array_map('intval', json_decode((string) $application->rejected_doc_ids, true) ?: []);
            }
        }
        foreach ($documents as &$doc) {
            $doc['was_rejected'] = in_array((int) $doc['id'], $rejectedDocIds, true) ? 1 : 0;
        }
        unset($doc);

        $timeline = Db::table('merchant_verify_timeline')
            ->where('merchant_id', $merchant['id'])
            ->orderByDesc('id')->limit(100)->get()
            ->map(static fn ($r) => (array) $r)->all();

        return Result::success([
            'merchant' => $merchant,
            'documents' => $documents,
            'businesses' => $businesses,
            'timeline' => $timeline,
            'review' => ['total' => $totalCount, 'reviewed' => $reviewedCount],
            'resubmission' => $resubmission,
            'kyc_submission' => $kycSubmission,
        ]);
    }

    /** 通过验证:待审核/待重新提交 → 已启用(生成商户主账号+访问码);未核验文档存在时门禁拦截 */
    #[Permission('merchant:verify:approve')]
    public function approve(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        if (! in_array((int) $merchant['status'], [0, 6], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核/待重新提交商户可通过');
        }
        // 最终决策门禁(整改 A5,原型 review all documents before final decision):
        // 存在任何未核验通过(status != 1)的文档即拦截,行内快捷批准与抽屉批准走同一接口不可绕过
        $pendingDocs = Db::table('merchant_verify_document')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')
            ->where('status', '!=', 1)->count();
        if ($pendingDocs > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, sprintf('还有 %d 份文档未核验通过,请先完成逐份核验再做最终决定', $pendingDocs));
        }
        $remark = $this->strInput('remark');
        $channels = implode(',', array_intersect(['email', 'sms', 'inapp'], (array) $this->input('channels', [])));
        $account = $this->service->approve($merchant, $remark, $channels);
        $this->pushAccessCodeLog($merchant, 'generate', $channels);
        $this->pushTimeline($merchant, 'approved', $remark);
        if ($channels !== '') {
            $this->pushTimeline($merchant, 'credentials_sent', $account['access_code'] . ' via ' . $channels);
        }
        $this->pushActivity($merchant, 'verification', '商户验证通过');
        return Result::success($account, '审核通过,商户账号已生成');
    }

    /** 驳回验证:预置原因码(1-9)必填 + 可选补充说明 → 审核驳回(商户可修改重提) */
    #[Permission('merchant:verify:reject')]
    public function reject(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        if (! in_array((int) $merchant['status'], [0, 6], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核/待重新提交商户可驳回');
        }
        $reasonCode = $this->intInput('reasonCode');
        if (! isset(self::REJECT_REASONS[$reasonCode])) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择驳回原因');
        }
        $note = $this->strInput('note') ?: $this->strInput('reason');
        $reasonText = self::REJECT_REASONS[$reasonCode];
        $reason = $note !== '' ? $reasonText . ' | ' . $note : $reasonText;
        $this->service->reject($merchant, $reason);
        // 拒绝快照:受影响文件(未通过)ID 列表(PRD:被拒绝申请保留受影响文件)
        $failedDocs = Db::table('merchant_verify_document')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')
            ->where('status', '!=', 1)->pluck('id')->all();
        Db::table('merchant_application')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')
            ->update(['rejected_doc_ids' => json_encode($failedDocs)]);
        Db::table('merchant_info')->where('id', $merchant['id'])->update(['reject_reason_code' => $reasonCode]);
        $this->pushTimeline($merchant, 'rejected', $reason, 2, true);
        $this->pushActivity($merchant, 'verification', '商户验证驳回:' . $reason);
        return Result::success(null, '已驳回,商户可修改后重新提交');
    }

    /** 要求重新提交:必填说明 → 待重新提交(通知商户补正) */
    #[Permission('merchant:verify:resubmit')]
    public function resubmit(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        if ((int) $merchant['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核商户可要求重新提交');
        }
        $comment = $this->requireStr('comment');
        Db::table('merchant_info')->where('id', $merchant['id'])->update([
            'status' => 6,
            'audit_remark' => mb_substr($comment, 0, 500),
            'audit_by' => AdminContext::adminId(),
            'audit_time' => date('Y-m-d H:i:s'),
        ]);
        // 已驳回文档转「需重交」,商户重交后新增 revision 并回到待审(详情对比视图数据源)
        Db::table('merchant_verify_document')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')->where('status', 3)
            ->update(['status' => 5, 'resubmit_required_at' => date('Y-m-d H:i:s')]);
        $this->pushTimeline($merchant, 'resubmit_requested', $comment);
        $this->pushActivity($merchant, 'verification', '要求重新提交:' . $comment);
        return Result::success(null, '已通知商户重新提交');
    }

    /** 确认商户已重新提交文件(重交闭环):需重交文档全部补齐后,商户回到待验证队列 */
    #[Permission('merchant:verify:resubmit')]
    public function resubmitReceived(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        if ((int) $merchant['status'] !== 6) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅重新提交队列商户可确认重交');
        }
        $now = date('Y-m-d H:i:s');
        $docs = Db::table('merchant_verify_document')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')->where('status', 5)->get()
            ->map(static fn ($r) => (array) $r)->all();
        Db::transaction(function () use ($merchant, $docs, $now) {
            foreach ($docs as $doc) {
                $version = (int) $doc['revision_count'] + 1;
                Db::table('merchant_verify_document_revision')->insert([
                    'site_id' => (int) $doc['site_id'],
                    'doc_id' => (int) $doc['id'],
                    'merchant_id' => (int) $merchant['id'],
                    'version' => $version,
                    'file_url' => '',
                    'file_size' => '',
                    'status' => 2,
                    'reject_reason' => '',
                    'reviewer_name' => '',
                    'uploaded_at' => $now,
                ]);
                Db::table('merchant_verify_document')->where('id', $doc['id'])->update([
                    'status' => 2,
                    'revision_count' => $version,
                    'resubmit_required_at' => null,
                    'last_verified_at' => null,
                    'reviewer_id' => 0,
                    'reviewer_name' => '',
                ]);
            }
            Db::table('merchant_info')->where('id', $merchant['id'])->update([
                'status' => 0,
                'audit_remark' => '',
                'audit_by' => AdminContext::adminId(),
                'audit_time' => $now,
            ]);
        });
        $this->pushTimeline($merchant, 'resubmit_received', '商户已重新提交文件,回到待验证', 2, false, (int) ($merchant['application_id'] ?? 0));
        $this->pushActivity($merchant, 'verification', '确认商户重新提交,回到待验证');
        return Result::success(null, '已确认重交,商户回到待验证');
    }

    /** 重新生成商户门户访问码(原型 Approved 详情 Regenerate 按钮) */
    #[Permission('merchant:verify:regencode')]
    public function regenerateCode(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        if ((int) $merchant['status'] !== 3) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已启用商户可重新生成访问码');
        }
        $code = $this->service->generateAccessCode((int) $merchant['merchant_type']);
        Db::table('merchant_info')->where('id', $merchant['id'])->update(['access_code' => $code]);
        $this->pushAccessCodeLog($merchant, 'regenerate', '');
        $this->pushTimeline($merchant, 'code_regenerated', $code);
        $this->pushActivity($merchant, 'verification', '重新生成商户访问码');
        return Result::success(['access_code' => $code], '访问码已重新生成');
    }

    /** 重新发送商户访问码(PRD 模块 11:查看/复制/重新发送/重新生成,权限+审计) */
    #[Permission('merchant:verify:resend')]
    public function resendCode(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        if ((int) $merchant['status'] !== 3) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已启用商户可重新发送访问码');
        }
        $channels = implode(',', array_intersect(['email', 'sms', 'inapp'], (array) $this->input('channels', [])));
        if ($channels === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请至少选择一个下发渠道');
        }
        $this->pushAccessCodeLog($merchant, 'resend', $channels);
        $this->pushTimeline($merchant, 'code_resent', 'via ' . $channels);
        $this->pushActivity($merchant, 'verification', '重新发送访问码:via ' . $channels);
        return Result::success(null, '访问码已重新发送');
    }

    /** 逐份文档核验:action=verify 核验通过 / reject 驳回(必填原因) */
    #[Permission('merchant:verify:doc')]
    public function docReview(): array
    {
        $docId = $this->requireId('docId');
        $doc = Db::table('merchant_verify_document')->where('id', $docId)->whereNull('deleted_at')->first();
        if (! $doc) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '文档不存在');
        }
        $doc = (array) $doc;
        $this->assertSiteScope((int) $doc['site_id']);
        // 入驻阶段文档 merchant_id=0(application 维度),仅正式商户文档需 findMerchant
        $merchant = ['id' => (int) $doc['merchant_id'], 'site_id' => (int) $doc['site_id'], 'merchant_name' => (string) ($doc['name'] ?? '')];
        if ((int) $doc['merchant_id'] > 0) {
            $merchant = $this->findMerchant((int) $doc['merchant_id']);
        }
        $applicationId = (int) ($doc['application_id'] ?? 0);

        $action = $this->strInput('action');
        if ($action === 'verify') {
            Db::table('merchant_verify_document')->where('id', $docId)->update([
                'status' => 1,
                'reviewer_id' => AdminContext::adminId(),
                'reviewer_name' => AdminContext::adminName(),
                'last_verified_at' => date('Y-m-d H:i:s'),
                'reject_reason' => '',
            ]);
            $this->pushTimeline($merchant, 'doc_verified', (string) $doc['name'], 2, false, $applicationId);
            return Result::success(null, '文档已核验通过');
        }
        if ($action === 'reject') {
            $reason = $this->requireStr('reason');
            Db::table('merchant_verify_document')->where('id', $docId)->update([
                'status' => 3,
                'reviewer_id' => AdminContext::adminId(),
                'reviewer_name' => AdminContext::adminName(),
                'reject_reason' => mb_substr($reason, 0, 255),
            ]);
            $this->pushTimeline($merchant, 'doc_rejected', $doc['name'] . ':' . $reason, 2, true, $applicationId);
            return Result::success(null, '文档已驳回');
        }
        throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 action 仅支持 verify/reject');
    }

    /**
     * 商户文档库(模块 03 Merchant Documents):跨商户文档列表 + 状态/类型/关键词筛选
     * 返回 data 含 stats(五张统计卡:total/verified/pending/expired/resubmission,站点口径)
     */
    #[Permission('merchant:doc:list')]
    public function documents(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_verify_document')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($mid = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $mid);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        if (($docType = $this->strInput('docType')) !== '') {
            $query->where('doc_type', $docType);
        }
        if (($kw = $this->strInput('keyword')) !== '') {
            $kwMerchantIds = Db::table('merchant_info')
                ->where('merchant_name', 'like', "%{$kw}%")->pluck('id')->all();
            $query->where(function ($q) use ($kw, $kwMerchantIds) {
                $q->where('name', 'like', "%{$kw}%")
                    ->orWhere('doc_type', 'like', "%{$kw}%");
                if ($kwMerchantIds !== []) {
                    $q->orWhereIn('merchant_id', $kwMerchantIds);
                }
            });
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();

        // 统计卡(不受 keyword/status/docType 过滤影响,仅站点口径,可作点击入口)
        $statsQuery = Db::table('merchant_verify_document')->whereNull('deleted_at');
        $this->applySiteScope($statsQuery);
        $grouped = [];
        foreach ($statsQuery->selectRaw('status, count(*) as cnt')->groupBy('status')->get() as $row) {
            $grouped[(int) $row->status] = (int) $row->cnt;
        }
        $stats = [
            'total' => (int) (clone $statsQuery)->count(),
            'verified' => $grouped[1] ?? 0,
            'pending' => $grouped[2] ?? 0,
            'expired' => $grouped[4] ?? 0,
            'resubmission' => $grouped[5] ?? 0,
        ];

        // 补充商户名与临期标记(≤30 天且未过期 → expiring soon)
        $ids = array_column($list, 'merchant_id');
        $names = $ids === [] ? [] : Db::table('merchant_info')->whereIn('id', $ids)->pluck('merchant_name', 'id')->all();
        $now = time();
        foreach ($list as &$row) {
            $row['merchant_name'] = (string) ($names[$row['merchant_id']] ?? '');
            $row['expiring_soon'] = 0;
            if (! empty($row['expiry_date'])) {
                $ts = strtotime((string) $row['expiry_date']);
                if ($ts !== false && $ts >= $now && $ts - $now <= 30 * 86400) {
                    $row['expiring_soon'] = 1;
                }
            }
        }
        unset($row);

        return Result::success([
            'list' => $list,
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
            'stats' => $stats,
        ]);
    }

    /** 文档详情(模块 03 Merchant Documents):文档元信息 + 核验历史时间线 */
    #[Permission('merchant:doc:list')]
    public function documentDetail(): array
    {
        $docId = $this->requireId('docId');
        $doc = Db::table('merchant_verify_document')->where('id', $docId)->whereNull('deleted_at')->first();
        if (! $doc) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '文档不存在');
        }
        $doc = (array) $doc;
        $this->assertSiteScope((int) $doc['site_id']);
        // 入驻阶段文档 merchant_id=0(application 维度),仅正式商户文档需 findMerchant
        $merchant = ['id' => (int) $doc['merchant_id'], 'site_id' => (int) $doc['site_id'], 'merchant_name' => (string) ($doc['name'] ?? '')];
        if ((int) $doc['merchant_id'] > 0) {
            $merchant = $this->findMerchant((int) $doc['merchant_id']);
        }
        $applicationId = (int) ($doc['application_id'] ?? 0);
        $doc['merchant_name'] = $merchant['merchant_name'];

        // 核验历史:上传 → 重交版本 → 核验通过/驳回 → 过期(时间线由文档本身字段+重交版本合成)
        $history = [];
        if (! empty($doc['uploaded_at'])) {
            $history[] = ['date' => $doc['uploaded_at'], 'action' => 'Document uploaded', 'by' => 'Merchant', 'note' => 'Initial submission'];
        }
        $revisions = Db::table('merchant_verify_document_revision')
            ->where('doc_id', $docId)->orderBy('version')->get();
        foreach ($revisions as $rev) {
            $history[] = [
                'date' => (string) $rev->uploaded_at,
                'action' => 'Document resubmitted',
                'by' => 'Merchant',
                'note' => 'Version ' . (int) $rev->version,
            ];
        }
        if (! empty($doc['last_verified_at'])) {
            $history[] = [
                'date' => $doc['last_verified_at'],
                'action' => 'Document verified',
                'by' => $doc['reviewer_name'] !== '' ? $doc['reviewer_name'] : 'Reviewer',
                'note' => 'All details confirmed valid',
            ];
        }
        if ($doc['reject_reason'] !== '') {
            $history[] = [
                'date' => (string) $doc['updated_at'],
                'action' => 'Document rejected',
                'by' => $doc['reviewer_name'] !== '' ? $doc['reviewer_name'] : 'Reviewer',
                'note' => (string) $doc['reject_reason'],
            ];
        }
        if ((int) $doc['status'] === 4) {
            $history[] = [
                'date' => (string) $doc['updated_at'],
                'action' => 'Document expired',
                'by' => 'System',
                'note' => '',
            ];
        }

        return Result::success(['document' => $doc, 'history' => $history]);
    }

    /** 文档级要求重交(模块 03 Merchant Documents):文档置「需重交」+ 原因 + 审计 */
    #[Permission('merchant:verify:resubmit')]
    public function documentResubmit(): array
    {
        $docId = $this->requireId('docId');
        $doc = Db::table('merchant_verify_document')->where('id', $docId)->whereNull('deleted_at')->first();
        if (! $doc) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '文档不存在');
        }
        $doc = (array) $doc;
        $this->assertSiteScope((int) $doc['site_id']);
        $merchant = $this->findMerchant((int) $doc['merchant_id']);
        $reason = $this->requireStr('reason');

        Db::table('merchant_verify_document')->where('id', $docId)->update([
            'status' => 5,
            'reject_reason' => mb_substr($reason, 0, 255),
            'resubmit_required_at' => date('Y-m-d H:i:s'),
        ]);
        $this->pushTimeline($merchant, 'resubmit_requested', $doc['name'] . ':' . $reason);
        $this->pushActivity($merchant, 'verification', '要求文档重新提交:' . $doc['name']);
        return Result::success(null, '已通知商户重新提交文档');
    }

    /** 拉黑商户:记录黑名单 + 商户置暂停(status=4);区分「暂停」与「拉黑」 */
    #[Permission('merchant:list:status')]
    public function blacklist(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        if ((int) $merchant['status'] === 5) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已注销商户不可拉黑');
        }
        $reason = $this->requireStr('reason');
        $evidence = $this->strInput('evidence');
        Db::transaction(function () use ($merchant, $reason, $evidence) {
            Db::table('merchant_blacklist')->insert([
                'site_id' => (int) $merchant['site_id'],
                'merchant_id' => (int) $merchant['id'],
                'reason' => mb_substr($reason, 0, 255),
                'evidence' => mb_substr($evidence, 0, 500),
                'operator_id' => AdminContext::adminId(),
                'operator_name' => AdminContext::adminName(),
                'status' => 1,
            ]);
            Db::table('merchant_info')->where('id', $merchant['id'])->update(['status' => 4]);
        });
        $this->pushTimeline($merchant, 'blacklisted', $reason, 2, true);
        $this->pushActivity($merchant, 'blacklist', '商户已拉黑:' . $reason);
        return Result::success(null, '商户已拉黑');
    }

    /** 移出黑名单:失效黑名单记录 + 商户恢复启用 */
    #[Permission('merchant:list:status')]
    public function unblacklist(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        Db::transaction(function () use ($merchant) {
            Db::table('merchant_blacklist')
                ->where('merchant_id', $merchant['id'])->where('status', 1)
                ->update([
                    'status' => 2,
                    'removed_at' => date('Y-m-d H:i:s'),
                    'removed_by' => AdminContext::adminId(),
                ]);
            Db::table('merchant_info')->where('id', $merchant['id'])->update(['status' => 3]);
        });
        $this->pushTimeline($merchant, 'unblacklisted', '');
        $this->pushActivity($merchant, 'reactivation', '商户移出黑名单并恢复启用');
        return Result::success(null, '已移出黑名单');
    }

    /**
     * 商户活动审计(模块 03 Merchant Activities):类型/日期/管理员/商户/关键词筛选
     * 返回 data 含 stats(活动类型计数条:total/login/suspension/verification/warning/document_upload/profile_update,站点口径)
     */
    #[Permission('merchant:activity:list')]
    public function activities(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_activity_log');
        $this->applySiteScope($query);
        if (($mid = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $mid);
        }
        if (($type = $this->strInput('activityType')) !== '') {
            $query->where('activity_type', $type);
        }
        if (($admin = $this->strInput('admin')) !== '') {
            $query->where('performed_by', $admin);
        }
        if (($merchant = $this->strInput('merchant')) !== '') {
            $merchantIds = Db::table('merchant_info')
                ->where('merchant_name', 'like', "%{$merchant}%")->pluck('id')->all();
            $query->whereIn('merchant_id', $merchantIds === [] ? [0] : $merchantIds);
        }
        $dateRange = $this->strInput('dateRange');
        if ($dateRange !== '') {
            $days = match ($dateRange) {
                'today' => 0,
                '7d' => 7,
                '30d' => 30,
                default => -1,
            };
            if ($days >= 0) {
                $from = $days === 0 ? date('Y-m-d 00:00:00') : date('Y-m-d H:i:s', strtotime("-{$days} days"));
                $query->where('created_at', '>=', $from);
            }
        }
        if (($kw = $this->strInput('keyword')) !== '') {
            $kwMerchantIds = Db::table('merchant_info')
                ->where('merchant_name', 'like', "%{$kw}%")->pluck('id')->all();
            $query->where(function ($q) use ($kw, $kwMerchantIds) {
                $q->where('description', 'like', "%{$kw}%")
                    ->orWhere('performed_by', 'like', "%{$kw}%");
                if ($kwMerchantIds !== []) {
                    $q->orWhereIn('merchant_id', $kwMerchantIds);
                }
            });
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();

        // 活动类型计数条(仅站点口径,不受筛选影响)
        $statsQuery = Db::table('merchant_activity_log');
        $this->applySiteScope($statsQuery);
        $grouped = [];
        foreach ($statsQuery->selectRaw('activity_type, count(*) as cnt')->groupBy('activity_type')->get() as $row) {
            $grouped[(string) $row->activity_type] = (int) $row->cnt;
        }
        $stats = ['total' => (int) (clone $statsQuery)->count()];
        foreach (['login', 'suspension', 'verification', 'warning', 'document_upload', 'profile_update'] as $chipType) {
            $stats[$chipType] = $grouped[$chipType] ?? 0;
        }

        // 补充商户名
        $ids = array_column($list, 'merchant_id');
        $names = $ids === [] ? [] : Db::table('merchant_info')->whereIn('id', $ids)->pluck('merchant_name', 'id')->all();
        foreach ($list as &$row) {
            $row['merchant_name'] = (string) ($names[$row['merchant_id']] ?? '');
        }
        unset($row);

        return Result::success([
            'list' => $list,
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
            'stats' => $stats,
        ]);
    }

    /** 黑名单商户列表(模块 03 Blacklisted):活跃黑名单记录 + 商户名 */
    #[Permission('merchant:list:list')]
    public function blacklistList(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_blacklist')->where('status', 1);
        $siteId = AdminContext::scopeSiteId($this->intInput('siteId'));
        if ($siteId !== null && $siteId > 0) {
            $query->where('site_id', $siteId);
        }
        $total = (clone $query)->count();
        $rows = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        $ids = array_column($rows, 'merchant_id');
        $names = $ids === [] ? [] : Db::table('merchant_info')->whereIn('id', $ids)->pluck('merchant_name', 'id')->all();
        foreach ($rows as &$row) {
            $row['merchant_name'] = (string) ($names[$row['merchant_id']] ?? '');
        }
        return Result::page($rows, $total, $page, $pageSize);
    }

    // ── 私有助手 ──────────────────────────────────────────────

    /** 取商户并校验站点数据权限 */
    private function findMerchant(int $id): array
    {
        $merchant = Db::table('merchant_info')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $merchant) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商户不存在');
        }
        $merchant = (array) $merchant;
        $this->assertSiteScope((int) $merchant['site_id']);
        return $merchant;
    }

    /** 写审核时间线 */
    private function pushTimeline(array $merchant, string $action, string $note = '', int $actorType = 2, bool $exception = false, int $applicationId = 0): void
    {
        Db::table('merchant_verify_timeline')->insert([
            'site_id' => (int) $merchant['site_id'],
            'merchant_id' => (int) $merchant['id'],
            'application_id' => $applicationId,
            'action' => $action,
            'actor_type' => $actorType,
            'operator_id' => AdminContext::adminId(),
            'operator_name' => AdminContext::adminName(),
            'note' => mb_substr($note, 0, 500),
            'is_exception' => $exception ? 1 : 0,
        ]);
    }

    /** 写商户活动日志 */
    private function pushActivity(array $merchant, string $type, string $desc, int $status = 1): void
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

    /** 写访问码操作日志(PRD 模块 11:访问码操作必须记录审计) */
    private function pushAccessCodeLog(array $merchant, string $action, string $channels): void
    {
        Db::table('merchant_access_code_log')->insert([
            'site_id' => (int) $merchant['site_id'],
            'merchant_id' => (int) $merchant['id'],
            'action' => $action,
            'channels' => $channels,
            'operator_id' => AdminContext::adminId(),
            'operator_name' => AdminContext::adminName(),
        ]);
    }
}
