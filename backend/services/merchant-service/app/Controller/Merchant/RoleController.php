<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use App\Support\MenuTreeHelper;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 商户端角色管理:角色 CRUD + 分配菜单(merchant_role_menu)+ 给子账号赋角色(merchant_admin_role)
 * 只能操作本主体、本 account_type 的角色;只能授予自身 account_scope 内菜单。
 */
class RoleController extends AbstractController
{
    /** 角色列表(内置角色 + 本主体自定义角色) */
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

    /** 可分配菜单树(本 account_type 可见的全部菜单) */
    public function menuTree(): array
    {
        $query = Db::table('merchant_menu')
            ->where('status', 1)->whereNull('deleted_at')
            ->whereRaw('FIND_IN_SET(?, account_scope)', [MerchantContext::accountType()])
            ->orderBy('sort')->orderBy('id');
        $this->applyModuleScope($query);
        $rows = array_map(static fn ($r) => (array) $r, $query->get()->all());
        return Result::success(MenuTreeHelper::build($rows));
    }

    /** 某角色已分配的菜单ID集合 */
    public function menus(): array
    {
        $role = $this->findScopedRole($this->requireId());
        $ids = Db::table('merchant_role_menu')->where('role_id', $role['id'])
            ->pluck('menu_id')->map(static fn ($id) => (int) $id)->all();
        return Result::success(['menuIds' => $ids]);
    }

    /** 新增自定义角色 */
    #[Permission('mch:role:add')]
    public function create(): array
    {
        $roleName = $this->requireStr('roleName');
        $id = (int) Db::table('merchant_role')->insertGetId([
            'site_id' => MerchantContext::siteId(),
            'group_id' => MerchantContext::groupId(),
            'merchant_id' => MerchantContext::accountType() === 1 ? 0 : MerchantContext::merchantId(),
            'account_type' => MerchantContext::accountType(),
            'role_name' => $roleName,
            'role_code' => $this->strInput('roleCode'),
            'is_builtin' => 0,
            'status' => 1,
            'remark' => $this->strInput('remark'),
        ]);
        return Result::success(['id' => $id], '角色创建成功');
    }

    /** 编辑角色(内置角色不可改) */
    #[Permission('mch:role:edit')]
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
            Db::table('merchant_role')->where('id', $role['id'])->update($data);
        }
        return Result::success(null, '角色更新成功');
    }

    /** 删除角色(内置不可删;已被账号占用不可删) */
    #[Permission('mch:role:delete')]
    public function remove(): array
    {
        $role = $this->findScopedRole($this->requireId());
        $this->assertEditable($role);
        if (Db::table('merchant_admin_role')->where('role_id', $role['id'])->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该角色已分配给子账号,请先解除');
        }
        Db::transaction(static function () use ($role) {
            Db::table('merchant_role')->where('id', $role['id'])->update(['deleted_at' => date('Y-m-d H:i:s')]);
            Db::table('merchant_role_menu')->where('role_id', $role['id'])->delete();
        });
        return Result::success(null, '角色已删除');
    }

    /** 分配菜单(仅限本 account_type 可见菜单;内置角色不可改) */
    #[Permission('mch:role:assign')]
    public function assign(): array
    {
        $role = $this->findScopedRole($this->requireId());
        $this->assertEditable($role);
        $menuIds = array_values(array_unique(array_map('intval', (array) $this->input('menuIds', []))));
        // 只接受本 account_type 可见、且本商户已开通模块内的菜单,越权ID直接过滤
        $allowedQuery = Db::table('merchant_menu')->where('status', 1)->whereNull('deleted_at')
            ->whereRaw('FIND_IN_SET(?, account_scope)', [MerchantContext::accountType()]);
        $this->applyModuleScope($allowedQuery);
        $allowed = $allowedQuery->pluck('id')->map(static fn ($id) => (int) $id)->all();
        $menuIds = array_values(array_intersect($menuIds, $allowed));
        Db::transaction(static function () use ($role, $menuIds) {
            Db::table('merchant_role_menu')->where('role_id', $role['id'])->delete();
            if ($menuIds !== []) {
                Db::table('merchant_role_menu')->insert(array_map(
                    static fn (int $mid) => ['role_id' => $role['id'], 'menu_id' => $mid],
                    $menuIds
                ));
            }
        });
        return Result::success(null, '菜单权限已保存');
    }

    /** 给子账号赋角色(覆盖式) */
    #[Permission('mch:role:grant')]
    public function grant(): array
    {
        $adminId = $this->requireId('adminId');
        $account = $this->findScopedAccount($adminId);
        if ((int) $account['is_owner'] === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '主账号无需分配角色');
        }
        $roleIds = array_values(array_unique(array_map('intval', (array) $this->input('roleIds', []))));
        // 只接受当前主体可见的角色
        $visible = $this->scopedQuery()->pluck('id')->map(static fn ($id) => (int) $id)->all();
        $roleIds = array_values(array_intersect($roleIds, $visible));
        Db::transaction(static function () use ($adminId, $roleIds) {
            Db::table('merchant_admin_role')->where('admin_id', $adminId)->delete();
            if ($roleIds !== []) {
                Db::table('merchant_admin_role')->insert(array_map(
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
        $ids = Db::table('merchant_admin_role')->where('admin_id', $account['id'])
            ->pluck('role_id')->map(static fn ($id) => (int) $id)->all();
        return Result::success(['roleIds' => $ids]);
    }

    /** 施加本商户功能模块可见性(公共菜单恒放行);集团账号与未做模块管控的商户不裁剪 */
    private function applyModuleScope(Builder $query): void
    {
        \App\Service\Merchant\MerchantAuthService::applyModuleScope(
            $query,
            MerchantContext::accountType(),
            MerchantContext::merchantId()
        );
    }

    /** 本主体、本 account_type 可见角色(内置 + 自定义) */
    private function scopedQuery(): Builder
    {
        $type = MerchantContext::accountType();
        return Db::table('merchant_role')->whereNull('deleted_at')
            ->where('account_type', $type)
            ->where(function (Builder $q) use ($type) {
                $q->where('is_builtin', 1); // 内置预设(全平台共享)
                if ($type === 1) {
                    $q->orWhere(function (Builder $q2) {
                        $q2->where('is_builtin', 0)->where('group_id', MerchantContext::groupId());
                    });
                } else {
                    $q->orWhere(function (Builder $q2) {
                        $q2->where('is_builtin', 0)->where('merchant_id', MerchantContext::merchantId());
                    });
                }
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

    /** 校验子账号属于当前主体、本 account_type */
    private function findScopedAccount(int $id): array
    {
        $query = Db::table('merchant_admin')->whereNull('deleted_at')
            ->where('account_type', MerchantContext::accountType())->where('id', $id);
        match (MerchantContext::accountType()) {
            1 => $query->where('group_id', MerchantContext::groupId()),
            3 => $query->where('store_id', MerchantContext::storeId()),
            default => $query->where('merchant_id', MerchantContext::merchantId()),
        };
        $account = $query->first();
        if (! $account) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '账号不存在或无权操作');
        }
        return (array) $account;
    }
}
