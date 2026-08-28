<?php
declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;

/** Original cases/warnings are immutable; each decision appends a same-database event. */
class MerchantComplianceService
{
    public function execute(string $action, array $input, string $ip = ''): array
    {
        $permission = match ($action) {
            'record' => 'platform:violation:record', 'warn' => 'platform:warning:issue', 'revoke' => 'platform:warning:revoke',
            'resolve', 'reopen', 'suspend', 'restore' => 'platform:violation:handle',
            default => throw new BusinessException(ErrorCode::PARAM_ERROR),
        };
        if (! AdminContext::hasPermission($permission)) throw new BusinessException(ErrorCode::FORBIDDEN);
        if (in_array($action, ['suspend', 'restore'], true) && ! AdminContext::hasPermission('merchant:status:' . ($action === 'restore' ? 'activate' : 'suspend'))) throw new BusinessException(ErrorCode::FORBIDDEN);
        $note = PlatformRuleService::text($input, 'note', 500);
        $version = PlatformRuleService::version($input);
        foreach (['id', 'merchantId', 'ruleId', 'ruleRevisionId'] as $field) {
            if (isset($input[$field]) && (filter_var($input[$field], FILTER_VALIDATE_INT) === false || (int) $input[$field] < 1)) throw new BusinessException(ErrorCode::PARAM_ERROR, $field . '必须为正整数');
        }
        $request = $input['requestId'] ?? '';
        if (! is_string($request) || ! preg_match('/^[A-Za-z0-9_-]{8,80}$/D', $request)) throw new BusinessException(ErrorCode::PARAM_ERROR, 'requestId必填');
        // Only recognized fields participate in replay identity. Key ordering from JSON clients is irrelevant.
        $payload = [];
        foreach (['id', 'merchantId', 'ruleId', 'ruleRevisionId', 'details', 'detectedDate', 'reason', 'level', 'expiresAt', 'expectedMerchantVersion', 'suspendedUntil', 'confirmed'] as $key) $payload[$key] = $input[$key] ?? null;
        $hash = hash('sha256', json_encode([$action, $version, $note, $payload], JSON_UNESCAPED_UNICODE));
        $original = $action === 'record' ? null : Db::table($action === 'revoke' ? 'merchant_warning' : 'merchant_violation')->where('id', (int) ($input['id'] ?? 0))->first();
        if ($action !== 'record' && ! $original) throw new BusinessException(ErrorCode::NOT_FOUND);
        $merchantId = $action === 'record' ? (int) ($input['merchantId'] ?? 0) : (int) $original->merchant_id;
        return Db::transaction(function () use ($action, $input, $ip, $note, $version, $request, $hash, $merchantId, $original) {
            // Same lock order as status/order services: merchant first. Never lock a rule then a merchant.
            $merchant = $this->merchant($merchantId, true);
            $old = Db::table('compliance_history')->where('merchant_id', $merchantId)->where('actor_id', AdminContext::adminId())->where('request_id', $request)->first();
            if ($old) {
                if (! hash_equals($old->request_hash, $hash)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '请求号已用于不同操作');
                return json_decode($old->result_json, true, 512, JSON_THROW_ON_ERROR);
            }
            $warningId = $action === 'revoke' ? (int) $original->id : null;
            $caseId = $action === 'record' ? null : ($action === 'revoke' ? $original->violation_id : $original->id);
            $case = $caseId ? Db::table('merchant_violation')->where('id', $caseId)->lockForUpdate()->first() : null;
            if ($caseId && (! $case || (int) $case->merchant_id !== $merchantId || (int) $case->site_id !== (int) $merchant->site_id)) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
            if ($original && (int) $original->site_id !== (int) $merchant->site_id) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
            $last = $caseId ? Db::table('compliance_history')->where('violation_id', $caseId)->orderByDesc('case_version')->first() : null;
            if ($version !== (int) ($last->case_version ?? 0)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '合规记录已更新，请刷新');
            $status = (int) ($last->case_status ?? $case->status ?? 1);
            $ruleRevision = $case->rule_revision_id ?? $original->rule_revision_id ?? null;
            $category = $case->category_code ?? $original->category_code ?? '';
            if (in_array($action, ['record', 'warn', 'suspend'], true)) {
                if ($status !== 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '已解决的违规须先重新打开');
                $ruleId = $action === 'record' ? (int) ($input['ruleId'] ?? 0) : (int) $case->rule_id;
                // Serialize enforcement with publishing; current-read avoids a stale transaction snapshot.
                Db::table('platform_rule')->where('id', $ruleId)->lockForUpdate()->first();
                $rule = (new PlatformRuleService())->applicable($ruleId, $merchant);
                if ($action === 'record') {
                    if ((int) ($input['ruleRevisionId'] ?? 0) !== $rule['revision_id']) throw new BusinessException(ErrorCode::DATA_CONFLICT, '适用规则已更新，请重新选择');
                    $category = $rule['category'];
                    $ruleRevision = $rule['revision_id'];
                    $date = $this->date($input['detectedDate'] ?? gmdate('Y-m-d'));
                    if ($date > gmdate('Y-m-d')) throw new BusinessException(ErrorCode::PARAM_ERROR, '发现日期不能在未来');
                    $caseId = (int) Db::table('merchant_violation')->insertGetId(['site_id' => $merchant->site_id, 'merchant_id' => $merchantId,
                        'merchant_name' => $merchant->merchant_name, 'rule_id' => $ruleId, 'rule_title' => $rule['title'], 'severity' => $rule['severity'],
                        'category_code' => $category, 'rule_revision_id' => $ruleRevision, 'details' => PlatformRuleService::text($input, 'details', 5000),
                        'status' => 1, 'assigned_to' => AdminContext::adminName(), 'detected_date' => $date]);
                } elseif (! $ruleRevision || ! in_array($category, PlatformRuleService::CATEGORIES, true)) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '旧违规缺少规则版本和分类，请保留原记录并登记新违规');
                }
            }
            if ($action === 'warn') {
                $level = filter_var($input['level'] ?? null, FILTER_VALIDATE_INT);
                if (! in_array($level, [1, 2, 3], true)) throw new BusinessException(ErrorCode::PARAM_ERROR);
                $expires = empty($input['expiresAt']) ? null : $this->date($input['expiresAt']);
                if ($expires !== null && $expires < gmdate('Y-m-d')) throw new BusinessException(ErrorCode::PARAM_ERROR, '警告到期日不能在过去');
                $warningId = (int) Db::table('merchant_warning')->insertGetId(['site_id' => $merchant->site_id, 'merchant_id' => $merchantId,
                    'merchant_name' => $merchant->merchant_name, 'violation_id' => $caseId, 'rule_revision_id' => $ruleRevision, 'category_code' => $category,
                    'reason' => PlatformRuleService::text($input, 'reason', 255), 'level' => $level, 'issued_by' => AdminContext::adminName(), 'expires_at' => $expires, 'status' => 1]);
            }
            if ($action === 'revoke' && ((int) $original->status === 2 || Db::table('compliance_history')->where('warning_id', $warningId)->where('action', 'revoke')->exists())) throw new BusinessException(ErrorCode::DATA_CONFLICT, '警告已撤销');
            if (($action === 'resolve' && $status !== 1) || ($action === 'reopen' && $status !== 2)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '违规状态不允许此操作');
            $status = $action === 'resolve' ? 2 : ($action === 'reopen' ? 1 : $status);
            $stateHistory = null;
            $state = null;
            if (in_array($action, ['suspend', 'restore'], true)) {
                if (($input['confirmed'] ?? false) !== true) throw new BusinessException(ErrorCode::PARAM_ERROR, '必须明确确认商户状态变更');
                if ($action === 'restore') {
                    $suspension = Db::table('compliance_history')->where('violation_id', $caseId)->where('action', 'suspend')->orderByDesc('id')->value('merchant_status_history_id');
                    if (! $suspension || (int) $merchant->active_suspension_id !== (int) $suspension) throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前暂停不属于此违规，请从商户状态管理处理');
                }
                $stateRequest = 's6-' . substr(hash('sha256', AdminContext::adminId() . ':' . $request), 0, 60);
                $state = (new MerchantStatusService())->change($merchantId, $action === 'restore' ? 'activate' : 'suspend', [
                    'note' => $note, 'requestId' => $stateRequest, 'expectedVersion' => $input['expectedMerchantVersion'] ?? null,
                    'suspendedUntil' => $input['suspendedUntil'] ?? null], $ip);
                $stateHistory = Db::table('merchant_status_history')->where('merchant_id', $merchantId)->where('actor_id', AdminContext::adminId())->where('request_id', $stateRequest)->value('id');
            }
            $result = ['id' => $caseId, 'warning_id' => $warningId, 'version' => $caseId ? $version + 1 : null, 'status' => $status, 'merchant_state' => $state];
            $event = $action . ' #' . ($caseId ?? $warningId) . ': ' . $note;
            if ($state === null) {
                $receipt = (new MerchantNotificationService())->send($merchantId, ['requestId' => 's6-' . substr(hash('sha256', AdminContext::adminId() . ':' . $request), 0, 60),
                    'channels' => ['inapp'], 'category' => 'account', 'title' => 'Compliance update / 合规通知',
                    'message' => $event . ($action === 'warn' ? "\n" . $input['reason'] : ''), 'deepLinkType' => 'page', 'deepLinkValue' => '/notifications']);
                $result['notification_id'] = $receipt['id'];
            }
            Db::table('compliance_history')->insert(['site_id' => $merchant->site_id, 'merchant_id' => $merchantId, 'merchant_name' => $merchant->merchant_name,
                'violation_id' => $caseId, 'warning_id' => $warningId, 'rule_revision_id' => $ruleRevision, 'category_code' => $category,
                'action' => $action, 'event' => mb_substr($event, 0, 255), 'note' => $note, 'case_version' => $caseId ? $version + 1 : null, 'case_status' => $caseId ? $status : null,
                'result' => in_array($action, ['record', 'suspend', 'reopen'], true) ? 3 : ($action === 'warn' ? 2 : 1),
                'reviewer' => AdminContext::adminName(), 'actor_id' => AdminContext::adminId(), 'actor_type' => 'admin', 'ip_address' => mb_substr($ip, 0, 45),
                'event_date' => gmdate('Y-m-d'), 'request_id' => $request, 'request_hash' => $hash, 'result_json' => json_encode($result), 'merchant_status_history_id' => $stateHistory]);
            return $result;
        });
    }

    public function merchant(int $id, bool $lock = false): object
    {
        $q = Db::table('merchant_info')->where('id', $id)->whereNull('deleted_at');
        if ($lock) $q->lockForUpdate();
        $row = $q->first();
        if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND);
        if (! AdminContext::isSuper() && (int) $row->site_id !== AdminContext::siteId()) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        return $row;
    }

    private function date(mixed $value): string
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) throw new BusinessException(ErrorCode::PARAM_ERROR, '日期格式必须为YYYY-MM-DD');
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value, new \DateTimeZone('UTC'));
        if (! $date || $date->format('Y-m-d') !== $value) throw new BusinessException(ErrorCode::PARAM_ERROR, '日期无效');
        return $value;
    }
}
