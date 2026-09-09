<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use App\Service\SmsVerifyService;
use App\Service\UserAuthService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端注册/登录/登录态(文档模块3 + 移动端方案第六章)
 *
 * 短信验证(SMSPoh Verify API V3)三个场景共用 `sms/send` + `sms/verify`:
 * 验码成功拿到一次性 `verifyToken`,再由 register / login-by-sms / reset-password 兑换。
 * 详见 `App\Service\SmsVerifyService`。
 */
class AuthController extends AbstractController
{
    #[Inject]
    protected UserAuthService $authService;

    #[Inject]
    protected SmsVerifyService $sms;

    /** 注册:手机号 + 密码,站点从 X-Site-Id 取;站点配了短信渠道时强制校验 verifyToken */
    public function register(): array
    {
        $siteId = $this->requireSiteId();
        $mobile = $this->requireStr('mobile');
        $password = $this->requireStr('password');
        if (! preg_match('/^\+?\d{6,20}$/', $mobile)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '手机号格式不正确');
        }
        if (strlen($password) < 6 || strlen($password) > 32) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '密码长度须为6-32位');
        }

        /*
         * 短信验证按「渠道启用即强制」:
         * 本站点配了启用中的 smspoh 渠道就必须带 verifyToken,没配则照旧放行,
         * 这样本机开发不必申请真实凭证,生产装上凭证即自动生效,无需再改代码或加开关。
         */
        $verifyToken = $this->strInput('verifyToken');
        $smsRequired = $this->sms->enabled($siteId);
        if ($smsRequired) {
            $this->sms->assertTicket($siteId, 'register', $mobile, $verifyToken);
        }

        $data = $this->authService->register(
            $siteId,
            $mobile,
            $password,
            $this->strInput('nickname'),
            $this->registerSource(),
            $this->clientIp(),
            $this->strInput('referralCode'),
        );

        // 建号成功后才作废票据:推荐码填错会在上一步回滚并抛错,此时票据仍可用于重试
        if ($smsRequired) {
            $this->sms->discardTicket($verifyToken);
        }
        return Result::success($data, '注册成功');
    }

    /** 登录:手机号 + 密码 */
    public function login(): array
    {
        $data = $this->authService->login(
            $this->requireSiteId(),
            $this->requireStr('mobile'),
            $this->requireStr('password'),
            $this->clientIp(),
        );
        return Result::success($data, '登录成功');
    }

    /** 发送短信验证码:scene = register 注册 / login 验证码登录 / reset 重置密码 */
    public function smsSend(): array
    {
        $data = $this->sms->send(
            $this->requireSiteId(),
            $this->requireStr('mobile'),
            SmsVerifyService::assertScene($this->requireStr('scene')),
            $this->clientIp(),
        );
        return Result::success($data, '验证码已发送');
    }

    /** 校验短信验证码,成功返回一次性 verifyToken(10 分钟内交给对应业务接口兑换) */
    public function smsVerify(): array
    {
        $data = $this->sms->verify(
            $this->requireSiteId(),
            $this->requireStr('mobile'),
            SmsVerifyService::assertScene($this->requireStr('scene')),
            $this->requireStr('code'),
        );
        return Result::success($data, '验证通过');
    }

    /** 短信验证码登录(免密):凭 scene=login 的 verifyToken 直接签发 Token */
    public function loginBySms(): array
    {
        $siteId = $this->requireSiteId();
        $mobile = $this->requireStr('mobile');
        $verifyToken = $this->requireStr('verifyToken');

        $this->sms->assertTicket($siteId, 'login', $mobile, $verifyToken);
        $data = $this->authService->loginBySms($siteId, $mobile, $this->clientIp());
        $this->sms->discardTicket($verifyToken);

        return Result::success($data, '登录成功');
    }

    /** 忘记密码:凭 scene=reset 的 verifyToken 重置密码(不自动登录) */
    public function resetPassword(): array
    {
        $siteId = $this->requireSiteId();
        $mobile = $this->requireStr('mobile');
        $password = $this->requireStr('password');
        $verifyToken = $this->requireStr('verifyToken');
        if (strlen($password) < 6 || strlen($password) > 32) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '密码长度须为6-32位');
        }

        $this->sms->assertTicket($siteId, 'reset', $mobile, $verifyToken);
        $this->authService->resetPassword($siteId, $mobile, $password, $this->clientIp());
        $this->sms->discardTicket($verifyToken);

        return Result::success(null, '密码已重置,请用新密码登录');
    }

    /** 退出登录(前端清本地 Token,服务端记录操作日志) */
    public function logout(): array
    {
        $this->authService->logout(UserContext::userId(), $this->clientIp());
        return Result::success(null, '已退出登录');
    }

    /** 刷新 Token(登录态内换发新 Token) */
    public function refresh(): array
    {
        return Result::success($this->authService->refresh(UserContext::userId()));
    }
}
