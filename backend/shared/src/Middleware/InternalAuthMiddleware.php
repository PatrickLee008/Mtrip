<?php

declare(strict_types=1);

namespace Mtrip\Shared\Middleware;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 服务间内部接口鉴权(方案22 §4.1):只对 `/internal/` 前缀生效,可全局注册
 *
 * 放行条件(同时满足):
 *   1. env `MTRIP_INTERNAL_TOKEN` 非空 —— 为空时一律拒绝(fail-closed,防止漏配即裸奔);
 *   2. 请求头 `X-Internal-Token` 与之 hash_equals 相等;
 *   3. 来源 IP(server params `remote_addr`,**不信任** X-Forwarded-For 等可伪造头)
 *      为私网/回环:10/8、172.16/12、192.168/16、127/8、::1(含 IPv4-mapped IPv6 形式)。
 *
 * 拒绝时抛 BusinessException(FORBIDDEN),由 AppExceptionHandler 输出 HTTP 403 + {code:40301,...}。
 * 对外文案统一,不区分具体原因;原因只写 error_log,且**绝不输出 token**。
 * 网关没有 `/internal` location,外网本就 404;本中间件是纵深防御的第二道。
 */
class InternalAuthMiddleware implements MiddlewareInterface
{
    public const PATH_PREFIX = '/internal/';

    public const HEADER = 'X-Internal-Token';

    public const ENV_TOKEN = 'MTRIP_INTERNAL_TOKEN';

    /** 允许的来源网段(IPv4 CIDR) */
    private const PRIVATE_V4 = [
        ['10.0.0.0', 8],
        ['172.16.0.0', 12],
        ['192.168.0.0', 16],
        ['127.0.0.0', 8],
    ];

    /**
     * @param string|null $expectedToken 仅供单测注入;生产由 DI 无参构造,每次请求实时读 env
     */
    public function __construct(private ?string $expectedToken = null)
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $path = $request->getUri()->getPath();
        if (! self::isInternalPath($path)) {
            return $handler->handle($request);
        }

        $ip = (string) ($request->getServerParams()['remote_addr'] ?? '');
        $expected = $this->expectedToken ?? self::expectedToken();
        $reason = self::denyReason($path, $request->getHeaderLine(self::HEADER), $expected, $ip);
        if ($reason !== null) {
            error_log(sprintf('internal_auth_denied reason=%s path=%s ip=%s', $reason, $path, $ip));
            throw new BusinessException(ErrorCode::FORBIDDEN, '内部接口拒绝访问');
        }
        return $handler->handle($request);
    }

    /** 纯函数:是否放行(非 internal 路径恒为 true) */
    public static function isAllowed(string $path, string $token, string $expected, string $ip): bool
    {
        return self::denyReason($path, $token, $expected, $ip) === null;
    }

    /**
     * 纯函数:拒绝原因,放行返回 null
     * 原因码只用于日志:not_configured / bad_token / bad_source
     */
    public static function denyReason(string $path, string $token, string $expected, string $ip): ?string
    {
        if (! self::isInternalPath($path)) {
            return null;
        }
        if ($expected === '') {
            return 'not_configured';
        }
        if ($token === '' || ! hash_equals($expected, $token)) {
            return 'bad_token';
        }
        if (! self::isPrivateIp($ip)) {
            return 'bad_source';
        }
        return null;
    }

    public static function isInternalPath(string $path): bool
    {
        return str_starts_with($path, self::PATH_PREFIX);
    }

    /** 私网/回环判定:IPv4 四个网段 + IPv6 回环 ::1;IPv4-mapped(::ffff:a.b.c.d)按其 IPv4 判 */
    public static function isPrivateIp(string $ip): bool
    {
        $ip = trim($ip);
        if ($ip === '') {
            return false;
        }
        if (stripos($ip, '::ffff:') === 0 && filter_var(substr($ip, 7), FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
            $ip = substr($ip, 7);
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false) {
            return inet_pton($ip) === inet_pton('::1');
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) === false) {
            return false;
        }
        $long = ip2long($ip);
        foreach (self::PRIVATE_V4 as [$net, $bits]) {
            $mask = (-1 << (32 - $bits)) & 0xFFFFFFFF;
            if (($long & $mask) === (ip2long($net) & $mask)) {
                return true;
            }
        }
        return false;
    }

    /** 期望 token:每次请求实时读 env,去首尾空白;未设置返回 '' */
    public static function expectedToken(): string
    {
        $value = function_exists('Hyperf\Support\env')
            ? \Hyperf\Support\env(self::ENV_TOKEN, '')
            : getenv(self::ENV_TOKEN);
        return is_string($value) ? trim($value) : '';
    }
}
