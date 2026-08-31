<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\MerchantAccountSecurityService;
use App\Service\MerchantImpersonationService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Support\Result;

/**
 * 跨端共用控制器(admin + merchant),故留在 Controller 根目录,不入端子目录:
 * - 总平台 admin:/api/v1/admin/merchant/security/accounts、reset-2fa
 * - 商户端 merchant:/api/v1/merchant/auth/2fa/setup|verify、impersonation/exchange
 */
class MerchantSecurityController extends AbstractController
{
    #[\Hyperf\Di\Annotation\Inject]
    protected \Hyperf\HttpServer\Contract\ResponseInterface $response;
    #[Inject]
    protected MerchantAccountSecurityService $security;

    #[Permission(['merchant:list:2fa', 'merchant:list:impersonate'])]
    public function accounts(): array
    {
        return Result::success($this->security->accounts($this->requireId('merchantId')));
    }

    public function setup(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response->json(Result::success($this->security->setup($this->requireStr('challengeToken'))))->withHeader('Cache-Control', 'no-store');
    }

    public function verify(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response->json(Result::success($this->security->verify($this->requireStr('challengeToken'), $this->requireStr('twoFaCode'), $this->clientIp())))->withHeader('Cache-Control', 'no-store');
    }

    public function exchange(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response->json(Result::success((new MerchantImpersonationService())->exchange($this->requireStr('exchangeCode'))))->withHeader('Cache-Control', 'no-store');
    }
}
