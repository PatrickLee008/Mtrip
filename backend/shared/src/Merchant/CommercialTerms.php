<?php

declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/** 商务条款纯规则；费率以万分点计算，预览金额统一用整数分。 */
final class CommercialTerms
{
    public static function validate(array $input): array
    {
        $plan = $input['commissionPlan'] ?? null;
        if (! in_array($plan, ['vip', 'premium', 'standard'], true)) self::invalid('请选择佣金方案');
        $commission = self::rate($input['commissionRate'] ?? null, 100);
        $fee = self::rate($input['transactionFeeRate'] ?? null, 100);
        $merchant = self::rate($input['merchantUpfrontRate'] ?? null, 30);
        $payAtHotel = self::boolean($input['payAtHotelEnabled'] ?? null);
        $noShow = self::boolean($input['noShowFeeEnabled'] ?? null);
        if ((! $payAtHotel && $noShow) || ((! $payAtHotel || ! $noShow) && $merchant !== '0.00')) {
            self::invalid('到店支付或未到店费用停用时，商户预收必须为0且未到店费用须停用');
        }
        if ($payAtHotel && self::basisPoints($commission) + self::basisPoints($merchant) > 10000) {
            self::invalid('佣金与商户预收合计不得超过房费100%');
        }
        $date = $input['effectiveAt'] ?? null;
        if (! is_string($date) || ! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/D', $date)) {
            self::invalid('生效时间须为含时区的ISO8601日期时间');
        }
        try {
            $effective = new \DateTimeImmutable($date);
            $errors = \DateTimeImmutable::getLastErrors();
            if ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) self::invalid('生效时间无效');
        } catch (\Exception) {
            self::invalid('生效时间无效');
        }
        if ($effective->format('u') !== '000000') self::invalid('生效时间仅支持整秒，请移除非零毫秒');
        $effective = $effective->setTimezone(new \DateTimeZone('UTC'));
        if ((int) $effective->format('Y') < 1000 || (int) $effective->format('Y') > 9999) self::invalid('生效时间超出可存储范围');
        $reason = $input['reason'] ?? null;
        if (! is_string($reason) || trim($reason) === '' || mb_strlen(trim($reason)) > 500) self::invalid('变更原因必填且最多500字');
        $requestId = $input['requestId'] ?? null;
        if (! is_string($requestId) || ! preg_match('/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/D', $requestId)) self::invalid('请求标识无效');
        $version = $input['expectedVersion'] ?? null;
        if ((! is_int($version) && (! is_string($version) || ! ctype_digit($version))) || (int) $version < 0 || strlen((string) $version) > 10) {
            self::invalid('请提供有效的条款版本');
        }
        return [
            'commission_plan' => $plan, 'commission_rate' => $commission, 'transaction_fee_rate' => $fee,
            'pay_at_hotel_enabled' => $payAtHotel, 'no_show_fee_enabled' => $noShow, 'merchant_upfront_rate' => $merchant,
            'effective_at' => $effective->format('Y-m-d H:i:s'),
            'reason' => trim($reason), 'request_id' => $requestId, 'expected_version' => (int) $version,
        ];
    }

    public static function preview(array $terms, int $roomAmount = 10000000): array
    {
        $commission = intdiv($roomAmount * self::basisPoints($terms['commission_rate']) + 5000, 10000);
        $fee = intdiv($commission * self::basisPoints($terms['transaction_fee_rate']) + 5000, 10000);
        $merchant = intdiv($roomAmount * self::basisPoints($terms['merchant_upfront_rate']) + 5000, 10000);
        return [
            'room_amount' => $roomAmount, 'commission_amount' => $commission, 'transaction_fee_amount' => $fee,
            'merchant_upfront_amount' => $merchant, 'customer_upfront_amount' => $commission + $merchant + $fee,
            'hotel_balance_amount' => $roomAmount - $commission - $merchant,
        ];
    }

    private static function rate(mixed $value, int $maximum): string
    {
        if ((is_float($value) && (! is_finite($value) || round($value, 2) !== $value))
            || (! is_int($value) && ! is_float($value) && ! is_string($value))
            || ! preg_match('/^\d+(?:\.\d{1,2})?$/D', (string) $value)
            || (float) $value > $maximum) self::invalid('费率须为范围内数字且最多两位小数');
        return number_format((float) $value, 2, '.', '');
    }

    private static function basisPoints(string $rate): int
    {
        [$whole, $fraction] = array_pad(explode('.', $rate, 2), 2, '');
        return (int) $whole * 100 + (int) str_pad($fraction, 2, '0');
    }

    private static function boolean(mixed $value): bool
    {
        if (! in_array($value, [true, false, 0, 1], true)) self::invalid('开关须为布尔值');
        return (bool) $value;
    }

    private static function invalid(string $message): never
    {
        throw new BusinessException(ErrorCode::PARAM_ERROR, $message);
    }
}
