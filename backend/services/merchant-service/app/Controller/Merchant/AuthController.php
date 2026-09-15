<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use App\Service\MerchantAuthenticationService;
use App\Service\Merchant\MerchantAuthService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户端登录态:登录 / 登出 / 当前账号 / 动态菜单 / 修改密码
 */
class AuthController extends AbstractController
{
    #[\Hyperf\Di\Annotation\Inject]
    protected \Hyperf\HttpServer\Contract\ResponseInterface $response;
    #[Inject]
    protected MerchantAuthService $authService;
    #[Inject]
    protected MerchantAuthenticationService $authentication;

    public function authConfig(): array
    {
        return Result::success($this->authentication->config());
    }

    public function activationStart(): \Psr\Http\Message\ResponseInterface
    {
        $data = $this->authentication->startActivation(
            0,
            $this->strInput('accessCode'),
            $this->strInput('username'),
            $this->strInput('temporaryPassword'),
            $this->clientIp()
        );
        return $this->noStore($data, '激活身份已确认');
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
            0, $this->requireStr('method'), $this->strInput('identifier'), $this->strInput('googleIdToken'), $this->clientIp()
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
            0, $this->requireStr('method'), $this->requireStr('identifier'), $this->clientIp()
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

    public function login(): \Psr\Http\Message\ResponseInterface
    {
        $data = $this->authService->login(
            $this->requireStr('username'),
            $this->requireStr('password'),
            $this->clientIp()
        );
        return $this->response->json(Result::success($data, '请完成身份验证器验证'))->withHeader('Cache-Control', 'no-store');
    }

    private function noStore(array $data, string $message = 'success'): \Psr\Http\Message\ResponseInterface
    {
        return $this->response->json(Result::success($data, $message))->withHeader('Cache-Control', 'no-store');
    }

    public function logout(): array
    {
        $sessionId = (int) (MerchantContext::get()['impersonation_session_id'] ?? 0);
        if ($sessionId > 0) {
            (new \App\Service\MerchantImpersonationService())->end($sessionId, true);
        } else {
            Db::transaction(function () {
                Db::table('merchant_admin')->where('id', MerchantContext::adminId())->update(['auth_version' => Db::raw('auth_version + 1'), 'challenge_hash' => null, 'pending_secret_enc' => '']);
                \App\Service\MerchantActivityService::changed(MerchantContext::adminId(), 'logout', $this->clientIp());
            });
        }
        return Result::success(null, '已退出登录');
    }

    public function me(): array
    {
        $admin = Db::table('merchant_admin')->where('id', MerchantContext::adminId())
            ->whereNull('deleted_at')->first();
        if ($admin === null) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号不存在或已删除');
        }
        $profile = $this->authService->profile((array) $admin);
        if (isset(MerchantContext::get()['impersonation_session_id'])) {
            $profile['isOwner'] = false;
            $profile['permissions'] = [];
            $profile['impersonation'] = MerchantContext::get()['impersonation'];
        }
        return Result::success($profile);
    }

    public function menus(): array
    {
        $data = $this->authService->menus(
            MerchantContext::adminId(),
            MerchantContext::accountType(),
            MerchantContext::isOwner(),
            MerchantContext::merchantId(),
            MerchantContext::scopeMerchantIds(),
            MerchantContext::scopeStoreId()
        );
        if (isset(MerchantContext::get()['impersonation_session_id'])) {
            $allowed = ['dashboard/index', 'order/index', 'rooms/index', 'availability/index', 'promotions/index', 'reviews/index', 'notifications/index'];
            $data['menus'] = array_values(array_filter($data['menus'], static fn ($row) => in_array($row['component'], $allowed, true)));
            $data['perms'] = [];
        }
        return Result::success($data);
    }

    public function updatePassword(): array
    {
        $this->authService->updatePassword(
            MerchantContext::adminId(),
            $this->requireStr('oldPassword'),
            $this->requireStr('newPassword')
        );
        return Result::success(null, '密码修改成功,请重新登录');
    }
}
