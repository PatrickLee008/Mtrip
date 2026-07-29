<?php

declare(strict_types=1);

namespace Mtrip\Shared\Middleware;

use Hyperf\Context\Context;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\ClientSecretResolver;
use Mtrip\Shared\Support\TransportCipher;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 传输加密解密中间件:登录/注册等敏感接口请求体 AES-256-CBC 加密传输
 *
 * 约定:请求头 X-Encrypted: 1 + 请求体 {"payload": "base64(IV+密文)"}
 * 密钥:/api/v1/app/* 用 ClientSecret(X-Client-Id 反查);/api/v1/admin/* 用 MTRIP_ADMIN_AES_KEY
 * 解密后明文参数写回 parsedBody,控制器无感知
 * 强制名单:MTRIP_PAYLOAD_ENCRYPT=true 时 mtrip.encrypt_paths 内的路径必须加密传输
 */
class PayloadDecryptMiddleware implements MiddlewareInterface
{
    /** 默认强制加密路径(可被各服务 config mtrip.encrypt_paths 覆盖) */
    private const DEFAULT_ENCRYPT_PATHS = [
        '/api/v1/app/auth/login',
        '/api/v1/app/auth/register',
        '/api/v1/admin/auth/login',
    ];

    private bool $enforced;

    public function __construct(protected ClientSecretResolver $resolver)
    {
        $this->enforced = (bool) \Hyperf\Support\env('MTRIP_PAYLOAD_ENCRYPT', true);
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $path = $request->getUri()->getPath();
        $encrypted = $request->getHeaderLine('X-Encrypted') === '1';

        // 带密文则始终解密(即使开关关闭,保证前端常开加密也可用);开关只控制"必须加密"的强制性
        if ($encrypted) {
            $request = $this->decryptRequest($request, $path);
            Context::set(ServerRequestInterface::class, $request);
        } elseif ($this->enforced && in_array($path, $this->encryptPaths(), true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '该接口要求加密传输');
        }

        return $handler->handle($request);
    }

    private function decryptRequest(ServerRequestInterface $request, string $path): ServerRequestInterface
    {
        $body = (array) $request->getParsedBody();
        $payload = (string) ($body['payload'] ?? '');
        if ($payload === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '缺少加密数据 payload');
        }
        $plaintext = TransportCipher::decrypt($payload, $this->resolveSecret($request, $path));
        $data = json_decode($plaintext, true);
        if (! is_array($data)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '加密数据内容非法');
        }
        return $request->withParsedBody($data);
    }

    private function resolveSecret(ServerRequestInterface $request, string $path): string
    {
        if (str_starts_with($path, '/api/v1/app/')) {
            $clientId = $request->getHeaderLine('X-Client-Id');
            if ($clientId === '') {
                throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL, '缺少客户端标识 X-Client-Id');
            }
            return $this->resolver->secretByClientId($clientId);
        }
        $adminKey = (string) \Hyperf\Support\env('MTRIP_ADMIN_AES_KEY', '');
        if ($adminKey === '') {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '未配置管理端传输加密密钥');
        }
        return $adminKey;
    }

    private function encryptPaths(): array
    {
        $paths = \Hyperf\Config\config('mtrip.encrypt_paths');
        return is_array($paths) && $paths !== [] ? $paths : self::DEFAULT_ENCRYPT_PATHS;
    }
}
