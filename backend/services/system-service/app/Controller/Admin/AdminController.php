<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Model\SysAdmin;
use App\Service\AuthService;
use Carbon\Carbon;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

use function Hyperf\Config\config;

/**
 * 模块1 管理员账号管理:CRUD / 重置密码 / 启停 / 登录记录
 * 站点管理员仅能管理本站点子账号(site_id 双重校验)
 */
class AdminController extends AbstractController
{
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = (new SysAdmin())->newSiteQuery($this->intInput('siteId') ?: null);

        if (($username = $this->strInput('username')) !== '') {
            $query->where('username', 'like', "%{$username}%");
        }
        if (($realName = $this->strInput('realName')) !== '') {
            $query->where('real_name', 'like', "%{$realName}%");
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }

        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(fn (SysAdmin $admin) => $this->format($admin))->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    public function detail(): array
    {
        $admin = $this->findScoped($this->requireId());
        $roleIds = Db::table('sys_admin_role')->where('admin_id', $admin->id)->pluck('role_id')->toArray();
        return Result::success($this->format($admin) + ['roleIds' => array_map('intval', $roleIds)]);
    }

    #[Permission('sys:admin:add')]
    public function create(): array
    {
        $username = $this->requireStr('username');
        $password = $this->requireStr('password');
        AuthService::assertPasswordStrength($password);
        if (SysAdmin::withTrashed()->where('username', $username)->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '登录账号已存在');
        }

        $admin = new SysAdmin();
        $admin->site_id = $this->scopedSiteId();
        $admin->username = $username;
        $admin->password = password_hash($password, PASSWORD_BCRYPT);
        $admin->is_super = 0; // 超管账号不允许后台创建
        $this->fill($admin);
        Db::transaction(function () use ($admin) {
            $admin->save();
            $this->syncRoles((int) $admin->id);
        });
        return Result::success(['id' => (int) $admin->id], '管理员创建成功');
    }

    #[Permission('sys:admin:edit')]
    public function update(): array
    {
        $admin = $this->findScoped($this->requireId());
        if ($admin->is_super === 1 && ! AdminContext::isSuper()) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '无权编辑超级管理员');
        }
        if (AdminContext::isSuper() && ($siteId = $this->intInput('siteId', -1)) >= 0) {
            $admin->site_id = $siteId;
        }
        $this->fill($admin);
        Db::transaction(function () use ($admin) {
            $admin->save();
            $this->syncRoles((int) $admin->id);
        });
        return Result::success(null, '管理员更新成功');
    }

    #[Permission('sys:admin:delete')]
    public function delete(): array
    {
        $admin = $this->findScoped($this->requireId());
        if ($admin->is_super === 1) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '超级管理员不可删除');
        }
        if ((int) $admin->id === AdminContext::adminId()) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '不能删除当前登录账号');
        }
        Db::transaction(static function () use ($admin) {
            $admin->delete();
            Db::table('sys_admin_role')->where('admin_id', $admin->id)->delete();
        });
        return Result::success(null, '管理员已删除');
    }

    #[Permission('sys:admin:reset-pwd')]
    public function resetPassword(): array
    {
        $admin = $this->findScoped($this->requireId());
        $password = $this->requireStr('password');
        AuthService::assertPasswordStrength($password);
        $admin->password = password_hash($password, PASSWORD_BCRYPT);
        $admin->login_fail_count = 0;
        $admin->locked_until = null;
        $admin->save();
        return Result::success(null, '密码重置成功');
    }

    #[Permission('sys:admin:status')]
    public function toggleStatus(): array
    {
        $admin = $this->findScoped($this->requireId());
        if ($admin->is_super === 1) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '超级管理员不可禁用');
        }
        $admin->status = $admin->status === 1 ? 2 : 1;
        $admin->save();
        return Result::success(['status' => $admin->status], $admin->status === 1 ? '已启用' : '已禁用');
    }

    public function loginLogs(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('sys_admin_login_log');
        if (! AdminContext::isSuper()) {
            $query->where('site_id', AdminContext::siteId());
        }
        if (($adminId = $this->intInput('adminId')) > 0) {
            $query->where('admin_id', $adminId);
        }
        if (($username = $this->strInput('username')) !== '') {
            $query->where('username', 'like', "%{$username}%");
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 站点隔离取数:非超管访问他站账号直接 40302 */
    private function findScoped(int $id): SysAdmin
    {
        /** @var SysAdmin|null $admin */
        $admin = SysAdmin::query()->find($id);
        if ($admin === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '管理员不存在');
        }
        if (! AdminContext::isSuper() && (int) $admin->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $admin;
    }

    /** 站点管理员仅可创建本站点子账号 */
    private function scopedSiteId(): int
    {
        $siteId = $this->intInput('siteId');
        if (! AdminContext::isSuper()) {
            return AdminContext::siteId();
        }
        return $siteId;
    }

    private function fill(SysAdmin $admin): void
    {
        $admin->real_name = $this->strInput('realName', (string) $admin->real_name);
        $admin->email = $this->strInput('email', (string) $admin->email);
        $admin->avatar = $this->strInput('avatar', (string) $admin->avatar);
        $admin->remark = $this->strInput('remark', (string) $admin->remark);
        $mobile = $this->strInput('mobile');
        if ($mobile !== '' && ! str_contains($mobile, '*')) {
            // 手机号 AES 加密入库(回显脱敏值时跳过)
            $admin->mobile = CryptoHelper::encrypt($mobile, (string) config('mtrip.aes_key'));
        }
    }

    private function syncRoles(int $adminId): void
    {
        $roleIds = $this->input('roleIds');
        if (! is_array($roleIds)) {
            return;
        }
        Db::table('sys_admin_role')->where('admin_id', $adminId)->delete();
        $rows = array_map(static fn ($roleId) => [
            'admin_id' => $adminId,
            'role_id' => (int) $roleId,
            'created_at' => Carbon::now()->toDateTimeString(),
        ], array_values(array_unique(array_filter($roleIds, static fn ($v) => (int) $v > 0))));
        if ($rows !== []) {
            Db::table('sys_admin_role')->insert($rows);
        }
    }

    private function format(SysAdmin $admin): array
    {
        $mobile = '';
        if ($admin->mobile !== '') {
            try {
                $mobile = MaskHelper::mobile(CryptoHelper::decrypt((string) $admin->mobile, (string) config('mtrip.aes_key')));
            } catch (\Throwable) {
                $mobile = '******';
            }
        }
        return [
            'id' => (int) $admin->id,
            'siteId' => (int) $admin->site_id,
            'username' => $admin->username,
            'realName' => $admin->real_name,
            'mobile' => $mobile,
            'email' => MaskHelper::email($admin->email),
            'avatar' => $admin->avatar,
            'isSuper' => $admin->is_super === 1,
            'status' => (int) $admin->status,
            'lastLoginAt' => (string) $admin->last_login_at,
            'lastLoginIp' => $admin->last_login_ip,
            'remark' => $admin->remark,
            'createdAt' => (string) $admin->created_at,
        ];
    }
}
