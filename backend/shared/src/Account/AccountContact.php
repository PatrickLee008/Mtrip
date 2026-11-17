<?php

declare(strict_types=1);

namespace Mtrip\Shared\Account;

/**
 * 关联邮箱 / 关联手机号的规范化(Consumer App PRD 模块 19.2,纯函数,单测覆盖)。
 *
 * 手机号:PRD 要求「支持 +95 缅甸手机号格式,发验证码前先校验」。
 * App 注册页的「+95」是静态标签,历史账号的手机号按用户输入原样存(多为 `9xxxxxxxx`,也有 `09xxxxxxxx`),
 * mobile_hash 是对原样字符串取 HMAC。新绑定统一存成 `9xxxxxxxx`(与注册页主流写法一致,验证码登录可直接命中),
 * 查重时把 `09… / 959… / +959…` 几种历史写法一并当候选,避免同一个号换个写法就绑到第二个账号上。
 */
final class AccountContact
{
    /** 缅甸手机号去掉国家码 / 前导 0 后的形态:9 开头,共 8~10 位 */
    private const MYANMAR_MOBILE = '/^9\d{7,9}$/D';

    /**
     * 把用户输入规范成 `9xxxxxxxx`;不是缅甸手机号返回 null。
     * 接受 `+95 9…`、`959…`、`09…`、`9…`,空格 / 横线 / 括号忽略。
     */
    public static function myanmarMobile(string $input): ?string
    {
        $raw = trim($input);
        if ($raw === '' || preg_match('/[^\d\s\-()+]/', $raw)) {
            return null;
        }
        $plus = str_starts_with($raw, '+');
        $digits = (string) preg_replace('/\D/', '', $raw);
        if ($plus || (str_starts_with($digits, '959') && strlen($digits) >= 11)) {
            if (! str_starts_with($digits, '95')) {
                return null; // 带 + 却不是 +95:其它国家号码不支持
            }
            $digits = substr($digits, 2);
        }
        if (str_starts_with($digits, '0')) {
            $digits = substr($digits, 1);
        }
        return preg_match(self::MYANMAR_MOBILE, $digits) ? $digits : null;
    }

    /**
     * 查重候选:同一个号码在历史数据里可能出现的写法(都要算「已被占用」)。
     *
     * @return list<string>
     */
    public static function mobileCandidates(string $normalized): array
    {
        return [$normalized, '0' . $normalized, '95' . $normalized, '+95' . $normalized];
    }

    /** 邮箱规范化:去首尾空白、转小写;不合法返回 null(长度按 RFC 5321 的 254 上限) */
    public static function email(string $input): ?string
    {
        $email = strtolower(trim($input));
        if ($email === '' || strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return null;
        }
        return $email;
    }
}
