<?php

declare(strict_types=1);

namespace Mtrip\Shared\Middleware;

use Hyperf\Contract\ConfigInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\JwtHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 商户端(merchant-web)JWT 鉴权中间件
 * Header: Authorization: Bearer {token} → 校验 aud=merchant → 注入 MerchantContext
 * 同时注入 AdminContext(is_super=false + 商户权限集),使既有 #[Permission]/PermissionAspect
 * 无需改动即可对商户端接口透明生效。
 */
class MerchantAuthMiddleware implements MiddlewareInterface
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
        if (($claims['aud'] ?? '') !== 'merchant') {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }

        \Mtrip\Shared\Merchant\MerchantAccessGuard::assertSession($claims);
        $permissions = (array) ($claims['permissions'] ?? []);

        MerchantContext::set([
            'admin_id' => (int) ($claims['admin_id'] ?? 0),
            'admin_name' => (string) ($claims['admin_name'] ?? ''),
            'site_id' => (int) ($claims['site_id'] ?? 0),
            'account_type' => (int) ($claims['account_type'] ?? 0),
            'group_id' => (int) ($claims['group_id'] ?? 0),
            'merchant_id' => (int) ($claims['merchant_id'] ?? 0),
            'store_id' => (int) ($claims['store_id'] ?? 0),
            'is_owner' => (bool) ($claims['is_owner'] ?? false),
            'permissions' => $permissions,
        ]);

        // 透明复用平台 #[Permission] 注解:商户主账号 is_owner 不等于平台超管,is_super 恒 false
        AdminContext::set([
            'admin_id' => (int) ($claims['admin_id'] ?? 0),
            'admin_name' => (string) ($claims['admin_name'] ?? ''),
            'site_id' => (int) ($claims['site_id'] ?? 0),
            'is_super' => false,
            'permissions' => $permissions,
        ]);

        $response = $handler->handle($request);
        $path = $request->getUri()->getPath();
        if (in_array(strtoupper($request->getMethod()), ['POST', 'PUT', 'PATCH', 'DELETE'], true)
            && preg_match('#^/api/v1/merchant/(order|rooms|availability|promotions|reviews|goods|store|role)/#', $path)) {
            $result = json_decode((string) $response->getBody(), true);
            if ($response->getStatusCode() < 400 && ($result['code'] ?? null) === 0) {
                try {
                    \Hyperf\DbConnection\Db::table('merchant_activity_log')->insert([
                        'site_id' => MerchantContext::siteId(), 'merchant_id' => MerchantContext::merchantId(),
                        'activity_type' => 'operation', 'description' => mb_substr($request->getMethod() . ' ' . $path, 0, 255),
                        'performed_by' => MerchantContext::adminName(), 'performed_by_id' => MerchantContext::adminId(),
                        'actor_type' => 'merchant', 'target_account_id' => MerchantContext::adminId(),
                        'entity_type' => MerchantContext::accountType() === 1 ? 'group' : 'account',
                        'entity_id' => MerchantContext::accountType() === 1 ? MerchantContext::groupId() : MerchantContext::adminId(),
                    ]);
                } catch (\Throwable $e) {
                    // Supplemental cross-domain request audit; business-domain histories remain authoritative.
                    // Do not turn a committed business action into a retryable error or log request secrets.
                    error_log('merchant_operation_audit_failed path=' . $path . ' exception=' . $e::class);
                }
            }
        }
        return $response;
    }
}
