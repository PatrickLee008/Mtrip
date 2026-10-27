<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\SupportAccess;
use Mtrip\Shared\Support\SupportTicketPolicy as Policy;

class SupportContentService
{
    private function faqQuery(array $a)
    {
        return Db::connection('system')->table('help_article as a')->join('help_category as c', 'c.id', '=', 'a.category_id')
            ->whereIn('a.site_id', [0, (int) $a['site_id']])->whereIn('c.site_id', [0, (int) $a['site_id']])
            ->where('a.status', 1)->where('c.visible', 1)->whereIn('a.audience', ['merchant', 'all'])->whereNull('a.deleted_at')->whereNull('c.deleted_at');
    }

    public function faq(string $kind, array $input): array
    {
        $a = SupportAccess::requireMerchant();
        $q = $this->faqQuery($a);
        if ($kind === 'categories') return $q->selectRaw('c.id, c.name, COUNT(a.id) AS article_count')->groupBy('c.id', 'c.name', 'c.sort')->orderBy('c.sort')->orderBy('c.id')->get()->map(static fn ($r) => (array) $r)->all();
        if ($kind === 'detail') {
            $row = $q->where('a.id', Policy::integer($input, 'id'))->first(['a.id', 'a.title', 'a.content', 'a.updated_at', 'c.name as category_name']);
            if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND);
            return (array) $row;
        }
        if (($input['categoryId'] ?? '') !== '') $q->where('c.id', Policy::integer($input, 'categoryId'));
        if (($keyword = Policy::text($input, 'keyword', 200, false)) !== '') $q->where(static fn ($q) => $q->where('a.title', 'like', '%' . $keyword . '%')->orWhere('a.content', 'like', '%' . $keyword . '%'));
        return $this->page($q, $input, ['a.id', 'a.title', 'a.content', 'a.updated_at', 'c.name as category_name'], 'a.id');
    }

    private function merchant(array $input, bool $general): object
    {
        $a = SupportAccess::requireMerchant($general ? 'mch:support:merchant-scope' : 'mch:support:list');
        $id = Policy::integer($input, 'merchantId');
        if (! in_array($id, SupportAccess::merchants($a), true)) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        if (! $general && ! SupportAccess::permission($a, 'mch:support:merchant-scope')
            && ! Db::table('merchant_store')->where('merchant_id', $id)->whereIn('id', SupportAccess::properties($a))->exists()) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        $row = Db::table('merchant_info')->where('id', $id)->where('site_id', $a['site_id'])->whereNull('deleted_at')->first();
        if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND);
        return $row;
    }

    public function compliance(string $kind, array $input): array
    {
        $merchant = $this->merchant($input, $kind !== 'rules');
        $keyword = Policy::text($input, 'keyword', 200, false);
        if ($kind === 'rules') {
            $list = [];
            foreach (Db::table('platform_rule')->whereIn('site_id', [0, (int) $merchant->site_id])->whereNull('deleted_at')->orderBy('id')->pluck('id') as $id) {
                $rule = (new PlatformRuleService())->effective((int) $id);
                if (! $rule || ! in_array((int) $rule['site_id'], [0, (int) $merchant->site_id], true)
                    || in_array((int) $merchant->id, json_decode($rule['exceptions_json'] ?? '[]', true) ?? [], true)) continue;
                if ($keyword !== '' && mb_stripos($rule['title'] . ' ' . $rule['body'], $keyword) === false) continue;
                $list[] = array_intersect_key($rule + ['id' => (int) $id], array_flip(['id', 'title', 'body', 'category', 'severity', 'revision_id', 'version', 'effective_at']));
            }
            return ['list' => $list, 'total' => count($list)];
        }
        $violations = Db::table('merchant_violation')->where('merchant_id', $merchant->id)->where('site_id', $merchant->site_id);
        $warnings = Db::table('merchant_warning')->where('merchant_id', $merchant->id)->where('site_id', $merchant->site_id);
        $appeals = Db::table('merchant_support_ticket')->where('merchant_id', $merchant->id)->where('site_id', $merchant->site_id)->whereNull('property_id')->whereNotNull('violation_id');
        if ($kind === 'summary') return ['score' => null, 'penalty_points' => null, 'score_configured' => false, 'violations' => (clone $violations)->where('status', 1)->count(),
            'active_warnings' => (clone $warnings)->where('status', 1)->where(static fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>=', gmdate('Y-m-d')))->count(),
            'pending_appeal_tickets' => (clone $appeals)->whereIn('status', Policy::ACTIVE)->count()];
        if ($keyword !== '') { $violations->where('rule_title', 'like', '%' . $keyword . '%'); $warnings->where('reason', 'like', '%' . $keyword . '%'); $appeals->where('subject', 'like', '%' . $keyword . '%'); }
        if (($input['status'] ?? '') !== '' && in_array($kind, ['violations', 'warnings'], true)) {
            $status = Policy::integer($input, 'status');
            if (! in_array($status, [1, 2], true)) throw new BusinessException(ErrorCode::PARAM_ERROR);
            ($kind === 'violations' ? $violations : $warnings)->where('status', $status);
        }
        if ($kind === 'violations') return $this->page($violations, $input, ['id', 'rule_title', 'severity', 'status', 'detected_date', 'rule_revision_id', 'category_code', 'created_at']);
        if ($kind === 'warnings') {
            $data = $this->page($warnings, $input, ['id', 'violation_id', 'reason', 'level', 'status', 'expires_at', 'created_at']);
            foreach ($data['list'] as &$row) $row['effective_status'] = (int) $row['status'] === 2 ? 'revoked' : ($row['expires_at'] !== null && $row['expires_at'] < gmdate('Y-m-d') ? 'expired' : 'active');
            return $data;
        }
        return $this->page($appeals, $input, ['id', 'ticket_no', 'subject', 'status', 'violation_id', 'updated_at']);
    }

    private function page($q, array $input, array $columns, string $order = 'id'): array
    {
        $page = max(1, (int) ($input['page'] ?? 1)); $size = min(200, max(1, (int) ($input['pageSize'] ?? 20)));
        $total = (clone $q)->count();
        return ['list' => $q->orderByDesc($order)->forPage($page, $size)->get($columns)->map(static fn ($r) => (array) $r)->all(), 'total' => $total, 'page' => $page, 'pageSize' => $size];
    }
}
