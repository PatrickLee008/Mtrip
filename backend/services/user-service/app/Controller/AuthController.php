<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\UserAuthService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端注册/登录/登录态(文档模块3 + 移动端方案第六章)
 */
class AuthController extends AbstractController
{
    #[Inject]
    protected UserAuthService $authService;

    /** 注册:手机号 + 密码,站点从 X-Site-Id 取 */
    public function register(): array
    {
        $mobile = $this->requireStr('mobile');
        $password = $this->requireStr('password');
        if (! preg_match('/^\+?\d{6,20}$/', $mobile)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '手机号格式不正确');
        }
        if (strlen($password) < 6 || strlen($password) > 32) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '密码长度须为6-32位');
        }
        $data = $this->authService->register(
            $this->requireSiteId(),
            $mobile,
            $password,
            $this->strInput('nickname'),
            $this->registerSource(),
            $this->clientIp(),
        );
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
