<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Model\SysAdmin;
use App\Service\AuthService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 登录态控制器:登录 / 登出 / 当前管理员 / 动态菜单 / 修改密码
 */
class AuthController extends AbstractController
{
    #[Inject]
    protected AuthService $authService;

    public function login(): array
    {
        $username = $this->requireStr('username');
        $password = $this->requireStr('password');
        $data = $this->authService->login(
            $username,
            $password,
            $this->clientIp(),
            $this->request->getHeaderLine('user-agent')
        );
        return Result::success($data, '登录成功');
    }

    public function logout(): array
    {
        // JWT 无状态,由前端丢弃 Token;此处仅确认登录态有效
        return Result::success(null, '已退出登录');
    }

    public function me(): array
    {
        /** @var SysAdmin|null $admin */
        $admin = SysAdmin::query()->find(AdminContext::adminId());
        if ($admin === null) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号不存在或已删除');
        }
        return Result::success($this->authService->profile($admin));
    }

    public function menus(): array
    {
        return Result::success($this->authService->menus(AdminContext::adminId(), AdminContext::isSuper()));
    }

    public function updatePassword(): array
    {
        $this->authService->updatePassword(
            AdminContext::adminId(),
            $this->requireStr('oldPassword'),
            $this->requireStr('newPassword')
        );
        return Result::success(null, '密码修改成功,请重新登录');
    }
}
