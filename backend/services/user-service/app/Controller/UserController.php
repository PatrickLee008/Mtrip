<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\UserAuthService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端个人中心:资料/密码/余额积分流水/反馈
 */
class UserController extends AbstractController
{
    #[Inject]
    protected UserAuthService $authService;

    /** 我的资料(脱敏) */
    public function me(): array
    {
        return Result::success($this->authService->profile(UserContext::userId()));
    }

    /** 修改资料(昵称/头像) */
    public function update(): array
    {
        $data = [];
        $nickname = $this->strInput('nickname');
        if ($nickname !== '') {
            $data['nickname'] = mb_substr($nickname, 0, 50);
        }
        $avatar = $this->strInput('avatar');
        if ($avatar !== '') {
            $data['avatar'] = $avatar;
        }
        if ($data === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '没有可更新的字段');
        }
        Db::table('user_info')->where('id', UserContext::userId())->update($data);
        return Result::success($this->authService->profile(UserContext::userId()), '资料已更新');
    }

    /** 修改密码(校验旧密码) */
    public function changePassword(): array
    {
        $oldPassword = $this->requireStr('oldPassword');
        $newPassword = $this->requireStr('newPassword');
        if (strlen($newPassword) < 6 || strlen($newPassword) > 32) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '新密码长度须为6-32位');
        }
        $user = Db::table('user_info')->where('id', UserContext::userId())->first();
        if (! $user || ! password_verify($oldPassword, (string) ((array) $user)['password'])) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '原密码错误');
        }
        Db::table('user_info')->where('id', UserContext::userId())
            ->update(['password' => password_hash($newPassword, PASSWORD_BCRYPT)]);
        return Result::success(null, '密码已修改,请重新登录');
    }

    /** 余额流水分页 */
    public function balanceLogs(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_balance_log')
            ->where('user_id', UserContext::userId())
            ->orderByDesc('id');
        $total = (clone $query)->count();
        $list = $query->forPage($page, $pageSize)->get()
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 积分流水分页 */
    public function pointsLogs(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_points_log')
            ->where('user_id', UserContext::userId())
            ->orderByDesc('id');
        $total = (clone $query)->count();
        $list = $query->forPage($page, $pageSize)->get()
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 提交反馈/投诉 */
    public function addFeedback(): array
    {
        $content = $this->requireStr('content');
        $type = $this->intInput('feedbackType', 1);
        if (! in_array($type, [1, 2, 3, 4], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '反馈类型不正确');
        }
        $images = $this->input('images');
        Db::table('user_feedback')->insert([
            'site_id' => $this->requireSiteId(),
            'user_id' => UserContext::userId(),
            'feedback_type' => $type,
            'content' => mb_substr($content, 0, 2000),
            'images' => is_array($images) ? json_encode($images, JSON_UNESCAPED_UNICODE) : null,
            'order_id' => $this->intInput('orderId'),
            'status' => 0,
        ]);
        return Result::success(null, '反馈已提交');
    }

    /** 我的反馈列表 */
    public function feedbackList(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_feedback')
            ->where('user_id', UserContext::userId())
            ->whereNull('deleted_at')
            ->orderByDesc('id');
        $total = (clone $query)->count();
        $list = $query->forPage($page, $pageSize)->get()
            ->map(static function ($row) {
                $row = (array) $row;
                $row['images'] = $row['images'] ? json_decode((string) $row['images'], true) : [];
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }
}
