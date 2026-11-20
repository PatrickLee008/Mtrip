<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\CommercialTerms;
use Mtrip\Shared\Merchant\PayAtHotelTerms;

class PayAtHotelTermsService
{
    public function current(array $merchant): array
    {
        $terms = PayAtHotelTerms::resolve($merchant);
        unset($terms['commercial_terms']);
        return $terms;
    }

    public function history(array $merchant): array
    {
        return Db::table('merchant_pay_at_hotel_terms')->where('merchant_id', $merchant['id'])->where('site_id', $merchant['site_id'])
            ->orderByDesc('version')->limit(100)->get()->map(static fn ($r) => (array) $r)->all();
    }

    public function saveMerchant(array $merchant, array $input, int $actorId): array
    {
        $validated = CommercialTerms::validate(['commissionPlan' => 'standard', 'commissionRate' => 0, 'transactionFeeRate' => 0,
            'payAtHotelEnabled' => true, 'noShowFeeEnabled' => $input['noShowEnabled'] ?? null,
            'merchantUpfrontRate' => $input['depositRate'] ?? null, 'effectiveAt' => gmdate('Y-m-d\TH:i:s\Z'),
            'reason' => 'Merchant updated no-show preference', 'requestId' => 'merchant-choice',
            'expectedVersion' => $input['selectionVersion'] ?? null]);
        return Db::transaction(function () use ($merchant, $input, $validated, $actorId): array {
            $locked = Db::table('merchant_info')->where('id', $merchant['id'])->where('site_id', $merchant['site_id'])
                ->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $locked || ! in_array((int) $locked->status, [3,4], true)) throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Merchant is unavailable');
            $base = $this->current((array) $locked);
            if (! $base['enabled']) throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Pay at hotel is not enabled');
            if ((string) ($input['policyVersion'] ?? '') !== (string) $base['policy_version'] || ($input['policySource'] ?? '') !== $base['policy_source']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Commercial policy changed; reload before saving');
            }
            $noShow = (bool) $validated['no_show_fee_enabled'];
            $rate = (float) $validated['merchant_upfront_rate'];
            if (($noShow && ! $base['no_show_allowed']) || $rate > $base['deposit_cap_rate']) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'Merchant upfront exceeds the administrator limit');
            }
            // A lost response can retry an already-applied preference without another version.
            if ((bool) $base['no_show_enabled'] === $noShow && (float) $base['deposit_rate'] === $rate) return $base;
            if ($validated['expected_version'] !== $base['selection_version']) throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Preference changed; reload before saving');
            $version = (int) Db::table('merchant_pay_at_hotel_terms')->where('merchant_id', $merchant['id'])->max('version') + 1;
            Db::table('merchant_pay_at_hotel_terms')->insert(['merchant_id' => $merchant['id'], 'site_id' => $merchant['site_id'],
                'version' => $version, 'enabled' => 1, 'no_show_enabled' => (int) $noShow,
                'deposit_cap_rate' => $base['deposit_cap_rate'], 'deposit_rate' => $rate,
                'commission_rate' => $base['commission_rate'], 'transaction_fee_rate' => $base['transaction_fee_rate'],
                'effective_at' => gmdate('Y-m-d H:i:s'), 'reason' => $validated['reason'], 'actor_type' => 'merchant', 'actor_id' => $actorId]);
            return $this->current((array) $locked);
        });
    }
}
