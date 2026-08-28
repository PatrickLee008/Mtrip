<?php
declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessPolicy;

/** Central policy publishing; revisions are append-only, drafts are never enforcement policy. */
class PlatformRuleService
{
    public const CATEGORIES = ['Booking', 'Listing', 'Operations', 'Pricing', 'Reviews', 'Finance', 'Compliance', 'Marketing'];

    public function save(array $input, string $action = 'draft'): array
    {
        if (! AdminContext::isSuper() || ! AdminContext::hasPermission($action === 'draft' ? 'platform:rule:save' : 'platform:rule:publish')) throw new BusinessException(ErrorCode::FORBIDDEN);
        if (! in_array($action, ['draft', 'publish', 'unpublish', 'archive'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR);
        $note = self::text($input, 'note', 500);
        $version = self::version($input);
        if (isset($input['id']) && (filter_var($input['id'], FILTER_VALIDATE_INT) === false || (int) $input['id'] < 0)) throw new BusinessException(ErrorCode::PARAM_ERROR);
        $id = (int) ($input['id'] ?? 0);
        if ($action !== 'draft' && $id < 1) throw new BusinessException(ErrorCode::PARAM_ERROR);
        if (isset($input['effectiveAt']) && ! is_string($input['effectiveAt'])) throw new BusinessException(ErrorCode::PARAM_ERROR, '生效时间类型错误');
        $effective = $action === 'publish' ? MerchantAccessPolicy::deadline($input['effectiveAt'] ?? null) : null;
        if ($effective !== null && $effective <= gmdate('Y-m-d H:i:s')) throw new BusinessException(ErrorCode::PARAM_ERROR, '生效时间必须在未来并包含时区');
        return Db::transaction(function () use ($input, $action, $note, $version, $id, $effective) {
            $rule = $id ? Db::table('platform_rule')->where('id', $id)->lockForUpdate()->first() : null;
            if ($id && (! $rule || $rule->deleted_at)) throw new BusinessException(ErrorCode::NOT_FOUND);
            if ($version !== (int) ($rule->version ?? 0)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '规则版本已更新，请刷新');
            if ($action === 'draft') {
                $category = self::text($input, 'category', 30);
                $severity = filter_var($input['severity'] ?? null, FILTER_VALIDATE_INT);
                $site = $rule ? (int) $rule->site_id : filter_var($input['siteId'] ?? 0, FILTER_VALIDATE_INT);
                if (! in_array($category, self::CATEGORIES, true) || ! in_array($severity, [1, 2, 3, 4], true) || $site === false || $site < 0) throw new BusinessException(ErrorCode::PARAM_ERROR);
                $exceptions = $input['exceptionMerchantIds'] ?? [];
                if (! is_array($exceptions) || count($exceptions) > 200) throw new BusinessException(ErrorCode::PARAM_ERROR);
                foreach ($exceptions as $mid) if (filter_var($mid, FILTER_VALIDATE_INT) === false || (int) $mid < 1) throw new BusinessException(ErrorCode::PARAM_ERROR);
                $exceptions = array_values(array_unique(array_map('intval', $exceptions)));
                sort($exceptions);
                $merchants = Db::table('merchant_info')->whereIn('id', $exceptions)->whereNull('deleted_at');
                if ($site > 0) $merchants->where('site_id', $site);
                if ($merchants->count() !== count($exceptions)) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '例外商户不存在或不属于规则站点');
                $draft = ['title' => self::text($input, 'title', 200), 'body' => self::text($input, 'body', 10000), 'category' => $category,
                    'severity' => $severity, 'site_id' => $site, 'exceptions_json' => json_encode($exceptions), 'applies' => $site === 0 ? 'All Merchants' : 'Site Merchants'];
                if (! $id) $id = (int) Db::table('platform_rule')->insertGetId($draft + ['created_by' => AdminContext::adminName()]);
                else Db::table('platform_rule')->where('id', $id)->update($draft);
            } else {
                $draft = (array) $rule;
                if ($action === 'publish' && (! trim((string) $rule->body) || ! in_array($rule->category, self::CATEGORIES, true))) throw new BusinessException(ErrorCode::DATA_CONFLICT, '旧规则须先完善正文和分类再发布');
            }
            $snapshot = array_intersect_key($draft, array_flip(['title', 'body', 'category', 'severity', 'site_id', 'exceptions_json', 'applies']));
            $revision = (int) Db::table('platform_rule_revision')->insertGetId(['rule_id' => $id, 'site_id' => $draft['site_id'], 'version' => $version + 1,
                'action' => $action, 'snapshot_json' => json_encode($snapshot, JSON_UNESCAPED_UNICODE),
                'effective_at' => $action === 'draft' ? null : ($effective ?? gmdate('Y-m-d H:i:s')), 'note' => $note,
                'actor_id' => AdminContext::adminId(), 'actor_name' => AdminContext::adminName()]);
            Db::table('platform_rule')->where('id', $id)->update(['version' => $version + 1, 'status' => $action === 'archive' ? 3 : ($action === 'publish' ? 1 : 2)]);
            return ['id' => $id, 'version' => $version + 1, 'revision_id' => $revision];
        });
    }

    public function effective(int $ruleId, bool $lock = false): ?array
    {
        // A later immediate withdrawal cancels all earlier scheduled versions too.
        $query = Db::table('platform_rule_revision')->where('rule_id', $ruleId)->whereNotNull('effective_at')
            ->where('effective_at', '<=', gmdate('Y-m-d H:i:s'))->orderByDesc('version');
        if ($lock) $query->lockForUpdate();
        $row = $query->first();
        if (! $row || $row->action !== 'publish') return null;
        return json_decode($row->snapshot_json, true, 512, JSON_THROW_ON_ERROR) + ['revision_id' => (int) $row->id, 'version' => (int) $row->version, 'effective_at' => $row->effective_at];
    }

    public function applicable(int $ruleId, object $merchant): array
    {
        $rule = $this->effective($ruleId, true);
        if (! $rule || ! in_array((int) $rule['site_id'], [0, (int) $merchant->site_id], true)
            || in_array((int) $merchant->id, json_decode($rule['exceptions_json'] ?? '[]', true) ?? [], true)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前没有适用于该商户的已生效规则');
        return $rule;
    }

    public static function text(array $input, string $field, int $max): string
    {
        $value = $input[$field] ?? '';
        if (! is_string($value) || trim($value) === '' || mb_strlen(trim($value)) > $max) throw new BusinessException(ErrorCode::PARAM_ERROR, $field . '必填且不能超长');
        return trim($value);
    }

    public static function version(array $input): int
    {
        $version = filter_var($input['expectedVersion'] ?? null, FILTER_VALIDATE_INT);
        if ($version === false || $version < 0) throw new BusinessException(ErrorCode::PARAM_ERROR, 'expectedVersion必填');
        return $version;
    }
}
