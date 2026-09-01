<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
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

    public function login(): \Psr\Http\Message\ResponseInterface
    {
        $data = $this->authService->login(
            $this->requireStr('username'),
            $this->requireStr('password'),
            $this->clientIp()
        );
        return $this->response->json(Result::success($data, '请完成身份验证器验证'))->withHeader('Cache-Control', 'no-store');
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
