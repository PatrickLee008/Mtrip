<?php

declare(strict_types=1);

namespace App\Controller\App\Merchant;

use App\Controller\AbstractController;
use App\Service\MerchantAccountSecurityService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Support\Result;

/** Public App access-code bootstrap plus authenticated App logout. */
class AuthController extends AbstractController
{
    #[Inject] protected MerchantAccountSecurityService $security;
    #[Inject] protected \Hyperf\HttpServer\Contract\ResponseInterface $response;

    public function accessCodeVerify(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response->json(Result::success($this->security->beginWithAccessCode($this->requireStr('accessCode'))))->withHeader('Cache-Control', 'no-store');
    }

    public function setupInfo(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response->json(Result::success($this->security->setup($this->requireStr('challengeToken'))))->withHeader('Cache-Control', 'no-store');
    }

    public function verify(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response->json(Result::success($this->security->verify($this->requireStr('challengeToken'), $this->requireStr('twoFaCode'), $this->clientIp())))->withHeader('Cache-Control', 'no-store');
    }

    public function pairingExchange(): \Psr\Http\Message\ResponseInterface
    {
        return $this->response->json(Result::success($this->security->exchangeAppPairing($this->requireStr('pairingCode'))))->withHeader('Cache-Control', 'no-store');
    }

    public function logout(): array
    {
        Db::transaction(function (): void {
            Db::table('merchant_admin')->where('id', MerchantContext::adminId())->update(['auth_version' => Db::raw('auth_version + 1'), 'challenge_hash' => null, 'pending_secret_enc' => '']);
            \App\Service\MerchantActivityService::changed(MerchantContext::adminId(), 'logout', $this->clientIp());
        });
        return Result::success(null, '已退出登录');
    }
}
