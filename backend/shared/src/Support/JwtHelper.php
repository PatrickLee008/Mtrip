<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * JWT 工具(HS256),用于后台管理端登录态
 */
class JwtHelper
{
    /**
     * 签发 Token
     *
     * @param array $claims 业务载荷(admin_id/site_id/roles 等)
     * @param string $secret 签名密钥
     * @param int $ttl 有效期秒数
     */
    public static function issue(array $claims, string $secret, int $ttl = 7200): string
    {
        $header = self::base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $now = time();
        $payload = self::base64UrlEncode(json_encode(array_merge($claims, [
            'iat' => $now,
            'exp' => $now + $ttl,
            'jti' => bin2hex(random_bytes(8)),
        ]), JSON_UNESCAPED_UNICODE));
        $signature = self::sign("{$header}.{$payload}", $secret);
        return "{$header}.{$payload}.{$signature}";
    }

    /**
     * 校验并解析 Token,失败抛业务异常(40101/40102)
     */
    public static function verify(string $token, string $secret): array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }
        [$header, $payload, $signature] = $parts;
        if (! hash_equals(self::sign("{$header}.{$payload}", $secret), $signature)) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }
        $claims = json_decode(self::base64UrlDecode($payload), true);
        if (! is_array($claims)) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }
        if (($claims['exp'] ?? 0) < time()) {
            throw new BusinessException(ErrorCode::TOKEN_EXPIRED);
        }
        return $claims;
    }

    private static function sign(string $data, string $secret): string
    {
        return self::base64UrlEncode(hash_hmac('sha256', $data, $secret, true));
    }

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
