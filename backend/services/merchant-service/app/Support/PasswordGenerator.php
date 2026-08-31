<?php

declare(strict_types=1);

namespace App\Support;

/**
 * 商家/集团/门店账号的随机初始密码。
 *
 * 必须保证至少各含一个小写、大写、数字:商户端改密与子账号创建校验的口径是
 * "≥8位且含字母和数字"(Merchant\AccountController::create / MerchantAuthService::updatePassword),
 * 而纯随机取样有约 15% 概率不含任何数字,生成出来的密码商户自己改不回同样格式。
 *
 * 字符池去掉 i/l/o/I/L/O/0/1 等易混字符,便于管理员口头或邮件转达。
 */
class PasswordGenerator
{
    private const LOWER = 'abcdefghjkmnpqrstuvwxyz';

    private const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';

    private const DIGITS = '23456789';

    public static function random(int $length = 12): string
    {
        $length = max(8, $length);
        $pool = self::LOWER . self::UPPER . self::DIGITS;
        $chars = [
            self::LOWER[random_int(0, strlen(self::LOWER) - 1)],
            self::UPPER[random_int(0, strlen(self::UPPER) - 1)],
            self::DIGITS[random_int(0, strlen(self::DIGITS) - 1)],
        ];
        while (count($chars) < $length) {
            $chars[] = $pool[random_int(0, strlen($pool) - 1)];
        }
        // Fisher-Yates:否则前三位固定是"小写大写数字",泄露格式
        for ($i = count($chars) - 1; $i > 0; --$i) {
            $j = random_int(0, $i);
            [$chars[$i], $chars[$j]] = [$chars[$j], $chars[$i]];
        }
        return implode('', $chars);
    }
}
