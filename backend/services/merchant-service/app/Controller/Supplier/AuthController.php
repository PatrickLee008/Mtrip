<?php

declare(strict_types=1);

namespace App\Controller\Supplier;

use App\Controller\AbstractController;
use App\Service\Supplier\SupplierAuthService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\SupplierContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 供应商端登录态:登录 / 登出 / 当前账号 / 动态菜单 / 修改密码
 */
class AuthController extends AbstractController
{
    #[Inject]
    protected SupplierAuthService $authService;

    public function login(): array
    {
        $data = $this->authService->login(
            $this->requireStr('username'),
            $this->requireStr('password'),
            $this->clientIp()
        );
        return Result::success($data, '登录成功');
    }

    public function logout(): array
    {
        return Result::success(null, '已退出登录');
    }

    public function me(): array
    {
        $admin = Db::table('supplier_admin')->where('id', SupplierContext::adminId())
            ->whereNull('deleted_at')->first();
        if ($admin === null) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号不存在或已删除');
        }
        return Result::success($this->authService->profile((array) $admin));
    }

    public function menus(): array
    {
        return Result::success($this->authService->menus(
            SupplierContext::adminId(),
            SupplierContext::isOwner()
        ));
    }

    public function updatePassword(): array
    {
        $this->authService->updatePassword(
            SupplierContext::adminId(),
            $this->requireStr('oldPassword'),
            $this->requireStr('newPassword')
        );
        return Result::success(null, '密码修改成功,请重新登录');
    }
}
