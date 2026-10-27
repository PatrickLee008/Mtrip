<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\SupportAccess;
use Mtrip\Shared\Support\SupportTicketPolicy as Policy;

/** Both portals share this transaction boundary; replies and events are append-only. */
class SupportTicketService
{
    private function actor(string $type, string $action = 'list'): array
    {
        if ($type === 'merchant') {
            $a = SupportAccess::requireMerchant('mch:support:' . $action);
            return ['type' => $type, 'id' => (int) $a['id'], 'name' => $a['real_name'] ?: $a['username'], 'site_id' => (int) $a['site_id'], 'account' => $a];
        }
        $permission = $action === 'close' ? 'status' : $action;
        $a = SupportAccess::admin(AdminContext::adminId(), 'help:ticket:list');
        SupportAccess::admin((int) $a['id'], 'help:ticket:' . $permission);
        return ['type' => 'admin', 'id' => (int) $a['id'], 'name' => $a['real_name'] ?: $a['username'], 'site_id' => (int) $a['site_id'], 'account' => $a];
    }

    private function scope(array $actor, bool $selected = true): Builder
    {
        $q = Db::table('merchant_support_ticket as t');
        if ($actor['type'] === 'merchant') return SupportAccess::merchantScope($q, $actor['account'], 't', $selected);
        $a = $actor['account'];
        if (! ((int) $a['is_super'] === 1 && (int) $a['site_id'] === 0)) $q->where('t.site_id', $a['site_id']);
        return $q;
    }

    private function ticket(int $id, array $actor, bool $lock = false): array
    {
        $q = $this->scope($actor)->where('t.id', $id);
        if ($lock) $q->lockForUpdate();
        $row = $q->first();
        if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND);
        return (array) $row;
    }

    public function detail(string $type, int $id): array
    {
        $actor = $this->actor($type);
        $ticket = $this->ticket($id, $actor);
        $ticket['merchant_name'] = Db::table('merchant_info')->where('id', $ticket['merchant_id'])->value('merchant_name');
        $ticket['property_name'] = $ticket['property_id'] ? Db::table('merchant_store')->where('id', $ticket['property_id'])->value('store_name') : null;
        $ticket['assignee_name'] = $ticket['assigned_admin_id'] ? Db::connection('system')->table('sys_admin')->where('id', $ticket['assigned_admin_id'])->value('real_name') : null;
        $ticket['attachments'] = $this->attachments($id, null);
        $ticket['capabilities'] = $this->capabilities($actor);
        return $ticket;
    }

    public function notificationTarget(int $id): array
    {
        $row = $this->scope($this->actor('merchant'), false)->where('t.id', $id)->first();
        if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND);
        return (array) $row;
    }

    private function capabilities(array $actor): array
    {
        $result = [];
        foreach ($actor['type'] === 'merchant' ? SupportAccess::ACTIONS : ['list', 'reply', 'assign', 'priority', 'status', 'reopen'] as $action) {
            if ($actor['type'] === 'merchant') $result[$action] = SupportAccess::permission($actor['account'], 'mch:support:' . $action);
            else {
                try { SupportAccess::admin($actor['id'], 'help:ticket:' . $action); $result[$action] = true; }
                catch (BusinessException) { $result[$action] = false; }
            }
        }
        return $result;
    }

    public function options(string $type): array
    {
        $actor = $this->actor($type);
        $result = ['categories' => Policy::CATEGORIES, 'priorities' => Policy::PRIORITIES, 'states' => Policy::STATES,
            'maxAttachments' => Policy::MAX_ATTACHMENTS, 'maxFileBytes' => Policy::MAX_FILE_BYTES,
            'extensions' => ['pdf', 'jpg', 'jpeg', 'png', 'xlsx'], 'capabilities' => $this->capabilities($actor)];
        if ($type === 'merchant') {
            $result['merchants'] = Db::table('merchant_info')->whereIn('id', SupportAccess::merchants($actor['account']))->get(['id', 'merchant_name'])->map(static fn ($r) => (array) $r)->all();
            $result['properties'] = Db::table('merchant_store')->whereIn('id', SupportAccess::properties($actor['account']))->get(['id', 'merchant_id', 'store_name', 'business_type'])->map(static fn ($r) => (array) $r)->all();
        }
        return $result;
    }

    public function listing(string $type, array $input, bool $summary = false): array
    {
        $actor = $this->actor($type);
        $q = $this->scope($actor);
        foreach (['merchantId' => 'merchant_id', 'propertyId' => 'property_id', 'siteId' => 'site_id'] as $key => $column) {
            if (isset($input[$key]) && $input[$key] !== '') $q->where('t.' . $column, Policy::integer($input, $key));
        }
        if (($input['scope'] ?? '') === 'general') $q->whereNull('t.property_id');
        if ($summary) {
            $counts = $q->selectRaw('t.status, COUNT(*) AS total')->groupBy('t.status')->pluck('total', 'status')->all();
            return ['open' => (int) ($counts['open'] ?? 0) + (int) ($counts['in_progress'] ?? 0), 'waiting_merchant' => (int) ($counts['waiting_merchant'] ?? 0),
                'waiting_support' => (int) ($counts['waiting_support'] ?? 0), 'completed' => (int) ($counts['resolved'] ?? 0) + (int) ($counts['closed'] ?? 0)];
        }
        if (($kw = Policy::text($input, 'keyword', 200, false)) !== '') $q->where(static fn ($q) => $q->where('t.ticket_no', 'like', '%' . $kw . '%')->orWhere('t.subject', 'like', '%' . $kw . '%'));
        foreach (['category' => Policy::CATEGORIES, 'priority' => Policy::PRIORITIES] as $key => $values) {
            if (($input[$key] ?? '') !== '') {
                if (! in_array($input[$key], $values, true)) throw new BusinessException(ErrorCode::PARAM_ERROR);
                $q->where('t.' . $key, $input[$key]);
            }
        }
        if (($input['status'] ?? '') !== '') {
            if (! is_string($input['status'])) throw new BusinessException(ErrorCode::PARAM_ERROR);
            $states = explode(',', $input['status']);
            if (array_diff($states, Policy::STATES)) throw new BusinessException(ErrorCode::PARAM_ERROR);
            $q->whereIn('t.status', $states);
        }
        foreach (['dateFrom' => '>=', 'dateTo' => '<='] as $key => $operator) {
            if (($input[$key] ?? '') !== '') {
                $date = Policy::text($input, $key, 10);
                $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
                if (! $parsed || $parsed->format('Y-m-d') !== $date) throw new BusinessException(ErrorCode::PARAM_ERROR);
                $q->where('t.created_at', $operator, $date . ($key === 'dateFrom' ? ' 00:00:00' : ' 23:59:59'));
            }
        }
        $page = max(1, (int) ($input['page'] ?? 1)); $size = min(200, max(1, (int) ($input['pageSize'] ?? 20)));
        $total = (clone $q)->count();
        $list = $q->leftJoin('merchant_info as m', 'm.id', '=', 't.merchant_id')->leftJoin('merchant_store as p', 'p.id', '=', 't.property_id')
            ->orderByDesc('t.updated_at')->orderByDesc('t.id')->forPage($page, $size)
            ->get(['t.id', 't.ticket_no', 't.site_id', 't.merchant_id', 't.property_id', 't.category', 't.subject', 't.priority', 't.status', 't.version', 't.assigned_admin_id', 't.created_at', 't.updated_at', 'm.merchant_name', 'p.store_name as property_name'])
            ->map(static fn ($r) => (array) $r)->all();
        $names = Db::connection('system')->table('sys_admin')->whereIn('id', array_filter(array_column($list, 'assigned_admin_id')))->pluck('real_name', 'id')->all();
        foreach ($list as &$row) $row['assignee_name'] = $names[$row['assigned_admin_id']] ?? null;
        return ['list' => $list, 'total' => $total, 'page' => $page, 'pageSize' => $size];
    }

    public function history(string $type, array $input, bool $events): array
    {
        $id = Policy::integer($input, 'ticketId');
        $this->ticket($id, $this->actor($type));
        $q = Db::table($events ? 'merchant_support_event' : 'merchant_support_reply')->where('ticket_id', $id);
        if (isset($input['afterId'])) $q->where('id', '>', Policy::integer($input, 'afterId', 0));
        $page = max(1, (int) ($input['page'] ?? 1)); $size = min(200, max(1, (int) ($input['pageSize'] ?? 20)));
        $total = (clone $q)->count();
        $rows = $q->orderBy('id')->forPage($page, $size)->get()->map(function ($r) use ($events, $id) {
            $row = (array) $r;
            if ($events) { $row['changes'] = json_decode($row['changes_json'], true); unset($row['changes_json']); }
            else $row['attachments'] = $this->attachments($id, (int) $row['id']);
            return $row;
        })->all();
        return ['list' => $rows, 'total' => $total, 'page' => $page, 'pageSize' => $size];
    }

    public function assignees(string $type, int $id): array
    {
        $ticket = $this->ticket($id, $this->actor($type));
        if ($type !== 'admin') throw new BusinessException(ErrorCode::FORBIDDEN);
        $result = [];
        foreach (Db::connection('system')->table('sys_admin')->where('status', 1)->whereNull('deleted_at')
            ->where(static fn ($q) => $q->where('site_id', $ticket['site_id'])->orWhere(static fn ($q) => $q->where('site_id', 0)->where('is_super', 1)))->get() as $row) {
            try { $a = SupportAccess::admin((int) $row->id, 'help:ticket:list', (int) $ticket['site_id']); SupportAccess::admin((int) $row->id, 'help:ticket:reply', (int) $ticket['site_id']); }
            catch (BusinessException) { continue; }
            $result[] = ['id' => (int) $a['id'], 'name' => $a['real_name'] ?: $a['username']];
        }
        return $result;
    }

    public function mutate(string $type, string $action, array $input): array
    {
        $this->actor($type, $action);
        $request = Policy::text($input, 'requestId', 64);
        if (! preg_match('/^[A-Za-z0-9_-]{8,64}$/D', $request)) throw new BusinessException(ErrorCode::PARAM_ERROR, 'requestId无效');
        $canonical = $input; ksort($canonical);
        $hash = hash('sha256', json_encode([$action, $canonical], JSON_THROW_ON_ERROR));
        return Db::transaction(function () use ($type, $action, $input, $request, $hash) {
            $actor = $this->actor($type, $action);
            $key = ['site_id' => $actor['site_id'], 'actor_type' => $type, 'actor_id' => $actor['id'], 'request_id' => $request];
            Db::table('merchant_support_request')->insertOrIgnore($key + ['payload_hash' => $hash]);
            $old = Db::table('merchant_support_request')->where($key)->lockForUpdate()->first();
            if ($old->payload_hash !== $hash) throw new BusinessException(ErrorCode::DATA_CONFLICT, '同一请求号内容不同');
            if ($old->result_json !== null) {
                // A concurrent identical request may have committed after this transaction's first read.
                $this->ticket((int) $old->ticket_id, $actor, true);
                return json_decode($old->result_json, true, 512, JSON_THROW_ON_ERROR);
            }
            if ($action === 'create') {
                if ($type !== 'merchant') throw new BusinessException(ErrorCode::FORBIDDEN);
                $scope = $this->creationScope($input, $actor);
                $category = Policy::text($input, 'category', 30); $priority = Policy::text($input, 'priority', 10);
                if (! in_array($category, Policy::CATEGORIES, true) || ! in_array($priority, Policy::PRIORITIES, true)) throw new BusinessException(ErrorCode::PARAM_ERROR);
                $violation = isset($input['violationId']) && $input['violationId'] !== null ? Policy::integer($input, 'violationId') : null;
                if ($violation && ($scope['property_id'] !== null || ! SupportAccess::permission($actor['account'], 'mch:support:merchant-scope')
                    || ! Db::table('merchant_violation')->where('id', $violation)->where('merchant_id', $scope['merchant_id'])->where('site_id', $scope['site_id'])->exists())) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
                $now = gmdate('Y-m-d H:i:s');
                $id = (int) Db::table('merchant_support_ticket')->insertGetId($scope + ['category' => $category, 'priority' => $priority,
                    'subject' => Policy::text($input, 'subject', 200), 'description' => Policy::text($input, 'description', 10000),
                    'created_by' => $actor['id'], 'creator_name' => $actor['name'], 'violation_id' => $violation, 'created_at' => $now, 'updated_at' => $now]);
                Db::table('merchant_support_ticket')->where('id', $id)->update(['ticket_no' => 'TK' . gmdate('Ymd') . '-' . str_pad((string) $id, 8, '0', STR_PAD_LEFT)]);
                $ticket = $this->ticket($id, $actor, true);
                $this->bind($input, $ticket, $actor, null);
                $this->event($ticket, $actor, 'create', [], '');
            } else {
                $ticket = $this->ticket(Policy::integer($input, 'ticketId'), $actor, true);
                if (Policy::integer($input, 'expectedVersion') !== (int) $ticket['version']) throw new BusinessException(ErrorCode::DATA_CONFLICT, '工单已更新，请刷新');
                $ticket = $this->change($ticket, $actor, $action, $input);
            }
            $result = ['id' => (int) $ticket['id'], 'ticket_no' => $ticket['ticket_no'], 'version' => (int) $ticket['version'], 'status' => $ticket['status']];
            Db::table('merchant_support_request')->where($key)->update(['ticket_id' => $ticket['id'], 'result_json' => json_encode($result, JSON_THROW_ON_ERROR)]);
            return $result;
        });
    }

    public function creationScope(array $input, array $actor): array
    {
        $mid = Policy::integer($input, 'merchantId');
        $pid = isset($input['propertyId']) && $input['propertyId'] !== null && $input['propertyId'] !== '' ? Policy::integer($input, 'propertyId') : null;
        if (! in_array($mid, SupportAccess::merchants($actor['account']), true)) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        if ($pid !== null) {
            if (! in_array($pid, SupportAccess::properties($actor['account']), true)
                || ! Db::table('merchant_store')->where('id', $pid)->where('merchant_id', $mid)->where('site_id', $actor['site_id'])->exists()) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        } elseif (! SupportAccess::permission($actor['account'], 'mch:support:merchant-scope')) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        $selected = MerchantContext::selectedPropertyId();
        if ($selected > 0 && $selected !== $pid) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        return ['site_id' => $actor['site_id'], 'merchant_id' => $mid, 'property_id' => $pid];
    }

    private function validAssignee(int $id, int $site): bool
    {
        try { SupportAccess::admin($id, 'help:ticket:list', $site); SupportAccess::admin($id, 'help:ticket:reply', $site); return true; }
        catch (BusinessException) { return false; }
    }

    private function change(array $ticket, array $actor, string $action, array $input): array
    {
        $changes = []; $reason = ''; $requested = Policy::text($input, 'status', 30, false);
        $metadata = $actor['type'] === 'admin' && in_array($action, ['assign', 'priority', 'status'], true);
        // The platform editor saves selected fields together under the same lock and version.
        if ($action === 'assign' || ($metadata && array_key_exists('assigneeId', $input))) {
            SupportAccess::admin($actor['id'], 'help:ticket:assign', (int) $ticket['site_id']);
            $id = Policy::integer($input, 'assigneeId', 0);
            if ($id > 0 && ! $this->validAssignee($id, (int) $ticket['site_id'])) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '客服不可指派');
            $changes['assigned_admin_id'] = $id ?: null;
        }
        if ($action === 'reopen' && $ticket['assigned_admin_id'] && ! $this->validAssignee((int) $ticket['assigned_admin_id'], (int) $ticket['site_id'])) $changes['assigned_admin_id'] = null;
        $assigned = (bool) ($changes['assigned_admin_id'] ?? $ticket['assigned_admin_id']);
        if (array_key_exists('assigned_admin_id', $changes)) $assigned = (bool) $changes['assigned_admin_id'];
        $target = Policy::target($ticket['status'], $actor['type'], $action, $requested, $assigned);
        if ($actor['type'] === 'admin' && $action === 'reply' && $target === 'resolved') SupportAccess::admin($actor['id'], 'help:ticket:status', (int) $ticket['site_id']);
        if ($action === 'priority' || ($metadata && array_key_exists('priority', $input))) {
            SupportAccess::admin($actor['id'], 'help:ticket:priority', (int) $ticket['site_id']);
            $priority = Policy::text($input, 'priority', 10);
            if (! in_array($priority, Policy::PRIORITIES, true)) throw new BusinessException(ErrorCode::PARAM_ERROR);
            $changes['priority'] = $priority;
        }
        if (in_array($action, ['close', 'reopen', 'status'], true)) $reason = Policy::text($input, 'reason', 5000);
        if ($action === 'reply') {
            $content = Policy::text($input, 'content', 5000, false);
            if ($content === '' && empty($input['attachmentIds'])) throw new BusinessException(ErrorCode::PARAM_ERROR, '回复不能为空');
            if ($target === 'resolved' && $content === '') throw new BusinessException(ErrorCode::PARAM_ERROR, '解决工单需要处理说明');
            $reply = (int) Db::table('merchant_support_reply')->insertGetId(['ticket_id' => $ticket['id'], 'actor_type' => $actor['type'],
                'actor_id' => $actor['id'], 'actor_name' => $actor['name'], 'content' => $content]);
            $this->bind($input, $ticket, $actor, $reply);
        }
        $now = gmdate('Y-m-d H:i:s');
        $changes += ['status' => $target, 'version' => (int) $ticket['version'] + 1, 'updated_at' => $now];
        if ($target === 'resolved') $changes['resolved_at'] = $now;
        if ($target === 'closed') $changes['closed_at'] = $now;
        if ($action === 'reopen') { $changes['resolved_at'] = null; $changes['closed_at'] = null; }
        Db::table('merchant_support_ticket')->where('id', $ticket['id'])->update($changes);
        $next = array_replace($ticket, $changes);
        $history = [];
        foreach (['status', 'priority', 'assigned_admin_id'] as $field) if ($ticket[$field] !== $next[$field]) $history[$field] = ['from' => $ticket[$field], 'to' => $next[$field]];
        if ($action === 'reopen' && array_key_exists('assigned_admin_id', $changes) && $changes['assigned_admin_id'] === null) $history['assignee_cleared'] = 'inactive_or_permission_revoked';
        $this->event($next, $actor, $action, $history, $reason);
        return $next;
    }

    private function bind(array $input, array $ticket, array $actor, ?int $reply): void
    {
        $ids = $input['attachmentIds'] ?? [];
        if (! is_array($ids) || count($ids) > Policy::MAX_ATTACHMENTS) throw new BusinessException(ErrorCode::PARAM_ERROR);
        foreach ($ids as $id) Policy::integer(['id' => $id], 'id');
        $ids = array_unique(array_map('intval', $ids)); sort($ids);
        foreach ($ids as $id) {
            $row = Db::table('merchant_support_attachment')->where('id', $id)->lockForUpdate()->first();
            if (! $row || $row->bound_at !== null || $row->actor_type !== $actor['type'] || (int) $row->actor_id !== $actor['id']
                || (int) $row->site_id !== (int) $ticket['site_id'] || (int) $row->merchant_id !== (int) $ticket['merchant_id'] || (int) $row->property_id !== (int) $ticket['property_id']
                || ($row->ticket_id !== null && (int) $row->ticket_id !== (int) $ticket['id']) || $row->created_at < gmdate('Y-m-d H:i:s', time() - 86400)) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '附件无效或已绑定');
            Db::table('merchant_support_attachment')->where('id', $id)->update(['ticket_id' => $ticket['id'], 'reply_id' => $reply, 'bound_at' => gmdate('Y-m-d H:i:s')]);
        }
    }

    private function attachments(int $ticket, ?int $reply): array
    {
        return Db::table('merchant_support_attachment')->where('ticket_id', $ticket)->where('reply_id', $reply)->whereNotNull('bound_at')
            ->get(['id', 'filename', 'mime', 'size'])->map(static fn ($r) => (array) $r)->all();
    }

    private function event(array $ticket, array $actor, string $action, array $changes, string $reason): void
    {
        $id = (int) Db::table('merchant_support_event')->insertGetId(['ticket_id' => $ticket['id'], 'actor_type' => $actor['type'], 'actor_id' => $actor['id'],
            'actor_name' => $actor['name'], 'action' => $action, 'changes_json' => json_encode($changes, JSON_THROW_ON_ERROR), 'reason' => $reason, 'version' => $ticket['version']]);
        if ($action === 'create') return;
        $group = (int) Db::table('merchant_info')->where('id', $ticket['merchant_id'])->value('group_id');
        foreach (Db::table('merchant_admin')->where('site_id', $ticket['site_id'])->where('status', 1)->whereNull('deleted_at')
            ->where(static fn ($q) => $q->where('merchant_id', $ticket['merchant_id'])->orWhere(static fn ($q) => $q->where('account_type', 1)->where('group_id', $group)->where('group_id', '>', 0)))->get() as $row) {
            if ($actor['type'] === 'merchant' && (int) $row->id === $actor['id']) continue;
            try {
                $a = SupportAccess::employee((int) $row->id);
                if (! SupportAccess::permission($a, 'mch:support:list') || ! SupportAccess::merchantScope(Db::table('merchant_support_ticket as t')->where('t.id', $ticket['id']), $a, 't', false)->exists()) continue;
            } catch (BusinessException) { continue; }
            $now = gmdate('Y-m-d H:i:s');
            $notification = (int) Db::table('merchant_notify')->insertGetId(['site_id' => $ticket['site_id'], 'merchant_id' => $ticket['merchant_id'], 'property_id' => $ticket['property_id'],
                'recipient_id' => $row->id, 'category' => 'support', 'title' => 'Support ticket ' . $ticket['ticket_no'], 'message' => 'Ticket update: ' . $action . ' (' . $ticket['status'] . ')',
                'deep_link_type' => 'support_ticket', 'deep_link_value' => (string) $ticket['id'], 'channels' => 'inapp', 'send_type' => 1, 'send_at' => $now, 'status' => 1,
                'delivered_at' => $now, 'operator_id' => $actor['type'] === 'admin' ? $actor['id'] : 0, 'operator_name' => mb_substr($actor['name'], 0, 50), 'request_id' => 'support-' . $id . '-' . $row->id]);
            Db::table('merchant_notify_delivery')->insert(['notify_id' => $notification, 'channel' => 'inapp', 'status' => 'delivered', 'attempts' => 1, 'scheduled_at' => $now, 'delivered_at' => $now, 'receipt' => 'inapp:' . $notification]);
        }
    }
}
