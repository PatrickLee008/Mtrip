<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/** Read existing authoritative histories; do not manufacture missing historical events. */
class MerchantActivityController extends AbstractController
{
    #[Permission('merchant:activity:list')]
    public function history(): array
    {
        $source = $this->strInput('source');
        [$table, $permission, $description, $actor] = match ($source) {
            'status' => ['merchant_status_history', 'merchant:activity:list', 'note', 'actor_name'],
            'warning' => ['merchant_warning', 'platform:warning:list', 'reason', 'issued_by'],
            'warning_events' => ['compliance_history', 'platform:warning:list', 'note', 'reviewer'],
            'compliance' => ['compliance_history', 'platform:compliance:list', 'event', 'reviewer'],
            'verification' => ['merchant_verify_timeline', 'merchant:list:audit', 'note', 'operator_name'],
            default => throw new BusinessException(ErrorCode::PARAM_ERROR),
        };
        if (! AdminContext::hasPermission($permission)) throw new BusinessException(ErrorCode::FORBIDDEN);
        [$page, $pageSize] = $this->pageParams();
        $q = Db::table($table);
        if (! AdminContext::isSuper()) $q->where('site_id', AdminContext::siteId());
        else $this->applySiteScope($q);
        if ($source === 'warning_events') $q->whereNotNull('warning_id');
        if ($this->intInput('merchantId') > 0) $q->where('merchant_id', $this->intInput('merchantId'));
        if (($merchant = $this->strInput('merchant')) !== '') $q->whereIn('merchant_id', Db::table('merchant_info')->where('merchant_name', 'like', "%{$merchant}%")->select('id'));
        if (($keyword = $this->strInput('keyword')) !== '') {
            if (in_array($source, ['compliance', 'warning_events'], true)) $q->where(static fn ($filter) => $filter->where('note', 'like', "%{$keyword}%")->orWhere('event', 'like', "%{$keyword}%"));
            else $q->where($description, 'like', "%{$keyword}%");
        }
        if (($admin = $this->strInput('admin')) !== '') $q->where($actor, $admin);
        $range = $this->strInput('dateRange');
        if (in_array($range, ['today', '7d', '30d'], true)) $q->where('created_at', '>=', $range === 'today' ? gmdate('Y-m-d 00:00:00') : gmdate('Y-m-d H:i:s', time() - ($range === '7d' ? 7 : 30) * 86400));
        $export = $this->intInput('export') === 1;
        $snapshot = $this->intInput('snapshotId');
        if ($export) {
            if (! AdminContext::hasPermission('merchant:activity:export')) throw new BusinessException(ErrorCode::FORBIDDEN);
            $snapshot = $snapshot ?: (int) (clone $q)->max('id');
            $q->where('id', '<=', $snapshot);
            if ($this->intInput('beforeId') > 0) $q->where('id', '<', $this->intInput('beforeId'));
        }
        $total = (clone $q)->count();
        $list = $q->orderByDesc('id')->forPage($export ? 1 : $page, $pageSize)->get()->map(static function ($row) use ($source, $description, $actor) {
            $row = (array) $row;
            if ($source === 'verification' && in_array($row['action'] ?? '', ['access_code_generated', 'code_regenerated'], true)) $row[$description] = 'Access code configured';
            return ['id' => $row['id'], 'merchant_id' => $row['merchant_id'], 'created_at' => $row['created_at'],
                'activity_type' => $source, 'description' => in_array($source, ['compliance', 'warning_events'], true) && ! empty($row['note']) ? ($row['action'] . ': ' . $row['note']) : (string) ($row[$description] ?? ''), 'performed_by' => (string) ($row[$actor] ?? ''),
                'performed_by_id' => $row['actor_id'] ?? $row['operator_id'] ?? null, 'actor_type' => $row['actor_type'] ?? 'legacy',
                'status' => null, 'ip_address' => $row['ip_address'] ?? '', 'source' => $source, 'source_action' => $row['action'] ?? '',
                'violation_id' => $row['violation_id'] ?? null, 'warning_id' => $row['warning_id'] ?? null,
            ];
        })->all();
        $names = $list ? Db::table('merchant_info')->whereIn('id', array_column($list, 'merchant_id'))->pluck('merchant_name', 'id')->all() : [];
        foreach ($list as &$row) $row['merchant_name'] = $names[$row['merchant_id']] ?? '';
        unset($row);
        return Result::success(['list' => $list, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize, 'snapshotId' => $snapshot,
            'nextBeforeId' => $export && count($list) === $pageSize ? (int) end($list)['id'] : null]);
    }
}
