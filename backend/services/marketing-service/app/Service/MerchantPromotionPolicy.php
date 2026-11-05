<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CouponEligibility;

final class MerchantPromotionPolicy
{
    public static function get(int $siteId): array
    {
        $values = Db::connection('system')->table('sys_site_config')->where('site_id', $siteId)->whereNull('deleted_at')
            ->whereIn('config_key', ['merchant_promotion_max_percent', 'merchant_promotion_max_amount', 'merchant_promotion_min_payable_percent'])
            ->pluck('config_value', 'config_key')->all();
        $number = static fn ($value) => is_numeric($value) && is_finite((float) $value) ? (float) $value : null;
        $percent = $number($values['merchant_promotion_max_percent'] ?? null);
        $amount = $number($values['merchant_promotion_max_amount'] ?? null);
        $minimum = $number($values['merchant_promotion_min_payable_percent'] ?? null);
        return [
            'configured' => is_numeric($percent) && (float) $percent > 0 && (float) $percent < 100
                && is_numeric($amount) && (float) $amount > 0
                && is_numeric($minimum) && (float) $minimum > 0 && (float) $minimum <= 100,
            'maxPercent' => is_numeric($percent) ? (float) $percent : null,
            'maxAmount' => is_numeric($amount) ? (float) $amount : null,
            'minPayablePercent' => is_numeric($minimum) ? (float) $minimum : null,
            'timezone' => (string) (Db::connection('system')->table('sys_site')->where('id', $siteId)->value('timezone') ?: 'UTC'),
        ];
    }

    public static function validate(int $siteId, int $merchantId, array $coupon): array
    {
        $policy = self::get($siteId);
        if (! $policy['configured']) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Merchant promotion limits are not configured. Contact the platform administrator.');
        }
        $commission = (float) Db::table('merchant_info')->where('id', $merchantId)->value('commission_rate');
        $policy['protectedPercent'] = max($commission, $policy['minPayablePercent']);
        $percentOff = (10 - (float) $coupon['discount_value']) * 10;
        if (((int) $coupon['coupon_type'] === 2 && $percentOff > $policy['maxPercent'])
            || ((int) $coupon['coupon_type'] !== 2 && (float) $coupon['discount_value'] > $policy['maxAmount'])) {
            self::exceeded();
        }
        $decode = static fn ($value) => is_string($value) ? (json_decode($value, true) ?: []) : (array) $value;
        $properties = $decode($coupon['property_ids']);
        $rooms = $decode($coupon['room_type_ids']);
        $prices = Db::table('hotel_room_type')->whereIn('property_id', $properties)->whereNull('deleted_at')
            ->when($rooms !== [], static fn ($q) => $q->whereIn('id', $rooms))->pluck('base_price');
        if ($prices->isEmpty()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Select a property with configured room base prices.');
        }
        foreach ($prices as $price) {
            $official = round((float) $price * max(1, (int) ($coupon['min_nights'] ?? 0)), 2);
            $base = max($official, (float) ($coupon['min_amount'] ?? 0));
            if ($official <= 0 || $base - CouponEligibility::discount($coupon, $base) < round($official * $policy['protectedPercent'] / 100, 2)) {
                self::exceeded();
            }
        }
        return $policy;
    }

    private static function exceeded(): never
    {
        throw new BusinessException(ErrorCode::PARAM_ERROR, 'Discount exceeds the merchant promotion limit or protected minimum payable amount.');
    }
}
