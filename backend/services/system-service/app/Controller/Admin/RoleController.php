<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Model\SysRole;
use Carbon\Carbon;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 模块2 角色权限管理:CRUD / 权限分配(菜单+按钮) / 绑定管理员
 */
class RoleController extends AbstractController
{
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = (new SysRole())->newSiteQuery($this->intInput('siteId') ?: null);
        if (($roleName = $this->strInput('roleName')) !== '') {
            $query->where('role_name', 'like', "%{$roleName}%");
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }
        $total = (clone $query)->count();
        $list = (clone $query)->orderByDesc('id')->forPage($page, $pageSize)->get();

        // 补充绑定管理员数量
        $adminCounts = Db::table('sys_admin_role')
            ->whereIn('role_id', $list->pluck('id')->toArray() ?: [0])
            ->selectRaw('role_id, count(*) as cnt')->groupBy('role_id')
            ->pluck('cnt', 'role_id')->toArray();
        $rows = $list->map(static fn (SysRole $role) => $role->toArray()
            + ['admin_count' => (int) ($adminCounts[$role->id] ?? 0)])->toArray();
        return Result::page($rows, $total, $page, $pageSize);
    }

    /** 启用角色下拉(分配账号角色用) */
    public function all(): array
    {
        $list = (new SysRole())->newSiteQuery()->where('status', 1)
            ->orderBy('id')->get(['id', 'site_id', 'role_name', 'role_type'])->toArray();
        return Result::success($list);
    }

    #[Permission('sys:role:add')]
    public function create(): array
    {
        $role = new SysRole();
        $role->site_id = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
        $role->role_type = $role->site_id === 0 ? 1 : 2;
        $role->role_name = $this->requireStr('roleName');
        $role->description = $this->strInput('description');
        $role->save();
        return Result::success(['id' => (int) $role->id], '角色创建成功');
    }

    #[Permission('sys:role:edit')]
    public function update(): array
    {
        $role = $this->findScoped($this->requireId());
        $role->role_name = $this->requireStr('roleName');
        $role->description = $this->strInput('description', (string) $role->description);
        $role->save();
        return Result::success(null, '角色更新成功');
    }

    #[Permission('sys:role:delete')]
    public function delete(): array
    {
        $role = $this->findScoped($this->requireId());
        if ((int) $role->id === 1) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '内置超管角色不可删除');
        }
        // 删除校验:仍有管理员绑定时禁止删除
        $bound = Db::table('sys_admin_role')->where('role_id', $role->id)->count();
        if ($bound > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "仍有 {$bound} 个管理员绑定该角色,请先解绑");
        }
        Db::transaction(static function () use ($role) {
            $role->delete();
            Db::table('sys_role_menu')->where('role_id', $role->id)->delete();
        });
        return Result::success(null, '角色已删除');
    }

    #[Permission('sys:role:edit')]
    public function toggleStatus(): array
    {
        $role = $this->findScoped($this->requireId());
        if ((int) $role->id === 1) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '内置超管角色不可禁用');
        }
        $role->status = $role->status === 1 ? 2 : 1;
        $role->save();
        return Result::success(['status' => $role->status], $role->status === 1 ? '已启用' : '已禁用');
    }

    /** 角色已授权菜单/按钮 id 集合 */
    public function perms(): array
    {
        $role = $this->findScoped($this->requireId('roleId'));
        $menuIds = Db::table('sys_role_menu')->where('role_id', $role->id)->pluck('menu_id')->toArray();
        return Result::success(['roleId' => (int) $role->id, 'menuIds' => array_map('intval', $menuIds)]);
    }

    /** 分配权限:全量覆盖角色的菜单+按钮授权 */
    #[Permission('sys:role:perm')]
    public function assignPerms(): array
    {
        $role = $this->findScoped($this->requireId('roleId'));
        $menuIds = $this->input('menuIds');
        if (! is_array($menuIds)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 menuIds 必须为数组');
        }
        $menuIds = array_values(array_unique(array_filter(array_map('intval', $menuIds), static fn (int $v) => $v > 0)));
        Db::transaction(static function () use ($role, $menuIds) {
            Db::table('sys_role_menu')->where('role_id', $role->id)->delete();
            $now = Carbon::now()->toDateTimeString();
            $rows = array_map(static fn (int $menuId) => [
                'role_id' => (int) $role->id,
                'menu_id' => $menuId,
                'created_at' => $now,
            ], $menuIds);
            if ($rows !== []) {
                Db::table('sys_role_menu')->insert($rows);
            }
        });
        return Result::success(null, '权限分配成功');
    }

    /** 角色绑定的管理员列表 */
    public function admins(): array
    {
        $role = $this->findScoped($this->requireId('roleId'));
        $list = Db::table('sys_admin_role as ar')
            ->join('sys_admin as a', 'a.id', '=', 'ar.admin_id')
            ->where('ar.role_id', $role->id)
            ->whereNull('a.deleted_at')
            ->get(['a.id', 'a.site_id', 'a.username', 'a.real_name', 'a.status'])
            ->toArray();
        return Result::success($list);
    }

    private function findScoped(int $id): SysRole
    {
        /** @var SysRole|null $role */
        $role = SysRole::query()->find($id);
        if ($role === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '角色不存在');
        }
        if (! AdminContext::isSuper() && (int) $role->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $role;
    }
}
