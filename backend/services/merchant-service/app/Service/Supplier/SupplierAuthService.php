<?php

declare(strict_types=1);

namespace App\Service\Supplier;

use App\Support\MenuTreeHelper;
use Carbon\Carbon;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\JwtHelper;

use function Hyperf\Config\config;

/**
 * 供应商端认证服务:登录 / JWT签发(aud=supplier)/ 动态菜单树 / 权限聚合
 * 供应商为单层主体;主账号 is_owner=1 拥有全部权限。
 */
class SupplierAuthService
{
    /**
     * 账号密码登录:校验账号与所属供应商状态,签发供应商端 JWT
     */
    public function login(string $username, string $password, string $ip): array
    {
        $admin = Db::table('supplier_admin')->where('username', $username)->whereNull('deleted_at')->first();
        if ($admin === null) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号或密码错误');
        }
        $admin = (array) $admin;

        if ((int) $admin['status'] !== 1) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '账号已禁用,请联系管理员');
        }
        if (! password_verify($password, (string) $admin['password'])) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号或密码错误');
        }

        $subjectName = $this->assertSupplierActive((int) $admin['supplier_id']);

        Db::table('supplier_admin')->where('id', $admin['id'])
            ->update(['last_login_at' => Carbon::now()->toDateTimeString()]);

        $isOwner = (int) $admin['is_owner'] === 1;
        // JWT 权限集合 = 可访问菜单的全部 perm_key(含目录/页面/按钮),供后端 #[Permission] 校验
        $permissions = $isOwner ? $this->allPerms() : $this->collectPermissions((int) $admin['id']);

        $token = JwtHelper::issue([
            'admin_id' => (int) $admin['id'],
            'admin_name' => $admin['real_name'] !== '' ? $admin['real_name'] : $admin['username'],
            'site_id' => (int) $admin['site_id'],
            'aud' => 'supplier',
            'supplier_id' => (int) $admin['supplier_id'],
            'is_owner' => $isOwner,
            'permissions' => $permissions,
        ], (string) config('mtrip.jwt_secret'), (int) config('mtrip.jwt_ttl', 7200));

        return [
            'token' => $token,
            'admin' => $this->profile($admin, $subjectName, $permissions),
        ];
    }

    /**
     * 账号概要(不返回密码;含供应商名称)
     */
    public function profile(array $admin, ?string $subjectName = null, ?array $permissions = null): array
    {
        $isOwner = (int) $admin['is_owner'] === 1;
        $subjectName ??= (string) (Db::table('supplier_info')->where('id', $admin['supplier_id'])->value('supplier_name') ?? '');
        $permissions ??= ($isOwner ? $this->allPerms() : $this->collectPermissions((int) $admin['id']));
        return [
            'id' => (int) $admin['id'],
            'username' => $admin['username'],
            'realName' => $admin['real_name'],
            'supplierId' => (int) $admin['supplier_id'],
            'isOwner' => $isOwner,
            'subjectName' => $subjectName,
            'permissions' => $permissions,
            'lastLoginAt' => (string) ($admin['last_login_at'] ?? ''),
        ];
    }

    /**
     * 动态菜单:按角色返回可见菜单树(目录+页面)与按钮权限集合
     */
    public function menus(int $adminId, bool $isOwner): array
    {
        $query = Db::table('supplier_menu')
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->orderBy('sort')->orderBy('id');
        if (! $isOwner) {
            $menuIds = $this->grantedMenuIds($adminId);
            $query->whereIn('id', $menuIds === [] ? [0] : $menuIds);
        }
        $rows = array_map(static fn ($row) => (array) $row, $query->get()->all());

        $menus = array_values(array_filter($rows, static fn (array $r) => in_array((int) $r['menu_type'], [1, 2], true)));
        $perms = array_values(array_unique(array_column(
            array_filter($rows, static fn (array $r) => (int) $r['menu_type'] === 3 && $r['perm_key'] !== ''),
            'perm_key'
        )));

        return [
            'menus' => MenuTreeHelper::build($menus),
            'perms' => $perms,
        ];
    }

    /**
     * 修改本人密码:校验旧密码,长度≥8且含字母数字
     */
    public function updatePassword(int $adminId, string $oldPassword, string $newPassword): void
    {
        $admin = Db::table('supplier_admin')->where('id', $adminId)->whereNull('deleted_at')->first();
        if ($admin === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '账号不存在');
        }
        if (! password_verify($oldPassword, (string) $admin->password)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '原密码错误');
        }
        if (strlen($newPassword) < 8 || ! preg_match('/[A-Za-z]/', $newPassword) || ! preg_match('/\d/', $newPassword)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '密码至少8位且需包含字母和数字');
        }
        Db::table('supplier_admin')->where('id', $adminId)
            ->update(['password' => password_hash($newPassword, PASSWORD_BCRYPT)]);
    }

    /**
     * 子账号可访问菜单ID集合(启用角色 → 角色菜单)
     */
    public function grantedMenuIds(int $adminId): array
    {
        return Db::table('supplier_admin_role as ar')
            ->join('supplier_role as r', 'r.id', '=', 'ar.role_id')
            ->join('supplier_role_menu as rm', 'rm.role_id', '=', 'r.id')
            ->where('ar.admin_id', $adminId)
            ->where('r.status', 1)
            ->whereNull('r.deleted_at')
            ->distinct()
            ->pluck('rm.menu_id')
            ->map(static fn ($id) => (int) $id)
            ->all();
    }

    /**
     * 聚合子账号全部权限标识(含目录/页面/按钮 perm_key,供后端接口鉴权)
     */
    public function collectPermissions(int $adminId): array
    {
        return Db::table('supplier_admin_role as ar')
            ->join('supplier_role as r', 'r.id', '=', 'ar.role_id')
            ->join('supplier_role_menu as rm', 'rm.role_id', '=', 'r.id')
            ->join('supplier_menu as m', 'm.id', '=', 'rm.menu_id')
            ->where('ar.admin_id', $adminId)
            ->where('r.status', 1)
            ->whereNull('r.deleted_at')
            ->whereNull('m.deleted_at')
            ->where('m.perm_key', '<>', '')
            ->distinct()
            ->pluck('m.perm_key')
            ->toArray();
    }

    /**
     * 全部权限标识(主账号放行用)
     */
    public function allPerms(): array
    {
        return Db::table('supplier_menu')
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->where('perm_key', '<>', '')
            ->distinct()
            ->pluck('perm_key')
            ->toArray();
    }

    /**
     * 校验账号所属供应商状态(仅已合作可登录),返回供应商名称
     */
    private function assertSupplierActive(int $supplierId): string
    {
        $supplier = Db::table('supplier_info')->where('id', $supplierId)->whereNull('deleted_at')->first();
        if ($supplier === null) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '所属供应商不存在');
        }
        if ((int) $supplier->status !== 1) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '供应商未处于合作状态,暂不可登录');
        }
        return (string) $supplier->supplier_name;
    }
}
