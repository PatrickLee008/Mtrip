<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;

use function Hyperf\Config\config;

/** Runtime merchant test mode; production never accepts fixed OTPs or reveals credentials. */
final class MerchantAuthTestMode
{
    public const CONFIG_KEY = 'merchant_auth_test_mode';
    public const OTP = '000000';
    public const OTP_MARKER = 'test:merchant-otp';

    public static function allowed(): bool
    {
        $environment = strtolower((string) config('app_env', ''));
        if (in_array($environment, ['prod', 'production'], true)) {
            return false;
        }
        return filter_var(config('mtrip.merchant_auth_test_allowed', false), FILTER_VALIDATE_BOOLEAN);
    }

    public static function enabled(): bool
    {
        if (! self::allowed()) {
            return false;
        }
        $value = Db::connection('system')->table('sys_config')
            ->where('config_key', self::CONFIG_KEY)
            ->whereNull('deleted_at')
            ->value('config_value');
        return (string) $value === '1';
    }
}
