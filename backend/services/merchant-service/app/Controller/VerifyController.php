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
                    ->orWhere('contact_name', 'like', "%{$kw}%");
            });
        }
        if (($type = $this->intInput('merchantType')) > 0) {
            $query->where('merchant_type', $type);
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

    /** 验证详情:商户核心 + 资质文档 + 时间线 */
    #[Permission('merchant:list:audit')]
    public function detail(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        $merchant['contact_phone'] = AdminContext::isSuper()
            ? $this->decryptField((string) $merchant['contact_phone'])
            : MaskHelper::mobile($this->decryptField((string) $merchant['contact_phone']));
        $merchant['legal_id_card'] = MaskHelper::idCard($this->decryptField((string) $merchant['legal_id_card']));
        unset($merchant['legal_id_images'], $merchant['deleted_at']);

        $documents = Db::table('merchant_verify_document')
            ->where('merchant_id', $merchant['id'])->whereNull('deleted_at')
            ->orderBy('id')->get()
            ->map(static fn ($r) => (array) $r)->all();
        $timeline = Db::table('merchant_verify_timeline')
            ->where('merchant_id', $merchant['id'])
            ->orderByDesc('id')->limit(100)->get()
            ->map(static fn ($r) => (array) $r)->all();

        return Result::success([
            'merchant' => $merchant,
            'documents' => $documents,
            'timeline' => $timeline,
        ]);
    }

    /** 通过验证:待审核/待重新提交 → 已启用(生成商户主账号) */
    #[Permission('merchant:verify:approve')]
    public function approve(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        if (! in_array((int) $merchant['status'], [0, 6], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核/待重新提交商户可通过');
        }
        $remark = $this->strInput('remark');
        $account = $this->service->approve($merchant, $remark);
        $this->pushTimeline($merchant, 'approved', $remark);
        $this->pushActivity($merchant, 'verification', '商户验证通过');
        return Result::success($account, '审核通过,商户账号已生成');
    }

    /** 驳回验证:必填原因 → 审核驳回(商户可修改重提) */
    #[Permission('merchant:verify:reject')]
    public function reject(): array
    {
        $merchant = $this->findMerchant($this->requireId());
        if (! in_array((int) $merchant['status'], [0, 6], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审核/待重新提交商户可驳回');
        }
        $reason = $this->requireStr('reason');
        $this->service->reject($merchant, $reason);
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
        $this->pushTimeline($merchant, 'resubmit_requested', $comment);
        $this->pushActivity($merchant, 'verification', '要求重新提交:' . $comment);
        return Result::success(null, '已通知商户重新提交');
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
        $merchant = $this->findMerchant((int) $doc['merchant_id']);

        $action = $this->strInput('action');
        if ($action === 'verify') {
            Db::table('merchant_verify_document')->where('id', $docId)->update([
                'status' => 1,
                'reviewer_id' => AdminContext::adminId(),
                'reviewer_name' => AdminContext::adminName(),
                'last_verified_at' => date('Y-m-d H:i:s'),
                'reject_reason' => '',
            ]);
            $this->pushTimeline($merchant, 'doc_verified', (string) $doc['name']);
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
            $this->pushTimeline($merchant, 'doc_rejected', $doc['name'] . ':' . $reason, 2, true);
            return Result::success(null, '文档已驳回');
        }
        throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 action 仅支持 verify/reject');
    }

    /** 商户文档库(模块 03 Merchant Documents):跨商户文档列表 + 状态/类型/关键词筛选 */
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
            $query->where('name', 'like', "%{$kw}%");
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
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

    /** 商户活动审计(模块 03 Merchant Activities):类型/商户/关键词筛选 */
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
        if (($kw = $this->strInput('keyword')) !== '') {
            $query->where('description', 'like', "%{$kw}%");
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
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
    private function pushTimeline(array $merchant, string $action, string $note = '', int $actorType = 2, bool $exception = false): void
    {
        Db::table('merchant_verify_timeline')->insert([
            'site_id' => (int) $merchant['site_id'],
            'merchant_id' => (int) $merchant['id'],
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
}
