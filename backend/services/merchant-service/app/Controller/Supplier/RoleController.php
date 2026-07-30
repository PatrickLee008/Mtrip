<?php

declare(strict_types=1);

namespace App\Controller\Supplier;

use App\Controller\AbstractController;
use App\Support\MenuTreeHelper;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\SupplierContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 供应商端角色管理:角色 CRUD + 分配菜单(supplier_role_menu)+ 给子账号赋角色(supplier_admin_role)
 * 只能操作本供应商的角色(内置预设全平台共享)。
 */
class RoleController extends AbstractController
{
    /** 角色列表(内置角色 + 本供应商自定义角色) */
    public function index(): array
    {
        $rows = $this->scopedQuery()->orderBy('is_builtin', 'desc')->orderByDesc('id')->get()
            ->map(static function ($row) {
                $row = (array) $row;
                return [
                    'id' => (int) $row['id'],
                    'roleName' => $row['role_name'],
                    'roleCode' => $row['role_code'],
                    'isBuiltin' => (int) $row['is_builtin'] === 1,
                    'status' => (int) $row['status'],
                    'remark' => $row['remark'],
                    'createdAt' => (string) $row['created_at'],
                ];
            })->all();
        return Result::success($rows);
    }

    /** 可分配菜单树(供应商端全部菜单) */
    public function menuTree(): array
    {
        $rows = array_map(static fn ($r) => (array) $r, Db::table('supplier_menu')
            ->where('status', 1)->whereNull('deleted_at')
            ->orderBy('sort')->orderBy('id')->get()->all());
        return Result::success(MenuTreeHelper::build($rows));
    }

    /** 某角色已分配的菜单ID集合 */
    public function menus(): array
    {
        $role = $this->findScopedRole($this->requireId());
        $ids = Db::table('supplier_role_menu')->where('role_id', $role['id'])
            ->pluck('menu_id')->map(static fn ($id) => (int) $id)->all();
        return Result::success(['menuIds' => $ids]);
    }

    /** 新增自定义角色 */
    #[Permission('sup:role:add')]
    public function create(): array
    {
        $roleName = $this->requireStr('roleName');
        $id = (int) Db::table('supplier_role')->insertGetId([
            'site_id' => SupplierContext::siteId(),
            'supplier_id' => SupplierContext::supplierId(),
            'role_name' => $roleName,
            'role_code' => $this->strInput('roleCode'),
            'is_builtin' => 0,
            'status' => 1,
            'remark' => $this->strInput('remark'),
        ]);
        return Result::success(['id' => $id], '角色创建成功');
    }

    /** 编辑角色(内置角色不可改) */
    #[Permission('sup:role:edit')]
    public function update(): array
    {
        $role = $this->findScopedRole($this->requireId());
        $this->assertEditable($role);
        $data = [];
        if (($name = $this->strInput('roleName')) !== '') {
            $data['role_name'] = $name;
        }
        if ($this->input('remark') !== null) {
            $data['remark'] = $this->strInput('remark');
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $data['status'] = (int) $status;
        }
        if ($data !== []) {
            Db::table('supplier_role')->where('id', $role['id'])->update($data);
        }
        return Result::success(null, '角色更新成功');
    }

    /** 删除角色(内置不可删;已被账号占用不可删) */
    #[Permission('sup:role:delete')]
    public function remove(): array
    {
        $role = $this->findScopedRole($this->requireId());
        $this->assertEditable($role);
        if (Db::table('supplier_admin_role')->where('role_id', $role['id'])->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该角色已分配给子账号,请先解除');
        }
        Db::transaction(static function () use ($role) {
            Db::table('supplier_role')->where('id', $role['id'])->update(['deleted_at' => date('Y-m-d H:i:s')]);
            Db::table('supplier_role_menu')->where('role_id', $role['id'])->delete();
        });
        return Result::success(null, '角色已删除');
    }

    /** 分配菜单(仅限供应商端菜单;内置角色不可改) */
    #[Permission('sup:role:assign')]
    public function assign(): array
    {
        $role = $this->findScopedRole($this->requireId());
        $this->assertEditable($role);
        $menuIds = array_values(array_unique(array_map('intval', (array) $this->input('menuIds', []))));
        $allowed = Db::table('supplier_menu')->where('status', 1)->whereNull('deleted_at')
            ->pluck('id')->map(static fn ($id) => (int) $id)->all();
        $menuIds = array_values(array_intersect($menuIds, $allowed));
        Db::transaction(static function () use ($role, $menuIds) {
            Db::table('supplier_role_menu')->where('role_id', $role['id'])->delete();
            if ($menuIds !== []) {
                Db::table('supplier_role_menu')->insert(array_map(
                    static fn (int $mid) => ['role_id' => $role['id'], 'menu_id' => $mid],
                    $menuIds
                ));
            }
        });
        return Result::success(null, '菜单权限已保存');
    }

    /** 给子账号赋角色(覆盖式) */
    #[Permission('sup:role:grant')]
    public function grant(): array
    {
        $adminId = $this->requireId('adminId');
        $account = $this->findScopedAccount($adminId);
        if ((int) $account['is_owner'] === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '主账号无需分配角色');
        }
        $roleIds = array_values(array_unique(array_map('intval', (array) $this->input('roleIds', []))));
        $visible = $this->scopedQuery()->pluck('id')->map(static fn ($id) => (int) $id)->all();
        $roleIds = array_values(array_intersect($roleIds, $visible));
        Db::transaction(static function () use ($adminId, $roleIds) {
            Db::table('supplier_admin_role')->where('admin_id', $adminId)->delete();
            if ($roleIds !== []) {
                Db::table('supplier_admin_role')->insert(array_map(
                    static fn (int $rid) => ['admin_id' => $adminId, 'role_id' => $rid],
                    $roleIds
                ));
            }
        });
        return Result::success(null, '角色已分配');
    }

    /** 某子账号已分配的角色ID集合 */
    public function accountRoles(): array
    {
        $account = $this->findScopedAccount($this->requireId('adminId'));
        $ids = Db::table('supplier_admin_role')->where('admin_id', $account['id'])
            ->pluck('role_id')->map(static fn ($id) => (int) $id)->all();
        return Result::success(['roleIds' => $ids]);
    }

    /** 本供应商可见角色(内置 + 自定义) */
    private function scopedQuery(): Builder
    {
        return Db::table('supplier_role')->whereNull('deleted_at')
            ->where(function (Builder $q) {
                $q->where('is_builtin', 1)
                    ->orWhere(function (Builder $q2) {
                        $q2->where('is_builtin', 0)->where('supplier_id', SupplierContext::supplierId());
                    });
            });
    }

    private function findScopedRole(int $id): array
    {
        $role = (clone $this->scopedQuery())->where('id', $id)->first();
        if (! $role) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '角色不存在或无权操作');
        }
        return (array) $role;
    }

    private function assertEditable(array $role): void
    {
        if ((int) $role['is_builtin'] === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '内置角色不可修改');
        }
    }

    /** 校验子账号属于当前供应商 */
    private function findScopedAccount(int $id): array
    {
        $account = Db::table('supplier_admin')->whereNull('deleted_at')
            ->where('supplier_id', SupplierContext::supplierId())->where('id', $id)->first();
        if (! $account) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '账号不存在或无权操作');
        }
        return (array) $account;
    }
}
