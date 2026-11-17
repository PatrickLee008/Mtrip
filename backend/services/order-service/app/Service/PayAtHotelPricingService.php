<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

class PayAtHotelPricingService
{
    public function option(int $siteId, int $merchantId, int $propertyId, float $roomBase, float $addons): array
    {
        $merchant = Db::table('merchant_info')->where('id', $merchantId)->where('site_id', $siteId)
            ->whereNull('deleted_at')->first(['commission_rate']);
        $terms = Db::table('merchant_pay_at_hotel_terms')
            ->where('merchant_id', $merchantId)->where('site_id', $siteId)
            ->where('effective_at', '<=', gmdate('Y-m-d H:i:s'))
            ->orderByDesc('effective_at')->orderByDesc('version')->first();
        $terms = $terms ? (array) $terms : null;
        $policies = Db::table('merchant_store')->where('id', $propertyId)->where('site_id', $siteId)
            ->where('merchant_id', $merchantId)->value('hotel_policies');
        $policies = is_string($policies) ? json_decode($policies, true) : $policies;
        $propertyEnabled = is_array($policies) && ! empty($policies['booking']['payAtHotel']);
        $available = $merchant && $propertyEnabled && $terms && (int) $terms['enabled'] === 1;
        $base = round(max(0.0, $roomBase), 2);
        $commissionRate = (float) ($terms['commission_rate'] ?? $merchant->commission_rate ?? 0);
        $feeRate = (float) ($terms['transaction_fee_rate'] ?? 0);
        $depositRate = (int) ($terms['no_show_enabled'] ?? 0) === 1
            ? min(30.0, (float) ($terms['deposit_cap_rate'] ?? 0), (float) ($terms['deposit_rate'] ?? 0)) : 0.0;
        $commission = round($base * $commissionRate / 100, 2);
        $deposit = round($base * $depositRate / 100, 2);
        $fee = round($commission * $feeRate / 100, 2);
        return [
            'available' => (bool) $available,
            'version' => (int) ($terms['version'] ?? 0),
            'noShowEnabled' => (int) ($terms['no_show_enabled'] ?? 0) === 1,
            'commissionRate' => $commissionRate,
            'transactionFeeRate' => $feeRate,
            'depositRate' => $depositRate,
            'roomBase' => $base,
            'commission' => $commission,
            'merchantDeposit' => $deposit,
            'transactionFee' => $fee,
            'prepayAmount' => round($commission + $deposit + $fee + $addons, 2),
            'hotelBalance' => round(max(0.0, $base - $commission - $deposit), 2),
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
