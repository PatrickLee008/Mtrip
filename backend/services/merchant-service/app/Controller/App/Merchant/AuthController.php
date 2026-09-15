<?php

declare(strict_types=1);

namespace App\Controller\App\Merchant;

use App\Controller\AbstractController;
use App\Service\MerchantAccountSecurityService;
use App\Service\MerchantAuthenticationService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Support\Result;

/** Public App access-code bootstrap plus authenticated App logout. */
class AuthController extends AbstractController
{
    #[Inject] protected MerchantAccountSecurityService $security;
    #[Inject] protected MerchantAuthenticationService $authentication;
    #[Inject] protected \Hyperf\HttpServer\Contract\ResponseInterface $response;

    public function authConfig(): array
    {
        return Result::success($this->authentication->config());
    }

    public function activationStart(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->startActivation(
            $this->requireAppSiteId(), $this->strInput('accessCode'), $this->strInput('username'),
            $this->strInput('temporaryPassword'), $this->clientIp()
        ), '激活身份已确认');
    }

    public function activationProfile(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->activationProfile($this->requireStr('activationToken')));
    }

    public function activationOtpSend(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->sendActivationOtp(
            $this->requireStr('activationToken'), $this->requireStr('channel'), $this->clientIp()
        ), '验证码已发送');
    }

    public function activationOtpVerify(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->verifyActivationOtp(
            $this->requireStr('challengeToken'), $this->requireStr('otpCode'), $this->clientIp()
        ), '联系方式已验证');
    }

    public function activationTotpSetup(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->setupActivationTotp($this->requireStr('activationToken')));
    }

    public function activationTotpVerify(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->verifyActivationTotp(
            $this->requireStr('activationToken'), $this->requireStr('twoFaCode'), $this->clientIp()
        ), '身份验证器已关联');
    }

    public function activationGoogleLink(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->linkGoogle(
            $this->requireStr('activationToken'), $this->requireStr('googleIdToken'), $this->clientIp()
        ), 'Google 账号已关联');
    }

    public function activationFinish(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->finishActivation($this->requireStr('activationToken'), $this->clientIp()), '账号已激活');
    }

    public function challenge(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->loginChallenge(
            $this->requireAppSiteId(), $this->requireStr('method'), $this->strInput('identifier'),
            $this->strInput('googleIdToken'), $this->clientIp()
        ), '请完成登录验证');
    }

    public function challengeVerify(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->verifyLogin(
            $this->requireStr('method'), $this->requireStr('challengeToken'), $this->requireStr('otpCode'), $this->clientIp()
        ));
    }

    public function recoveryChallenge(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->recoveryChallenge(
            $this->requireAppSiteId(), $this->requireStr('method'), $this->requireStr('identifier'), $this->clientIp()
        ), '如果账号存在，验证码已发送');
    }

    public function recoveryVerify(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->verifyRecoveryOtp(
            $this->requireStr('challengeToken'), $this->requireStr('otpCode'), $this->clientIp()
        ), '恢复联系方式已验证');
    }

    public function recoveryTotpSetup(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->setupRecoveryTotp($this->requireStr('recoveryToken')));
    }

    public function recoveryTotpVerify(): \Psr\Http\Message\ResponseInterface
    {
        return $this->noStore($this->authentication->verifyRecoveryTotp(
            $this->requireStr('recoveryToken'), $this->requireStr('twoFaCode'), $this->clientIp()
        ), '身份验证器已恢复');
    }

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

    private function noStore(array $data, string $message = 'success'): \Psr\Http\Message\ResponseInterface
    {
        return $this->response->json(Result::success($data, $message))->withHeader('Cache-Control', 'no-store');
    }
}
