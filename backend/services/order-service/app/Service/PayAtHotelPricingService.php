<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\CommercialTerms;
use Mtrip\Shared\Merchant\PayAtHotelTerms;
use Mtrip\Shared\Wallet\WalletLedger;

class PayAtHotelPricingService
{
    public function option(int $siteId, int $merchantId, int $propertyId, float $roomBase, float $addons): array
    {
        $merchant = Db::table('merchant_info')->where('id', $merchantId)->where('site_id', $siteId)
            ->whereNull('deleted_at')->sharedLock()->first();
        $property = Db::table('merchant_store')->where('id', $propertyId)->where('site_id', $siteId)
            ->where('merchant_id', $merchantId)->whereNull('deleted_at')->first();
        $terms = $merchant ? PayAtHotelTerms::resolve((array) $merchant, $property ? (array) $property : null) : [];
        $policies = $property->hotel_policies ?? null;
        $policies = is_string($policies) ? json_decode($policies, true) : $policies;
        // Explicit commercial policy is merchant-wide; retain the old property flag only for legacy fallback.
        $propertyEnabled = ($terms['policy_source'] ?? '') !== 'legacy' || (is_array($policies) && ! empty($policies['booking']['payAtHotel']));
        $available = $merchant && $property && $propertyEnabled && $terms && (int) $terms['enabled'] === 1;
        $base = round(max(0.0, $roomBase), 2);
        $commissionRate = (float) ($terms['commission_rate'] ?? 0);
        $feeRate = (float) ($terms['transaction_fee_rate'] ?? 0);
        $depositRate = (int) ($terms['no_show_enabled'] ?? 0) === 1
            ? min(30.0, (float) ($terms['deposit_cap_rate'] ?? 0), (float) ($terms['deposit_rate'] ?? 0)) : 0.0;
        $amounts = CommercialTerms::preview(['commission_rate' => number_format($commissionRate, 2, '.', ''),
            'transaction_fee_rate' => number_format($feeRate, 2, '.', ''),
            'merchant_upfront_rate' => number_format($depositRate, 2, '.', '')], WalletLedger::cents($base));
        $commission = $amounts['commission_amount'] / 100;
        $deposit = $amounts['merchant_upfront_amount'] / 100;
        $fee = $amounts['transaction_fee_amount'] / 100;
        return [
            'available' => (bool) $available,
            'version' => (int) ($terms['version'] ?? 0),
            'noShowEnabled' => (int) ($terms['no_show_enabled'] ?? 0) === 1,
            'commissionRate' => $commissionRate,
            'transactionFeeRate' => $feeRate,
            'depositRate' => $depositRate,
            'policySource' => $terms['policy_source'] ?? 'commercial',
            'selectionVersion' => $terms['selection_version'] ?? 0,
            'commissionScope' => $terms['commission_scope'] ?? 'merchant',
            'propertyVersion' => $terms['property_version'] ?? 0,
            'commercialTerms' => $terms['commercial_terms'] ?? null,
            'roomBase' => $base,
            'commission' => $commission,
            'merchantDeposit' => $deposit,
            'transactionFee' => $fee,
            'prepayAmount' => ($amounts['customer_upfront_amount'] + WalletLedger::cents($addons)) / 100,
            'hotelBalance' => $amounts['hotel_balance_amount'] / 100,
        ];
    }

    public function requireAvailable(array $option): array
    {
        if (! $option['available']) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该酒店暂不可使用到店支付');
        }
        return $option;
    }

    public function bookingFields(array $option): array
    {
        return [
            'pay_at_hotel' => 1,
            'hotel_balance' => $option['hotelBalance'],
            'hotel_commission' => $option['commission'],
            'hotel_deposit' => $option['merchantDeposit'],
            'hotel_transaction_fee' => $option['transactionFee'],
            'hotel_terms_snapshot' => json_encode($option, JSON_UNESCAPED_UNICODE),
        ];
    }
}
