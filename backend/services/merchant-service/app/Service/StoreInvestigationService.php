<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;

class StoreInvestigationService
{
    public const CATEGORIES = ['suspected_fraud', 'serious_violation'];
    public const STATUSES = ['flagged', 'investigating', 'resolved'];
    public const DECISIONS = ['cleared', 'store_followup', 'suspend_merchant'];

    public function query(int $siteId = 0): Builder
    {
        $this->requirePermission('merchant:investigation:list');
        $query = Db::table('merchant_store_investigation');
        $scope = AdminContext::scopeSiteId($siteId);
        if ($scope > 0 || ! AdminContext::isSuper()) $query->where('site_id', $scope);
        return $query;
    }

    public function detail(int $id): array
    {
        $this->requirePermission('merchant:investigation:list');
        $case = $this->find($id);
        $merchant = Db::table('merchant_info')->where('id', $case->merchant_id)->where('site_id', $case->site_id)
            ->whereNull('deleted_at')->first(['status', 'status_version']);
        $history = Db::table('merchant_store_investigation_event')->where('investigation_id', $id)->orderBy('id')->get()->all();
        return ['case' => (array) $case, 'merchant' => $merchant, 'history' => $history];
    }

    public function flag(int $storeId, array $input, string $ip): int
    {
        $this->requirePermission('merchant:store:flag');
        [$reason, $evidence] = $this->notes($input);
        $category = $input['category'] ?? '';
        if (! in_array($category, self::CATEGORIES, true)) throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择标记类别');

        return Db::transaction(function () use ($storeId, $reason, $evidence, $category, $ip): int {
            $source = Db::table('merchant_store')->where('id', $storeId)->whereNull('deleted_at')->first();
            if (! $source) throw new BusinessException(ErrorCode::NOT_FOUND);
            $this->assertScope((int) $source->site_id);
            $merchant = $this->lockMerchant((int) $source->merchant_id, (int) $source->site_id);
            $store = Db::table('merchant_store')->where('id', $storeId)->where('merchant_id', $merchant->id)
                ->where('site_id', $merchant->site_id)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $store) throw new BusinessException(ErrorCode::NOT_FOUND);
            if (Db::table('merchant_store_investigation')->where('open_store_id', $storeId)->lockForUpdate()->first()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该门店已有未结调查');
            }
            $now = gmdate('Y-m-d H:i:s');
            $id = (int) Db::table('merchant_store_investigation')->insertGetId([
                'site_id' => $store->site_id, 'merchant_id' => $merchant->id, 'store_id' => $storeId,
                'merchant_name' => $merchant->merchant_name, 'store_name' => $store->store_name,
                'category' => $category, 'status' => 'flagged', 'created_at' => $now, 'updated_at' => $now,
            ]);
            $this->record($id, (int) $store->site_id, (int) $merchant->id, 'flag', $reason, $evidence, null, $ip, $now);
            return $id;
        });
    }

    public function transition(int $id, string $action, array $input, string $ip): void
    {
        $this->requirePermission($action === 'escalate' ? 'merchant:investigation:escalate' : 'merchant:investigation:review');
        [$reason, $evidence] = $this->notes($input);
        $decision = $action === 'resolve' ? ($input['decision'] ?? '') : null;
        if ($action !== 'escalate' && ($action !== 'resolve' || ! in_array($decision, self::DECISIONS, true))) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择调查决定');
        }
        if ($decision === 'suspend_merchant' && (! AdminContext::isSuper() || ! AdminContext::hasPermission('merchant:status:suspend'))) {
            throw new BusinessException(ErrorCode::FORBIDDEN);
        }

        $source = $this->find($id);
        Db::transaction(function () use ($source, $id, $action, $decision, $reason, $evidence, $input, $ip): void {
            // Keep the same merchant-first lock order as booking and merchant status updates.
            if ($decision === 'suspend_merchant') $this->lockMerchant((int) $source->merchant_id, (int) $source->site_id);
            $case = $this->find($id, true);
            $expected = $action === 'escalate' ? 'flagged' : 'investigating';
            if ($case->status !== $expected) throw new BusinessException(ErrorCode::DATA_CONFLICT, '调查状态已更新，请刷新后重试');

            if ($decision === 'suspend_merchant') {
                (new MerchantStatusService())->change((int) $case->merchant_id, 'suspend', [
                    'note' => mb_substr('Store investigation #' . $id . ': ' . $reason, 0, 500),
                    'evidence' => $evidence,
                    'expectedVersion' => $input['expectedVersion'] ?? null,
                    'requestId' => 'store-investigation-' . $id,
                ], $ip);
            }
            $now = gmdate('Y-m-d H:i:s');
            Db::table('merchant_store_investigation')->where('id', $id)->update([
                'status' => $action === 'escalate' ? 'investigating' : 'resolved', 'decision' => $decision, 'updated_at' => $now,
            ]);
            $this->record($id, (int) $case->site_id, (int) $case->merchant_id, $action, $reason, $evidence, $decision, $ip, $now);
        });
    }

    private function notes(array $input): array
    {
        $reason = $input['reason'] ?? '';
        $evidence = $input['evidence'] ?? '';
        if (! is_string($reason) || ! is_string($evidence) || trim($reason) === ''
            || mb_strlen(trim($reason)) > 500 || mb_strlen(trim($evidence)) > 500) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写有效原因，原因与佐证各最多500字');
        }
        return [trim($reason), trim($evidence)];
    }

    private function find(int $id, bool $lock = false): object
    {
        $query = Db::table('merchant_store_investigation')->where('id', $id);
        if ($lock) $query->lockForUpdate();
        $case = $query->first();
        if (! $case) throw new BusinessException(ErrorCode::NOT_FOUND);
        $this->assertScope((int) $case->site_id);
        return $case;
    }

    private function lockMerchant(int $id, int $site): object
    {
        return Db::table('merchant_info')->where('id', $id)->where('site_id', $site)->whereNull('deleted_at')
            ->lockForUpdate()->first() ?? throw new BusinessException(ErrorCode::NOT_FOUND);
    }

    private function requirePermission(string $permission): void
    {
        if (! AdminContext::hasPermission($permission)) throw new BusinessException(ErrorCode::FORBIDDEN);
    }

    private function assertScope(int $site): void
    {
        $scope = AdminContext::scopeSiteId();
        if ($scope !== null && $scope !== $site) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
    }

    private function record(int $id, int $site, int $merchant, string $action, string $reason, string $evidence,
        ?string $decision, string $ip, string $now): void
    {
        Db::table('merchant_store_investigation_event')->insert([
            'investigation_id' => $id, 'action' => $action, 'reason' => $reason, 'evidence' => $evidence,
            'decision' => $decision, 'actor_id' => AdminContext::adminId(), 'actor_name' => AdminContext::adminName(), 'created_at' => $now,
        ]);
        Db::table('merchant_activity_log')->insert([
            'site_id' => $site, 'merchant_id' => $merchant, 'activity_type' => 'account_change',
            'description' => mb_substr("Store investigation #{$id} {$action}: " . $reason, 0, 255),
            'performed_by' => AdminContext::adminName(), 'performed_by_id' => AdminContext::adminId(), 'actor_type' => 'admin',
            'entity_type' => 'store_investigation', 'entity_id' => $id, 'ip_address' => mb_substr($ip, 0, 45), 'created_at' => $now,
        ]);
    }
}
