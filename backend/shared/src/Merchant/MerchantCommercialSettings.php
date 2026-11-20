<?php

declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;

/** 跨 merchant/order 服务共用的生效条款读取；管理操作在此再次校验权限和站点。 */
final class MerchantCommercialSettings
{
    public static function read(int $merchantId): array
    {
        self::permission('merchant:list:list');
        return self::view(self::merchant($merchantId));
    }

    public static function save(int $merchantId, array $input): array
    {
        self::permission('merchant:list:edit');
        return Db::transaction(function () use ($merchantId, $input) {
            $merchant = self::merchant($merchantId, true);
            $terms = CommercialTerms::validate($input);
            $expected = $terms['expected_version'];
            unset($terms['expected_version']);
            $hashTerms = $terms;
            unset($hashTerms['request_id']);
            $hash = hash('sha256', json_encode($hashTerms, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
            $previous = Db::table('merchant_commercial_config')->where('merchant_id', $merchantId)
                ->where('request_id', $terms['request_id'])->first();
            if ($previous) {
                if (! hash_equals((string) $previous->payload_hash, $hash)) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '请求标识已用于不同的商务设置');
                }
                return self::view($merchant);
            }
            if ((int) $merchant['status'] === 5) throw new BusinessException(ErrorCode::DATA_CONFLICT, '已关闭商户不能修改商务设置');
            if ((int) $merchant['commercial_version'] !== $expected) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '商务设置已更新，请刷新后重试');
            }
            $version = $expected + 1;
            $now = gmdate('Y-m-d H:i:s');
            $configId = Db::table('merchant_commercial_config')->insertGetId(array_merge($terms, [
                'merchant_id' => $merchantId, 'site_id' => $merchant['site_id'], 'version' => $version,
                'payload_hash' => $hash, 'created_by' => AdminContext::adminId(),
                'created_by_name' => AdminContext::adminName(), 'created_at' => $now,
            ]));
            Db::table('merchant_info')->where('id', $merchantId)->update(['commercial_version' => $version]);
            Db::table('merchant_activity_log')->insert([
                'merchant_id' => $merchantId, 'site_id' => $merchant['site_id'], 'activity_type' => 'commercial_settings',
                'description' => mb_substr('Commercial v' . $version . ': ' . $terms['reason'], 0, 255),
                'performed_by' => AdminContext::adminName(), 'performed_by_id' => AdminContext::adminId(),
                'actor_type' => 'admin', 'entity_type' => 'merchant_commercial_config', 'entity_id' => $configId, 'created_at' => $now,
            ]);
            $merchant['commercial_version'] = $version;
            return self::view($merchant);
        });
    }

    public static function history(int $merchantId, int $page = 1, int $pageSize = 10): array
    {
        self::permission('merchant:list:list');
        $merchant = self::merchant($merchantId);
        $page = max(1, $page);
        $pageSize = min(200, max(1, $pageSize));
        $query = Db::table('merchant_commercial_config')->where('merchant_id', $merchantId)->where('site_id', $merchant['site_id']);
        $total = (clone $query)->count();
        $list = $query->orderByDesc('version')->forPage($page, $pageSize)->get()
            ->map(static fn ($row) => self::terms((array) $row))->all();
        return compact('list', 'total', 'page', 'pageSize');
    }

    /** Batch effective policy reads; a second batch handles merchants with only legacy terms. */
    public static function effectiveMany(array $merchants, ?string $at = null, bool $currentRead = false): array
    {
        if ($merchants === []) return [];
        $at ??= gmdate('Y-m-d H:i:s');
        $result = [];
        $sites = [];
        foreach ($merchants as $merchant) {
            $id = (int) $merchant['id'];
            $sites[$id] = (int) $merchant['site_id'];
            $result[$id] = self::baseline($merchant);
        }
        $query = Db::table('merchant_commercial_config as c')->whereIn('c.merchant_id', array_keys($result))
            ->where('c.effective_at', '<=', $at)
            ->whereRaw('NOT EXISTS (SELECT 1 FROM merchant_commercial_config n WHERE n.merchant_id = c.merchant_id AND n.site_id = c.site_id AND n.effective_at <= ? AND (n.effective_at > c.effective_at OR (n.effective_at = c.effective_at AND n.version > c.version)))', [$at]);
        if ($currentRead) $query->sharedLock();
        $rows = $query->get(['c.*']);
        foreach ($rows as $row) {
            if ((int) $row->site_id === $sites[(int) $row->merchant_id]) $result[(int) $row->merchant_id] = self::terms((array) $row);
        }
        $missing = array_values(array_filter($merchants, static fn ($m) => $result[(int) $m['id']]['source'] === 'baseline'));
        foreach (PayAtHotelTerms::legacyPolicies($missing, $currentRead, $at) as $id => $legacy) $result[$id] = array_replace($result[$id], $legacy);
        return $result;
    }

    /** 调用方须持订单行锁并处于确认事务中；只冻结酒店订单，已有快照永不覆盖。 */
    public static function captureOrder(array $order): void
    {
        if ((int) $order['order_type'] !== 1 || ($order['merchant_commercial_snapshot'] ?? null) !== null) return;
        $merchant = self::lockMerchantForOrder($order);
        $now = gmdate('Y-m-d H:i:s');
        // Both reads are current reads. The merchant lock serializes confirmation with save(),
        // including transactions that already established an older REPEATABLE READ view.
        $config = Db::table('merchant_commercial_config')->where('merchant_id', $merchant['id'])
            ->where('site_id', $merchant['site_id'])->where('effective_at', '<=', $now)
            ->orderByDesc('effective_at')->orderByDesc('version')->sharedLock()->first();
        $terms = $config ? self::terms((array) $config) : array_replace(self::baseline($merchant), PayAtHotelTerms::legacyPolicy($merchant, true));
        if ((int) ($order['pay_at_hotel'] ?? 0) === 1) {
            $frozen = $order['hotel_terms_snapshot'] ?? null;
            $frozen = is_string($frozen) ? json_decode($frozen, true) : $frozen;
            if (is_array($frozen['commercialTerms'] ?? null)) $terms = $frozen['commercialTerms'];
        }
        $snapshot = array_intersect_key($terms, array_flip([
            'version', 'commission_plan', 'commission_rate', 'transaction_fee_rate', 'pay_at_hotel_enabled',
            'no_show_fee_enabled', 'merchant_upfront_rate', 'effective_at', 'source',
            'commission_scope', 'property_version', 'selection_version',
        ]));
        $snapshot += ['merchant_id' => (int) $merchant['id'], 'site_id' => (int) $merchant['site_id'], 'captured_at' => $now];
        Db::table('order_main')->where('id', (int) $order['id'])->whereNull('merchant_commercial_snapshot')
            ->update(['merchant_commercial_snapshot' => json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    }

    /** 与付款入口一致：先商户、后订单/库存；共享锁与 save() 的商户排他锁确定先后顺序。 */
    public static function lockMerchantForOrder(array $order): ?array
    {
        if ((int) $order['order_type'] !== 1) return null;
        $merchant = Db::table('merchant_info')->where('id', (int) $order['merchant_id'])
            ->where('site_id', (int) $order['site_id'])->sharedLock()->first();
        if (! $merchant) throw new BusinessException(ErrorCode::DATA_CONFLICT, '预订商户商务条款不可用');
        return (array) $merchant;
    }

    private static function view(array $merchant): array
    {
        $id = (int) $merchant['id'];
        $now = gmdate('Y-m-d H:i:s');
        $next = Db::table('merchant_commercial_config')->where('merchant_id', $id)->where('site_id', $merchant['site_id'])
            ->where('effective_at', '>', $now)->orderBy('effective_at')->orderByDesc('version')->first();
        return [
            'merchant_id' => $id, 'latest_version' => (int) ($merchant['commercial_version'] ?? 0),
            'current' => self::effectiveMany([$merchant], $now)[$id], 'next' => $next ? self::terms((array) $next) : null,
        ];
    }

    private static function baseline(array $merchant): array
    {
        return [
            'version' => 0, 'source' => 'baseline', 'commission_plan' => $merchant['commission_plan'] ?? null,
            'commission_rate' => number_format((float) $merchant['commission_rate'], 2, '.', ''),
            'transaction_fee_rate' => '0.00', 'pay_at_hotel_enabled' => false, 'no_show_fee_enabled' => false,
            'merchant_upfront_rate' => '0.00', 'effective_at' => null, 'created_at' => null, 'created_by_name' => '', 'reason' => '',
        ];
    }

    private static function terms(array $row): array
    {
        $terms = array_intersect_key($row, array_flip([
            'id', 'version', 'commission_plan', 'commission_rate', 'transaction_fee_rate', 'pay_at_hotel_enabled',
            'no_show_fee_enabled', 'merchant_upfront_rate', 'effective_at', 'created_at', 'created_by', 'created_by_name', 'reason',
        ]));
        foreach (['id', 'version', 'created_by'] as $key) if (isset($terms[$key])) $terms[$key] = (int) $terms[$key];
        foreach (['pay_at_hotel_enabled', 'no_show_fee_enabled'] as $key) $terms[$key] = (bool) $terms[$key];
        foreach (['commission_rate', 'transaction_fee_rate', 'merchant_upfront_rate'] as $key) $terms[$key] = number_format((float) $terms[$key], 2, '.', '');
        return $terms + ['source' => 'commercial'];
    }

    private static function permission(string $key): void
    {
        if (AdminContext::adminId() <= 0 || ! AdminContext::hasPermission($key)) throw new BusinessException(ErrorCode::FORBIDDEN);
    }

    private static function merchant(int $id, bool $lock = false): array
    {
        $query = Db::table('merchant_info')->where('id', $id)->whereNull('deleted_at');
        if ($lock) $query->lockForUpdate();
        $merchant = $query->first();
        if (! $merchant) throw new BusinessException(ErrorCode::NOT_FOUND, '商户不存在');
        if (! AdminContext::isSuper() && (int) $merchant->site_id !== AdminContext::scopeSiteId()) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        return (array) $merchant;
    }
}
