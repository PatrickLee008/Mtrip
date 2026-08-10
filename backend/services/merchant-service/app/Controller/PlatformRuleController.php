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
 * 平台规则与合规(Super Admin Portal 模块 08,商户侧)
 * 路由前缀 /api/v1/admin/compliance/*(网关 map:compliance → merchant_service)
 */
class PlatformRuleController extends AbstractController
{
    // ── 平台规则 ───────────────────────────────────────────────

    #[Permission('platform:rule:list')]
    public function rules(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('platform_rule')->whereNull('deleted_at');
        $this->applySiteScope($query);
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        if (($cat = $this->strInput('category')) !== '') {
            $query->where('category', $cat);
        }
        if (($kw = $this->strInput('keyword')) !== '') {
            $query->where('title', 'like', "%{$kw}%");
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('platform:rule:save')]
    public function ruleSave(): array
    {
        $data = [
            'title' => $this->requireStr('title'),
            'category' => $this->strInput('category'),
            'severity' => $this->intInput('severity', 3),
            'status' => $this->intInput('status', 2),
            'applies' => $this->strInput('applies', 'All Merchants'),
        ];
        $id = $this->intInput('id');
        if ($id > 0) {
            Db::table('platform_rule')->where('id', $id)->whereNull('deleted_at')->update($data);
        } else {
            $data['site_id'] = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
            $data['created_by'] = AdminContext::adminName() ?: 'Admin';
            $id = (int) Db::table('platform_rule')->insertGetId($data);
        }
        return Result::success(['id' => $id], '已保存');
    }

    /** 发布/下线/归档:action=publish→1 unpublish→2 archive→3 */
    #[Permission('platform:rule:publish')]
    public function rulePublish(): array
    {
        $id = $this->requireId();
        $map = ['publish' => 1, 'unpublish' => 2, 'archive' => 3];
        $action = $this->strInput('action');
        if (! isset($map[$action])) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 action 仅支持 publish/unpublish/archive');
        }
        Db::table('platform_rule')->where('id', $id)->whereNull('deleted_at')->update(['status' => $map[$action]]);
        return Result::success(null, '已更新');
    }

    #[Permission('platform:rule:save')]
    public function ruleDelete(): array
    {
        Db::table('platform_rule')->where('id', $this->requireId())->whereNull('deleted_at')
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }

    // ── 商户违规 ───────────────────────────────────────────────

    #[Permission('platform:violation:list')]
    public function violations(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_violation');
        $this->applySiteScope($query);
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        if (($mid = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $mid);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 处置违规:status=1未处理 2已解决;可带 action 文案 */
    #[Permission('platform:violation:handle')]
    public function violationHandle(): array
    {
        $id = $this->requireId();
        $status = $this->intInput('status', 2);
        if (! in_array($status, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 status 不正确');
        }
        Db::table('merchant_violation')->where('id', $id)->update([
            'status' => $status,
            'action' => mb_substr($this->strInput('action'), 0, 100),
            'assigned_to' => AdminContext::adminName() ?: 'Admin',
        ]);
        return Result::success(null, '已处置');
    }

    // ── 商户警告 ───────────────────────────────────────────────

    #[Permission('platform:warning:list')]
    public function warnings(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('merchant_warning');
        $this->applySiteScope($query);
        if (($mid = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $mid);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('platform:warning:issue')]
    public function warningIssue(): array
    {
        $merchantId = $this->requireId('merchantId');
        $merchant = Db::table('merchant_info')->where('id', $merchantId)->whereNull('deleted_at')->first();
        if (! $merchant) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商户不存在');
        }
        $merchant = (array) $merchant;
        $this->assertSiteScope((int) $merchant['site_id']);
        $id = (int) Db::table('merchant_warning')->insertGetId([
            'site_id' => (int) $merchant['site_id'],
            'merchant_id' => $merchantId,
            'merchant_name' => (string) $merchant['merchant_name'],
            'reason' => $this->requireStr('reason'),
            'level' => $this->intInput('level', 1),
            'issued_by' => AdminContext::adminName() ?: 'Admin',
            'expires_at' => $this->strInput('expiresAt') ?: null,
            'status' => 1,
        ]);
        return Result::success(['id' => $id], '警告已签发');
    }

    #[Permission('platform:warning:revoke')]
    public function warningRevoke(): array
    {
        Db::table('merchant_warning')->where('id', $this->requireId())->update(['status' => 2]);
        return Result::success(null, '警告已撤销');
    }

    // ── 合规历史 ───────────────────────────────────────────────

    #[Permission('platform:compliance:list')]
    public function complianceHistory(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('compliance_history');
        $this->applySiteScope($query);
        if (($mid = $this->intInput('merchantId')) > 0) {
            $query->where('merchant_id', $mid);
        }
        $result = $this->input('result');
        if ($result !== null && $result !== '') {
            $query->where('result', (int) $result);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }
}
