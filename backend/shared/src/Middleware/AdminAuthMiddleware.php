<?php

declare(strict_types=1);

namespace Mtrip\Shared\Middleware;

use Hyperf\Contract\ConfigInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\JwtHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 后台管理端 JWT 鉴权中间件
 * Header: Authorization: Bearer {token} → 解析后注入 AdminContext
 */
class AdminAuthMiddleware implements MiddlewareInterface
{
    public function __construct(protected ConfigInterface $config)
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $authorization = $request->getHeaderLine('Authorization');
        if (! str_starts_with($authorization, 'Bearer ')) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }
        $token = substr($authorization, 7);
        $secret = (string) $this->config->get('mtrip.jwt_secret', '');
        if ($secret === '') {
            throw new BusinessException(ErrorCode::SERVER_ERROR, 'JWT 密钥未配置');
        }
        $claims = JwtHelper::verify($token, $secret);

        AdminContext::set([
            'admin_id' => (int) ($claims['admin_id'] ?? 0),
            'admin_name' => (string) ($claims['admin_name'] ?? ''),
            'site_id' => (int) ($claims['site_id'] ?? 0),
            'is_super' => (bool) ($claims['is_super'] ?? false),
            'permissions' => (array) ($claims['permissions'] ?? []),
        ]);

        return $handler->handle($request);
    }
}
