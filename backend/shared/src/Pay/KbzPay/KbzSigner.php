<?php

declare(strict_types=1);

namespace Mtrip\Shared\Pay\KbzPay;

/**
 * KBZPay 签名 / 验签(方案 22 §1「签名」)
 *
 * 规则:
 *   1. 外层公共参数与 `biz_content` 平铺合并(见 flatten());
 *   2. 剔除 `sign`、`sign_type`、null、空串(含仅空白)、数组/对象值(如 queryOrder 的 `refund_info`);
 *      **`"0"` 必须保留** —— 官方 SDK 用 empty() 判空会把 "0" 误剔,这里刻意不用 empty();
 *   3. 按 key 的 ASCII(字节序)升序,拼成 `k=v&k2=v2...&key={AppKey}`,key 大小写敏感;
 *   4. SHA256 后转大写。
 *
 * 安全:buildSignString() 的结果含 AppKey,**不得写日志、不得放进异常消息**;
 * 需要排障时只记 canonicalize() 的结果(不含 key)。
 */
final class KbzSigner
{
    public const SIGN_TYPE = 'SHA256';

    /** 不参与签名的字段 */
    private const EXCLUDED_KEYS = ['sign', 'sign_type'];

    /**
     * 把一层 Request/Response 平铺:外层字段 + biz_content 内字段合并为一维数组
     *
     * `biz_content` 可能是数组(我们构造的请求)也可能是 JSON 字符串(个别回包),两种都展开;
     * 其余嵌套值原样保留(签名时会被剔除,但调用方可能要用,如 refund_info)。
     *
     * @param array<string, mixed> $node
     * @return array<string, mixed>
     */
    public static function flatten(array $node): array
    {
        $flat = $node;
        if (array_key_exists('biz_content', $flat)) {
            $biz = $flat['biz_content'];
            unset($flat['biz_content']);
            if (is_string($biz) && $biz !== '') {
                $decoded = json_decode($biz, true);
                $biz = is_array($decoded) ? $decoded : null;
            }
            if (is_array($biz)) {
                foreach ($biz as $k => $v) {
                    $flat[(string) $k] = $v;
                }
            }
        }
        return $flat;
    }

    /**
     * 待签名串(不含 `&key=...`):按规则过滤并排序后的 `k=v&...`
     *
     * @param array<string, mixed> $flat
     */
    public static function canonicalize(array $flat): string
    {
        $pairs = [];
        foreach ($flat as $key => $value) {
            $key = (string) $key;
            if (in_array($key, self::EXCLUDED_KEYS, true)) {
                continue;
            }
            $str = self::scalarToString($value);
            if ($str === null || trim($str) === '') {
                continue;
            }
            $pairs[$key] = $str;
        }
        // 字节序比较:大写字母排在小写之前,key 大小写敏感(不用 ksort 默认的数字/字符串混合比较)
        uksort($pairs, static fn (string $a, string $b): int => strcmp($a, $b));

        $parts = [];
        foreach ($pairs as $k => $v) {
            $parts[] = $k . '=' . $v;
        }
        return implode('&', $parts);
    }

    /**
     * 完整签名原串(含 AppKey)—— 仅供签名计算与单测,**禁止记录**
     *
     * @param array<string, mixed> $flat
     */
    public static function buildSignString(array $flat, string $appKey): string
    {
        return self::canonicalize($flat) . '&key=' . $appKey;
    }

    /** @param array<string, mixed> $flat */
    public static function sign(array $flat, string $appKey): string
    {
        return strtoupper(hash('sha256', self::buildSignString($flat, $appKey)));
    }

    /**
     * 验签:取 $flat['sign'] 与重新计算的签名做常量时间比较
     *
     * 对方签名统一转大写再比较(KBZ 文档约定大写,容忍小写不影响安全性)。
     *
     * @param array<string, mixed> $flat
     */
    public static function verify(array $flat, string $appKey): bool
    {
        $given = $flat['sign'] ?? null;
        if (! is_string($given) || $given === '' || $appKey === '') {
            return false;
        }
        return hash_equals(self::sign($flat, $appKey), strtoupper($given));
    }

    /** 标量转字符串;null / 数组 / 对象返回 null(不参与签名) */
    private static function scalarToString(mixed $value): ?string
    {
        if (is_string($value)) {
            return $value;
        }
        if (is_int($value)) {
            return (string) $value;
        }
        if (is_float($value)) {
            // 避免 1.0E+20 之类科学计数;金额字段本应以字符串传入,这里只兜底
            $s = rtrim(rtrim(sprintf('%.10F', $value), '0'), '.');
            return $s === '' || $s === '-' ? '0' : $s;
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        return null;
    }
}
