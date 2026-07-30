<?php

declare(strict_types=1);

namespace Mtrip\Shared\Middleware;

use Hyperf\Contract\ConfigInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\SupplierContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\JwtHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 供应商端(supplier-web)JWT 鉴权中间件
 * Header: Authorization: Bearer {token} → 校验 aud=supplier → 注入 SupplierContext
 * 同时注入 AdminContext(is_super=false + 供应商权限集),使既有 #[Permission]/PermissionAspect
 * 无需改动即可对供应商端接口透明生效。
 */
class SupplierAuthMiddleware implements MiddlewareInterface
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
        if (($claims['aud'] ?? '') !== 'supplier') {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }

        $permissions = (array) ($claims['permissions'] ?? []);

        SupplierContext::set([
            'admin_id' => (int) ($claims['admin_id'] ?? 0),
            'admin_name' => (string) ($claims['admin_name'] ?? ''),
            'site_id' => (int) ($claims['site_id'] ?? 0),
            'supplier_id' => (int) ($claims['supplier_id'] ?? 0),
            'is_owner' => (bool) ($claims['is_owner'] ?? false),
            'permissions' => $permissions,
        ]);

        // 透明复用平台 #[Permission] 注解:供应商主账号 is_owner 不等于平台超管,is_super 恒 false
        AdminContext::set([
            'admin_id' => (int) ($claims['admin_id'] ?? 0),
            'admin_name' => (string) ($claims['admin_name'] ?? ''),
            'site_id' => (int) ($claims['site_id'] ?? 0),
            'is_super' => false,
            'permissions' => $permissions,
        ]);

        return $handler->handle($request);
    }
}
