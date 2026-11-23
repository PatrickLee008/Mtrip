<?php

declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Hyperf\DbConnection\Db;

/** Shared effective admin policy and bounded merchant choice; old policy rows are read-only fallback. */
final class PayAtHotelTerms
{
    public static function isAvailable(bool $enabled, string $source, mixed $propertyPolicies): bool
    {
        if (! $enabled || $source !== 'legacy') return $enabled;
        if (is_string($propertyPolicies)) $propertyPolicies = json_decode($propertyPolicies, true);
        return is_array($propertyPolicies) && ! empty($propertyPolicies['booking']['payAtHotel']);
    }

    public static function legacyPolicy(array $merchant, bool $currentRead = false, ?string $at = null): array
    {
        return self::legacyPolicies([$merchant], $currentRead, $at)[(int) $merchant['id']] ?? [];
    }

    public static function legacyPolicies(array $merchants, bool $currentRead = false, ?string $at = null): array
    {
        if ($merchants === []) return [];
        $at ??= gmdate('Y-m-d H:i:s');
        $indexed = [];
        foreach ($merchants as $merchant) $indexed[(int) $merchant['id']] = $merchant;
        $query = Db::table('merchant_pay_at_hotel_terms as l')->whereIn('l.merchant_id', array_keys($indexed))
            ->where('l.effective_at', '<=', $at)->where('l.actor_type', 'admin')
            ->whereRaw("NOT EXISTS (SELECT 1 FROM merchant_pay_at_hotel_terms n WHERE n.merchant_id=l.merchant_id AND n.site_id=l.site_id AND n.actor_type='admin' AND n.effective_at<=? AND (n.effective_at>l.effective_at OR (n.effective_at=l.effective_at AND n.version>l.version)))", [$at]);
        if ($currentRead) $query->sharedLock();
        $result = [];
        foreach ($query->get(['l.*']) as $row) {
            $merchant = $indexed[(int) $row->merchant_id];
            if ((int) $merchant['site_id'] !== (int) $row->site_id) continue;
            $result[(int) $row->merchant_id] = ['version' => (int) $row->version, 'commission_plan' => $merchant['commission_plan'] ?? null,
            'commission_rate' => $row->commission_rate, 'transaction_fee_rate' => $row->transaction_fee_rate,
            'pay_at_hotel_enabled' => (bool) $row->enabled, 'no_show_fee_enabled' => (bool) $row->no_show_enabled,
            'merchant_upfront_rate' => $row->deposit_cap_rate, 'effective_at' => $row->effective_at,
            'created_at' => $row->created_at, 'created_by_name' => '', 'reason' => $row->reason,
            'source' => 'legacy', 'legacy_deposit_rate' => $row->deposit_rate];
        }
        return $result;
    }

    /** Caller locks merchant before order/property; policy reads remain current under REPEATABLE READ. */
    public static function resolve(array $merchant, ?array $property = null): array
    {
        $policy = MerchantCommercialSettings::effectiveMany([$merchant], null, true)[(int) $merchant['id']];
        $choice = Db::table('merchant_pay_at_hotel_terms')->where('merchant_id', $merchant['id'])
            ->where('site_id', $merchant['site_id'])->where('actor_type', 'merchant')
            ->where('effective_at', '<=', gmdate('Y-m-d H:i:s'))
            ->orderByDesc('effective_at')->orderByDesc('version')->sharedLock()->first();
        $commission = $policy['commission_rate'];
        $scope = 'merchant'; $overrideVersion = 0;
        if ($property) {
            $override = PropertyCommercialSettings::effective((int) $merchant['id'], (int) $merchant['site_id'], (int) $property['id'], true);
            if ($override && $override['commission_rate'] !== null) {
                $commission = $override['commission_rate']; $scope = 'property'; $overrideVersion = (int) $override['version'];
            }
        }
        $enabled = (bool) $policy['pay_at_hotel_enabled'];
        $allowed = $enabled && (bool) $policy['no_show_fee_enabled'];
        $cap = $allowed ? max(0.0, min(30.0, (float) $policy['merchant_upfront_rate'], 100 - (float) $commission)) : 0.0;
        $noShow = $allowed && ($choice ? (bool) $choice->no_show_enabled : true);
        $rate = $noShow ? min($cap, (float) ($choice->deposit_rate ?? $policy['legacy_deposit_rate'] ?? $policy['merchant_upfront_rate'])) : 0.0;
        return ['version' => (int) $policy['version'], 'policy_version' => (int) $policy['version'],
            'policy_source' => $policy['source'] ?? 'commercial', 'selection_version' => (int) ($choice->version ?? 0),
            'enabled' => (int) $enabled, 'no_show_allowed' => (int) $allowed, 'no_show_enabled' => (int) $noShow,
            'deposit_cap_rate' => $cap, 'deposit_rate' => $rate,
            'commission_rate' => (float) $commission, 'commission_scope' => $scope, 'property_version' => $overrideVersion,
            'transaction_fee_rate' => (float) $policy['transaction_fee_rate'], 'effective_at' => $policy['effective_at'],
            'commercial_terms' => array_replace($policy, ['commission_rate' => $commission,
                'commission_scope' => $scope, 'property_version' => $overrideVersion,
                'merchant_upfront_rate' => number_format($rate, 2, '.', ''), 'selection_version' => (int) ($choice->version ?? 0)])];
    }
}
