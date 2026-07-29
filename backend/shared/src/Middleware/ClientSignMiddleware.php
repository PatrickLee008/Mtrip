<?php

declare(strict_types=1);

namespace Mtrip\Shared\Middleware;

use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\ClientContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\ClientSecretResolver;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 移动端客户端签名鉴权中间件(文档模块12/13、9.4 权限双层校验)
 *
 * 仅对 /api/v1/app/* 路径生效,可全局注册;MTRIP_CLIENT_SIGN=false 时跳过校验(仅限开发调试)
 *
 * 请求头:
 *   X-Client-Id:  客户端唯一标识
 *   X-Timestamp:  秒级时间戳(窗口 MTRIP_SIGN_TTL 秒,默认 3600,超时拒绝防重放)
 *   X-Nonce:      随机串(Redis 去重防重放)
 *   X-Sign:       HMAC-SHA256(secret, clientId + METHOD + path + timestamp + nonce)
 *
 * 校验顺序:客户端存在/启用/未过期 → IP 白名单 → 时间戳/Nonce 防重放 → 签名 → QPS 限流 → 接口权限模板
 */
class ClientSignMiddleware implements MiddlewareInterface
{
    /** 签名时间窗口默认值(秒),可由 MTRIP_SIGN_TTL 覆盖 */
    private const DEFAULT_SIGN_TTL = 3600;

    private bool $enabled;

    private int $signTtl;

    public function __construct(protected Redis $redis, protected ClientSecretResolver $resolver)
    {
        $this->enabled = (bool) \Hyperf\Support\env('MTRIP_CLIENT_SIGN', true);
        $this->signTtl = max(60, (int) \Hyperf\Support\env('MTRIP_SIGN_TTL', self::DEFAULT_SIGN_TTL));
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $path = $request->getUri()->getPath();
        if (! $this->enabled || ! str_starts_with($path, '/api/v1/app/')) {
            return $handler->handle($request);
        }

        $clientId = $request->getHeaderLine('X-Client-Id');
        $timestamp = $request->getHeaderLine('X-Timestamp');
        $nonce = $request->getHeaderLine('X-Nonce');
        $sign = $request->getHeaderLine('X-Sign');
        if ($clientId === '' || $timestamp === '' || $nonce === '' || $sign === '') {
            throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL);
        }

        $client = $this->resolver->findClient($clientId);
        if (! $client) {
            throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL);
        }

        // 状态与过期校验
        if ((int) $client['status'] !== 1) {
            throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL, '客户端已禁用');
        }
        if (! empty($client['expire_at']) && strtotime((string) $client['expire_at']) < time()) {
            throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL, '客户端已过期');
        }

        // IP 白名单
        $ip = $this->clientIp($request);
        $whitelist = trim((string) ($client['ip_whitelist'] ?? ''));
        if ($whitelist !== '') {
            $allowed = array_filter(array_map('trim', explode(',', $whitelist)));
            if (! in_array($ip, $allowed, true)) {
                throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL, 'IP不在白名单内');
            }
        }

        // 时间戳与 Nonce 防重放(窗口可配置,超过 MTRIP_SIGN_TTL 视为无效请求)
        if (abs(time() - (int) $timestamp) > $this->signTtl) {
            throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL, '请求已过期,请检查设备时间');
        }
        $nonceKey = "mtrip:nonce:{$clientId}:{$nonce}";
        if (! $this->redis->set($nonceKey, '1', ['nx', 'ex' => $this->signTtl])) {
            throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL, '重复请求');
        }

        // 签名校验(明文 secret 由解析器从 Redis 缓存/AES 解密得到)
        $secret = $this->resolver->plainSecret($client);
        $expected = hash_hmac('sha256', $clientId . strtoupper($request->getMethod()) . $path . $timestamp . $nonce, $secret);
        if (! hash_equals($expected, strtolower($sign))) {
            throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL, '签名错误');
        }

        // QPS 限流(按客户端秒级计数)
        $qpsLimit = (int) ($client['qps_limit'] ?? 0);
        if ($qpsLimit > 0) {
            $qpsKey = 'mtrip:qps:' . $clientId . ':' . time();
            $count = $this->redis->incr($qpsKey);
            $this->redis->expire($qpsKey, 2);
            if ($count > $qpsLimit) {
                throw new BusinessException(ErrorCode::TOO_MANY_REQUESTS);
            }
        }

        // 接口权限模板校验(白名单:仅列表内可调;黑名单:列表内禁止)
        $this->checkApiPermission((int) ($client['perm_template_id'] ?? 0), $path);

        ClientContext::set([
            'id' => (int) $client['id'],
            'client_id' => $clientId,
            'client_name' => (string) $client['client_name'],
            'client_type' => (int) $client['client_type'],
            'site_id' => (int) $client['site_id'],
            'ip' => $ip,
        ]);

        return $handler->handle($request);
    }

    private function checkApiPermission(int $templateId, string $path): void
    {
        if ($templateId <= 0) {
            return;
        }
        $template = Db::connection('system')->table('sys_client_perm_template')->where('id', $templateId)->whereNull('deleted_at')->first();
        if (! $template) {
            return;
        }
        $template = (array) $template;
        if ((int) $template['status'] !== 1) {
            // 模板禁用后,绑定客户端全部禁止调用业务接口
            throw new BusinessException(ErrorCode::CLIENT_API_FORBIDDEN, '接口权限模板已禁用');
        }
        $apiList = json_decode((string) ($template['api_list'] ?? '[]'), true) ?: [];
        $matched = false;
        foreach ($apiList as $pattern) {
            // 支持前缀通配:/api/v1/hotel/* 或精确路径
            if (str_ends_with((string) $pattern, '*')) {
                if (str_starts_with($path, rtrim((string) $pattern, '*'))) {
                    $matched = true;
                    break;
                }
            } elseif ($pattern === $path) {
                $matched = true;
                break;
            }
        }
        $isWhitelist = (int) $template['rule_mode'] === 1;
        if ($isWhitelist && ! $matched) {
            throw new BusinessException(ErrorCode::CLIENT_API_FORBIDDEN);
        }
        if (! $isWhitelist && $matched) {
            throw new BusinessException(ErrorCode::CLIENT_API_FORBIDDEN);
        }
    }

    private function clientIp(ServerRequestInterface $request): string
    {
        $xff = $request->getHeaderLine('X-Forwarded-For');
        if ($xff !== '') {
            return trim(explode(',', $xff)[0]);
        }
        $real = $request->getHeaderLine('X-Real-IP');
        if ($real !== '') {
            return $real;
        }
        return (string) ($request->getServerParams()['remote_addr'] ?? '');
    }
}
