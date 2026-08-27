<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

/**
 * 敏感数据脱敏工具(对应 UI 方案 2.5 脱敏视觉规范 / 文档 9.2)
 */
class MaskHelper
{
    /** 手机号:138****1234 */
    public static function mobile(?string $mobile): string
    {
        if ($mobile === null || $mobile === '') {
            return '';
        }
        $len = mb_strlen($mobile);
        if ($len < 7) {
            return str_repeat('*', $len);
        }
        return mb_substr($mobile, 0, 3) . '****' . mb_substr($mobile, -4);
    }

    /** 邮箱:abc***@xx.com */
    public static function email(?string $email): string
    {
        if ($email === null || ! str_contains($email, '@')) {
            return $email ?? '';
        }
        [$name, $domain] = explode('@', $email, 2);
        $prefix = mb_substr($name, 0, min(3, mb_strlen($name)));
        return $prefix . '***@' . $domain;
    }

    /** 密钥 AK/SK、ClientSecret:sk-**********,保留前3后4 */
    public static function secret(?string $secret): string
    {
        if ($secret === null || $secret === '') {
            return '';
        }
        $len = strlen($secret);
        if ($len <= 8) {
            return str_repeat('*', 10);
        }
        return substr($secret, 0, 3) . str_repeat('*', 10) . substr($secret, -4);
    }

    /** 银行卡/结算账户:尾号4位,中间星号遮挡 */
    public static function bankCard(?string $card): string
    {
        if ($card === null || $card === '') {
            return '';
        }
        $len = strlen($card);
        if ($len <= 4) {
            return $card;
        }
        return str_repeat('*', max(4, $len - 4)) . substr($card, -4);
    }

    /** 身份证号:保留前3后4 */
    public static function idCard(?string $idCard): string
    {
        if ($idCard === null || $idCard === '') {
            return '';
        }
        $len = mb_strlen($idCard);
        if ($len <= 7) {
            return str_repeat('*', $len);
        }
        return mb_substr($idCard, 0, 3) . str_repeat('*', $len - 7) . mb_substr($idCard, -4);
    }

    /**
     * 请求/响应参数递归脱敏(接口调用日志用)
     */
    public static function maskParams(array $params, array $sensitiveKeys = []): array
    {
        $defaults = [
            'password', 'pwd', 'secret', 'client_secret', 'token', 'access_key', 'secret_key',
            'otp', 'twofacode', 'two_fa_code', 'challengetoken', 'challenge_token', 'accesscode', 'access_code',
            'onetimepassword', 'one_time_password', 'manualkey', 'manual_key', 'otpauthuri', 'otpauth_uri',
            'exchangecode', 'exchange_code', 'two_fa_secret_enc', 'pending_secret_enc', 'oldpassword', 'newpassword',
            'mobile', 'phone', 'email', 'id_card', 'idcard', 'bank_card', 'card_no', 'real_name',
        ];
        $keys = array_map('strtolower', array_merge($defaults, $sensitiveKeys));
        $result = [];
        foreach ($params as $k => $v) {
            if (is_array($v)) {
                $result[$k] = self::maskParams($v, $sensitiveKeys);
            } elseif (in_array(strtolower((string) $k), $keys, true)) {
                $result[$k] = '***已脱敏***';
            } else {
                $result[$k] = $v;
            }
        }
        return $result;
    }
}
