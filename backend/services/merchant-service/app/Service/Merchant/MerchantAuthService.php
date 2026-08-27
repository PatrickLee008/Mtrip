<?php

declare(strict_types=1);

namespace App\Service\Merchant;

use App\Support\MenuTreeHelper;
use Carbon\Carbon;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\JwtHelper;
use Mtrip\Shared\Merchant\MerchantAccessGuard;

use function Hyperf\Config\config;

/**
 * 商户端认证服务:登录 / JWT签发(aud=merchant)/ 动态菜单树 / 权限聚合
 * 账号类型 account_type:1集团 2商户 3门店;主账号 is_owner=1 拥有本类型全部权限。
 */
class MerchantAuthService
{
    /**
     * 账号密码登录:校验账号与所属主体状态,签发商户端 JWT
     */
    public function login(string $username, string $password, string $ip): array
    {
        $admin = Db::table('merchant_admin')->where('username', $username)->whereNull('deleted_at')->first();
        // PRD 模块 11:商户可用访问码 + 一次性初始密码登录。访问码是主账号登录别名，账号实体仍为 merchant_admin。
        if ($admin === null) {
            $merchantId = (int) (Db::table('merchant_info')
                ->where('access_code', strtoupper($username))
                ->whereIn('status', [3, 4])
                ->whereNull('deleted_at')
                ->value('id') ?? 0);
            if ($merchantId > 0) {
                $admin = Db::table('merchant_admin')
                    ->where('merchant_id', $merchantId)
                    ->where('account_type', 2)
                    ->where('is_owner', 1)
                    ->whereNull('deleted_at')
                    ->first();
            }
        }
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

        MerchantAccessGuard::assertSubject($admin);
        $subjectName = $this->subjectName($admin);

        Db::table('merchant_admin')->where('id', $admin['id'])
            ->update(['last_login_at' => Carbon::now()->toDateTimeString()]);

        $accountType = (int) $admin['account_type'];
        $isOwner = (int) $admin['is_owner'] === 1;
        // JWT 权限集合 = 可访问菜单的全部 perm_key(含目录/页面/按钮),供后端 #[Permission] 校验
        $permissions = $isOwner
            ? $this->allPermsForType($accountType)
            : $this->collectPermissions((int) $admin['id']);

        $token = JwtHelper::issue([
            'admin_id' => (int) $admin['id'],
            'admin_name' => $admin['real_name'] !== '' ? $admin['real_name'] : $admin['username'],
            'site_id' => (int) $admin['site_id'],
            'aud' => 'merchant',
            'account_type' => $accountType,
            'group_id' => (int) $admin['group_id'],
            'merchant_id' => (int) $admin['merchant_id'],
            'store_id' => (int) $admin['store_id'],
            'is_owner' => $isOwner,
            'permissions' => $permissions,
        ], (string) config('mtrip.jwt_secret'), (int) config('mtrip.jwt_ttl', 7200));

        return [
            'token' => $token,
            'admin' => $this->profile($admin, $subjectName, $permissions),
        ];
    }

    /**
     * 账号概要(不返回密码;含主体名称与账号类型)
     */
    public function profile(array $admin, ?string $subjectName = null, ?array $permissions = null): array
    {
        $accountType = (int) $admin['account_type'];
        $isOwner = (int) $admin['is_owner'] === 1;
        $subjectName ??= $this->subjectName($admin);
        $permissions ??= ($isOwner ? $this->allPermsForType($accountType) : $this->collectPermissions((int) $admin['id']));
        return [
            'id' => (int) $admin['id'],
            'username' => $admin['username'],
            'realName' => $admin['real_name'],
            'accountType' => $accountType,
            'groupId' => (int) $admin['group_id'],
            'merchantId' => (int) $admin['merchant_id'],
            'storeId' => (int) $admin['store_id'],
            'isOwner' => $isOwner,
            'subjectName' => $subjectName,
            'permissions' => $permissions,
            'lastLoginAt' => (string) ($admin['last_login_at'] ?? ''),
            'bookingRestricted' => $accountType !== 1 && (int) Db::table('merchant_info')->where('id', $admin['merchant_id'])->value('status') === 4,
        ];
    }

    /**
     * 动态菜单:按 account_type + 角色返回可见菜单树(目录+页面)与按钮权限集合
     */
    public function menus(int $adminId, int $accountType, bool $isOwner): array
    {
        $query = Db::table('merchant_menu')
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->whereRaw('FIND_IN_SET(?, account_scope)', [$accountType])
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
        $admin = Db::table('merchant_admin')->where('id', $adminId)->whereNull('deleted_at')->first();
        if ($admin === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '账号不存在');
        }
        if (! password_verify($oldPassword, (string) $admin->password)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '原密码错误');
        }
        if (strlen($newPassword) < 8 || ! preg_match('/[A-Za-z]/', $newPassword) || ! preg_match('/\d/', $newPassword)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '密码至少8位且需包含字母和数字');
        }
        Db::table('merchant_admin')->where('id', $adminId)
            ->update(['password' => password_hash($newPassword, PASSWORD_BCRYPT)]);
    }

    /**
     * 子账号可访问菜单ID集合(启用角色 → 角色菜单)
     */
    public function grantedMenuIds(int $adminId): array
    {
        return Db::table('merchant_admin_role as ar')
            ->join('merchant_role as r', 'r.id', '=', 'ar.role_id')
            ->join('merchant_role_menu as rm', 'rm.role_id', '=', 'r.id')
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
        return Db::table('merchant_admin_role as ar')
            ->join('merchant_role as r', 'r.id', '=', 'ar.role_id')
            ->join('merchant_role_menu as rm', 'rm.role_id', '=', 'r.id')
            ->join('merchant_menu as m', 'm.id', '=', 'rm.menu_id')
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
     * 指定账号类型可见的全部权限标识(主账号放行用)
     */
    public function allPermsForType(int $accountType): array
    {
        return Db::table('merchant_menu')
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->where('perm_key', '<>', '')
            ->whereRaw('FIND_IN_SET(?, account_scope)', [$accountType])
            ->distinct()
            ->pluck('perm_key')
            ->toArray();
    }




    /** 账号主体名称(用于顶栏展示) */
    private function subjectName(array $admin): string
    {
        return match ((int) $admin['account_type']) {
            1 => (string) (Db::table('merchant_group')->where('id', $admin['group_id'])->value('group_name') ?? ''),
            3 => (string) (Db::table('merchant_store')->where('id', $admin['store_id'])->value('store_name') ?? ''),
            default => (string) (Db::table('merchant_info')->where('id', $admin['merchant_id'])->value('merchant_name') ?? ''),
        };
    }
}
