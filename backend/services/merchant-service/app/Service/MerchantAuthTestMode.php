<?php

declare(strict_types=1);

namespace App\Service;

use function Hyperf\Config\config;

/** Explicit local test mode; production never accepts fixed OTPs or reveals credentials. */
final class MerchantAuthTestMode
{
    public const OTP = '000000';
    public const OTP_MARKER = 'test:merchant-otp';

    public static function enabled(): bool
    {
        return in_array((string) config('app_env', ''), ['dev', 'local', 'test'], true)
            && filter_var(config('mtrip.merchant_auth_test_mode', false), FILTER_VALIDATE_BOOLEAN);
    }
}
