<?php

declare(strict_types=1);

namespace Mtrip\Shared\Middleware;

use Hyperf\Contract\ConfigInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\JwtHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * C端用户 JWT 鉴权中间件(移动端 /api/v1/app/* 登录态路由)
 * Header: Authorization: Bearer {token},claims 须含 aud=app,拒绝后台 Token 混用
 */
class UserAuthMiddleware implements MiddlewareInterface
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
        if (($claims['aud'] ?? '') !== 'app' || (int) ($claims['user_id'] ?? 0) <= 0) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }

        UserContext::set([
            'user_id' => (int) $claims['user_id'],
            'site_id' => (int) ($claims['site_id'] ?? 0),
        ]);

        return $handler->handle($request);
    }
}
