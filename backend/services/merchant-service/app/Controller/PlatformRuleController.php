<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\MerchantComplianceService;
use App\Service\PlatformRuleService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class PlatformRuleController extends AbstractController
{
    #[Inject]
    protected PlatformRuleService $ruleService;

    #[Inject]
    protected MerchantComplianceService $complianceService;

    #[Permission(['platform:rule:list', 'platform:violation:record'])]
    public function rules(): array
    {
        $merchant = $this->intInput('merchantId') ? $this->complianceService->merchant($this->intInput('merchantId')) : null;
        if (! $merchant && ! AdminContext::hasPermission('platform:rule:list')) throw new BusinessException(ErrorCode::FORBIDDEN);
        $publishedOnly = $merchant !== null || ! AdminContext::isSuper();
        $q = Db::table('platform_rule as r')->whereNull('r.deleted_at')
            ->leftJoin('platform_rule_revision as e', 'e.id', '=', Db::raw('(SELECT x.id FROM platform_rule_revision x WHERE x.rule_id=r.id AND x.effective_at<=UTC_TIMESTAMP() ORDER BY x.version DESC LIMIT 1)'));
        $site = $merchant ? (int) $merchant->site_id : (AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId());
        if ($merchant || ! AdminContext::isSuper() || $site > 0) $q->whereIn('r.site_id', array_unique([0, $site]));
        if ($publishedOnly) $q->where('e.action', 'publish');
        if ($merchant) $q->whereRaw("NOT JSON_CONTAINS(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.snapshot_json,'$.exceptions_json')), '[]'), ?)", [(string) $merchant->id]);
        $title = $publishedOnly ? "JSON_UNQUOTE(JSON_EXTRACT(e.snapshot_json,'$.title'))" : 'r.title';
        $category = $publishedOnly ? "JSON_UNQUOTE(JSON_EXTRACT(e.snapshot_json,'$.category'))" : 'r.category';
        if ($this->strInput('keyword') !== '') $q->whereRaw($title . ' LIKE ?', ['%' . $this->strInput('keyword') . '%']);
        if ($this->strInput('category') !== '') $q->whereRaw($category . ' = ?', [$this->strInput('category')]);
        $state = "CASE WHEN e.action='publish' THEN 1 WHEN r.status=3 THEN 3 ELSE 2 END";
        if ($this->strInput('status') !== '') $q->whereRaw($state . ' = ?', [$this->intInput('status')]);
        [$page, $size] = $this->pageParams();
        $total = (clone $q)->count();
        $list = $q->select('r.*', 'e.snapshot_json', 'e.effective_at', 'e.id as effective_revision_id', 'e.version as effective_version')
            ->selectRaw($state . ' as effective_status')
            ->selectRaw('(SELECT x.effective_at FROM platform_rule_revision x WHERE x.rule_id=r.id AND x.effective_at>UTC_TIMESTAMP() AND x.version>COALESCE(e.version,0) ORDER BY x.version DESC LIMIT 1) as scheduled_at')
            ->orderByDesc('r.id')->forPage($page, $size)->get()->map(static function ($row) use ($publishedOnly) {
                $data = (array) $row;
                $effective = $data['effective_status'] == 1 ? json_decode($data['snapshot_json'] ?? '{}', true) : null;
                if ($publishedOnly && $effective) $data = array_replace($data, $effective, ['version' => $data['effective_version'], 'scheduled_at' => null]);
                $data['exception_merchant_ids'] = AdminContext::isSuper() ? json_decode($data['exceptions_json'] ?? '[]', true) : [];
                $data['effective_body'] = $effective['body'] ?? null;
                $data['editable'] = AdminContext::isSuper() && ! $publishedOnly;
                unset($data['snapshot_json'], $data['exceptions_json']);
                return $data;
            })->all();
        return Result::success(['list' => $list, 'total' => $total, 'page' => $page, 'pageSize' => $size, 'categories' => PlatformRuleService::CATEGORIES]);
    }

    #[Permission('platform:rule:list')]
    public function ruleHistory(): array
    {
        // Drafts, reasons and platform exception lists are super-admin-only.
        if (! AdminContext::isSuper()) throw new BusinessException(ErrorCode::FORBIDDEN);
        return $this->page(Db::table('platform_rule_revision')->where('rule_id', $this->requireId()));
    }

    #[Permission('platform:rule:save')]
    public function ruleSave(): array { return Result::success($this->ruleService->save($this->request->all())); }

    #[Permission('platform:rule:publish')]
    public function rulePublish(): array { return Result::success($this->ruleService->save($this->request->all(), $this->strInput('action'))); }

    #[Permission('platform:rule:publish')]
    public function ruleDelete(): array { return Result::success($this->ruleService->save($this->request->all(), 'archive')); }

    #[Permission('platform:violation:list')]
    public function violations(): array
    {
        $q = Db::table('merchant_violation as v')->leftJoin('merchant_info as m', 'm.id', '=', 'v.merchant_id')
            ->leftJoin('compliance_history as h', 'h.id', '=', Db::raw('(SELECT x.id FROM compliance_history x WHERE x.violation_id=v.id AND x.case_version IS NOT NULL ORDER BY x.case_version DESC LIMIT 1)'))
            ->select('v.*', 'm.status as merchant_status', 'm.status_version as merchant_status_version', 'h.action as latest_action')
            ->selectRaw('COALESCE(h.case_status,v.status) as status, COALESCE(h.case_version,0) as version')
            ->selectRaw("(m.active_suspension_id IS NOT NULL AND m.active_suspension_id=(SELECT x.merchant_status_history_id FROM compliance_history x WHERE x.violation_id=v.id AND x.action='suspend' ORDER BY x.id DESC LIMIT 1)) as can_restore");
        $this->filters($q, 'v');
        if ($this->strInput('status') !== '') $q->whereRaw('COALESCE(h.case_status,v.status)=?', [$this->intInput('status')]);
        return $this->page($q, 'v.id');
    }

    #[Permission('platform:violation:record')]
    public function violationRecord(): array { return $this->execute('record'); }

    #[Permission('platform:violation:handle')]
    public function violationHandle(): array
    {
        $action = $this->strInput('action');
        if (! in_array($action, ['resolve', 'reopen', 'suspend', 'restore'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR);
        return $this->execute($action);
    }

    #[Permission('platform:warning:list')]
    public function warnings(): array
    {
        $state = "CASE WHEN w.status=2 OR EXISTS(SELECT 1 FROM compliance_history x WHERE x.warning_id=w.id AND x.action='revoke') THEN 2 WHEN w.expires_at<UTC_DATE() THEN 3 ELSE 1 END";
        $q = Db::table('merchant_warning as w')->select('w.*')->selectRaw($state . ' as status, w.status as original_status')
            ->selectRaw('COALESCE((SELECT MAX(x.case_version) FROM compliance_history x WHERE x.violation_id=w.violation_id),0) as version');
        $this->filters($q, 'w');
        if ($this->strInput('status') !== '') $q->whereRaw($state . '=?', [$this->intInput('status')]);
        return $this->page($q, 'w.id');
    }

    #[Permission('platform:warning:issue')]
    public function warningIssue(): array { return $this->execute('warn'); }

    #[Permission('platform:warning:revoke')]
    public function warningRevoke(): array { return $this->execute('revoke'); }

    #[Permission('platform:compliance:list')]
    public function complianceHistory(): array
    {
        $q = Db::table('compliance_history as h')->select('h.id', 'h.site_id', 'h.merchant_id', 'h.merchant_name', 'h.violation_id', 'h.warning_id', 'h.rule_revision_id', 'h.category_code', 'h.action', 'h.event', 'h.note', 'h.result', 'h.reviewer', 'h.actor_type', 'h.created_at', 'h.case_version', 'h.case_status', 'h.merchant_status_history_id');
        $this->filters($q, 'h');
        if ($this->intInput('violationId')) $q->where('h.violation_id', $this->intInput('violationId'));
        if ($this->intInput('warningId')) $q->where('h.warning_id', $this->intInput('warningId'));
        if ($this->strInput('result') !== '') $q->where('h.result', $this->intInput('result'));
        if ($this->strInput('action') !== '') $q->where('h.action', $this->strInput('action'));
        return $this->page($q, 'h.id');
    }

    private function filters(object $q, string $alias): void
    {
        $site = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
        if (! AdminContext::isSuper() || $site > 0) $q->where($alias . '.site_id', $site);
        if ($this->intInput('merchantId')) $q->where($alias . '.merchant_id', $this->intInput('merchantId'));
        if ($this->strInput('category') !== '') $q->where($alias . '.category_code', $this->strInput('category'));
        if ($this->strInput('keyword') !== '') $q->where($alias . '.merchant_name', 'like', '%' . $this->strInput('keyword') . '%');
    }

    private function page(object $q, string $id = 'id'): array
    {
        [$page, $size] = $this->pageParams();
        $total = (clone $q)->count();
        return Result::page($q->orderByDesc($id)->forPage($page, $size)->get()->map(static fn ($r) => (array) $r)->all(), $total, $page, $size);
    }

    private function execute(string $action): array
    {
        return Result::success($this->complianceService->execute($action, $this->request->all(), $this->clientIp()));
    }
}
