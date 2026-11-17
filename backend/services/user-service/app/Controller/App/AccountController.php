<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;
use App\Service\AccountContactService;
use App\Service\AccountDeletionService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Support\Result;

/**
 * C 端「账户」:关联邮箱 / 关联手机号(Consumer App PRD 模块 19.2)与账户注销(模块 19)
 *
 * 全部要求登录(UserAuthMiddleware),站点取 Token 里的站点而不是 X-Site-Id。
 */
class AccountController extends AbstractController
{
    #[Inject]
    protected AccountContactService $contacts;

    #[Inject]
    protected AccountDeletionService $deletion;

    /** 关联邮箱第 1 步:校验(格式 / 与当前相同 / 已被占用)后发邮箱验证码 */
    public function emailSendCode(): array
    {
        $data = $this->contacts->sendEmailCode(UserContext::siteId(), UserContext::userId(), $this->requireStr('email'), $this->clientIp());
        return Result::success($data, 'Verification code sent');
    }

    /** 关联邮箱第 2 步:验码通过才写库,返回最新资料 */
    public function emailBind(): array
    {
        $data = $this->contacts->bindEmail(UserContext::siteId(), UserContext::userId(), $this->requireStr('email'),
            $this->requireStr('code'), $this->clientIp());
        return Result::success($data, 'Email linked');
    }

    /** 关联手机号第 1 步:校验 +95 格式 / 与当前相同 / 已被占用后发短信验证码(SMSPoh,scene=bind) */
    public function phoneSendCode(): array
    {
        $data = $this->contacts->sendPhoneCode(UserContext::siteId(), UserContext::userId(), $this->requireStr('mobile'), $this->clientIp());
        return Result::success($data, 'Verification code sent');
    }

    /** 关联手机号第 2 步:验码通过才写库,返回最新资料 */
    public function phoneBind(): array
    {
        $data = $this->contacts->bindPhone(UserContext::siteId(), UserContext::userId(), $this->requireStr('mobile'),
            $this->requireStr('code'), $this->clientIp());
        return Result::success($data, 'Phone number linked');
    }

    /**
     * 注销账户:confirm 必须一字不差为 DELETE(不 trim)。
     * 被拦截时返回 40933,data = {blockers: ['ongoing_booking'|'wallet_balance'], ongoingBookings, walletBalance}。
     */
    public function delete(): array
    {
        $this->deletion->delete(UserContext::userId(), (string) $this->input('confirm', ''), $this->clientIp());
        return Result::success(null, 'Your account has been deleted');
    }
}
