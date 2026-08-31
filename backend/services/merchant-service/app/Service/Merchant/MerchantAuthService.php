<?php

declare(strict_types=1);

namespace App\Service\Merchant;

use App\Support\MenuTreeHelper;
use App\Support\MerchantModule;

use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\JwtHelper;


use function Hyperf\Config\config;

/**
 * 商户端认证服务:登录 / JWT签发(aud=merchant)/ 动态菜单树 / 权限聚合
 * 账号类型 account_type:1集团 2商户 3门店;主账号 is_owner=1 拥有本类型全部权限。
 */
class MerchantAuthService
{
    /**
     * 密码验证只签发受限challenge，完成2FA后才能获得商户业务JWT。
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

        return (new \App\Service\MerchantAccountSecurityService())->begin((int) $admin['id'], $password);
    }

    /** Only called after a consumed 2FA challenge or a validated one-time support exchange. */
    public function issueSession(array $admin, array $support = []): array
    {
        $permissions = $this->profile($admin)['permissions'];
        $claims = [
            'admin_id' => (int) $admin['id'], 'admin_name' => $admin['real_name'] ?: $admin['username'],
            'site_id' => (int) $admin['site_id'], 'aud' => 'merchant',
            'account_type' => (int) $admin['account_type'], 'group_id' => (int) $admin['group_id'],
            'merchant_id' => (int) $admin['merchant_id'], 'store_id' => (int) $admin['store_id'],
            'is_owner' => (int) $admin['is_owner'] === 1, 'permissions' => $permissions,
            'auth_version' => (int) $admin['auth_version'], 'amr' => $support === [] ? 'totp' : 'support',
        ];
        $ttl = (int) config('mtrip.jwt_ttl', 7200);
        if ($support !== []) {
            $claims['actor_admin_id'] = (int) $support['operator_id'];
            $claims['impersonation_session_id'] = (int) $support['id'];
            $ttl = max(1, strtotime($support['expires_at'] . ' UTC') - time());
        }
        $profile = $this->profile($admin, null, $permissions);
        if ($support !== []) {
            $profile['isOwner'] = false;
            $profile['permissions'] = [];
            $profile['impersonation'] = ['sessionId' => (int) $support['id'], 'actorName' => $support['operator_name'], 'expiresAt' => str_replace(' ', 'T', $support['expires_at']) . 'Z'];
        }
        return ['token' => JwtHelper::issue($claims, (string) config('mtrip.jwt_secret'), $ttl), 'admin' => $profile];
    }

    /**
     * 账号概要(不返回密码;含主体名称与账号类型)
     */
    public function profile(array $admin, ?string $subjectName = null, ?array $permissions = null): array
    {
        $accountType = (int) $admin['account_type'];
        $isOwner = (int) $admin['is_owner'] === 1;
        $subjectName ??= $this->subjectName($admin);
        $merchantId = (int) $admin['merchant_id'];
        $permissions ??= ($isOwner
            ? $this->allPermsForType($accountType, $merchantId)
            : $this->collectPermissions((int) $admin['id'], $accountType, $merchantId));
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
    public function menus(int $adminId, int $accountType, bool $isOwner, int $merchantId = 0): array
    {
        $query = Db::table('merchant_menu')
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->whereRaw('FIND_IN_SET(?, account_scope)', [$accountType])
            ->orderBy('sort')->orderBy('id');
        self::applyModuleScope($query, $accountType, $merchantId);
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
        if (strlen($newPassword) < 8 || ! preg_match('/[A-Za-z]/', $newPassword) || ! preg_match('/\d/', $newPassword)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '密码至少8位且需包含字母和数字');
        }
        Db::transaction(function () use ($adminId, $oldPassword, $newPassword) {
            $admin = Db::table('merchant_admin')->where('id', $adminId)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $admin || ! password_verify($oldPassword, (string) $admin->password)) throw new BusinessException(ErrorCode::PARAM_ERROR, '原密码错误');
            Db::table('merchant_admin')->where('id', $adminId)->update(['password' => password_hash($newPassword, PASSWORD_BCRYPT), 'auth_version' => Db::raw('auth_version + 1'), 'challenge_hash' => null, 'pending_secret_enc' => '']);
            \App\Service\MerchantActivityService::account((array) $admin, 'password_changed');
        });
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
    public function collectPermissions(int $adminId, int $accountType = 0, int $merchantId = 0): array
    {
        $query = Db::table('merchant_admin_role as ar')
            ->join('merchant_role as r', 'r.id', '=', 'ar.role_id')
            ->join('merchant_role_menu as rm', 'rm.role_id', '=', 'r.id')
            ->join('merchant_menu as m', 'm.id', '=', 'rm.menu_id')
            ->where('ar.admin_id', $adminId)
            ->where('r.status', 1)
            ->whereNull('r.deleted_at')
            ->whereNull('m.deleted_at')
            ->where('m.perm_key', '<>', '');
        self::applyModuleScope($query, $accountType, $merchantId, 'm.');
        return $query->distinct()->pluck('m.perm_key')->toArray();
    }

    /**
     * 指定账号类型可见的全部权限标识(主账号放行用)
     */
    public function allPermsForType(int $accountType, int $merchantId = 0): array
    {
        $query = Db::table('merchant_menu')
            ->where('status', 1)
            ->whereNull('deleted_at')
            ->where('perm_key', '<>', '')
            ->whereRaw('FIND_IN_SET(?, account_scope)', [$accountType]);
        self::applyModuleScope($query, $accountType, $merchantId);
        return $query->distinct()->pluck('perm_key')->toArray();
    }

    /**
     * 施加功能模块可见性:公共菜单(module_key='')恒放行,业务菜单需商户已获授权。
     * 商户无任何授权行 → 不裁剪(向后兼容);集团账号(accountType=1)→ 不裁剪。
     */
    public static function applyModuleScope(Builder $query, int $accountType, int $merchantId, string $prefix = ''): void
    {
        $modules = MerchantModule::visibleModules($accountType, $merchantId);
        if ($modules === null) {
            return;
        }
        $column = $prefix . 'module_key';
        $query->where(static function (Builder $q) use ($column, $modules) {
            $q->where($column, '')->orWhereIn($column, $modules);
        });
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
