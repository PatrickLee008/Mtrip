<?php

declare(strict_types=1);

namespace App\Service;

use App\Model\SysAdmin;
use App\Model\SysMenu;
use App\Support\TreeHelper;
use Carbon\Carbon;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\JwtHelper;
use Mtrip\Shared\Support\MaskHelper;

use function Hyperf\Config\config;

/**
 * 认证服务:登录(失败锁定)/ JWT签发 / 权限聚合 / 动态菜单树(文档模块 登录鉴权+3)
 */
class AuthService
{
    /** 登录记录状态:1成功 2密码错误 3账号锁定 4账号禁用 */
    private const LOGIN_OK = 1;

    private const LOGIN_BAD_PASSWORD = 2;

    private const LOGIN_LOCKED = 3;

    private const LOGIN_DISABLED = 4;

    /**
     * 账号密码登录:连续失败锁定、登录留痕、签发 JWT
     */
    public function login(string $username, string $password, string $ip, string $userAgent): array
    {
        /** @var SysAdmin|null $admin */
        $admin = SysAdmin::query()->where('username', $username)->first();
        if ($admin === null) {
            // 不暴露账号是否存在
            throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号或密码错误');
        }

        if ($admin->status !== 1) {
            $this->writeLoginLog($admin, $ip, $userAgent, self::LOGIN_DISABLED, '账号已禁用');
            throw new BusinessException(ErrorCode::FORBIDDEN, '账号已禁用,请联系管理员');
        }

        if ($admin->locked_until !== null && Carbon::parse((string) $admin->locked_until)->isFuture()) {
            $this->writeLoginLog($admin, $ip, $userAgent, self::LOGIN_LOCKED, '账号锁定中');
            throw new BusinessException(ErrorCode::FORBIDDEN, '账号已锁定,请稍后再试');
        }

        if (! password_verify($password, (string) $admin->password)) {
            $failLimit = (int) config('mtrip.login_fail_limit', 5);
            $admin->login_fail_count = $admin->login_fail_count + 1;
            $remark = '密码错误';
            if ($admin->login_fail_count >= $failLimit) {
                $lockMinutes = (int) config('mtrip.login_lock_minutes', 30);
                $admin->locked_until = Carbon::now()->addMinutes($lockMinutes)->toDateTimeString();
                $admin->login_fail_count = 0;
                $remark = "密码错误达{$failLimit}次,锁定{$lockMinutes}分钟";
            }
            $admin->save();
            $this->writeLoginLog($admin, $ip, $userAgent, self::LOGIN_BAD_PASSWORD, $remark);
            throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号或密码错误');
        }

        // 登录成功:清零失败计数、刷新登录信息
        $admin->login_fail_count = 0;
        $admin->locked_until = null;
        $admin->last_login_at = Carbon::now()->toDateTimeString();
        $admin->last_login_ip = $ip;
        $admin->save();
        $this->writeLoginLog($admin, $ip, $userAgent, self::LOGIN_OK, '登录成功');

        $permissions = $admin->is_super === 1 ? [] : $this->collectPermissions((int) $admin->id);
        $token = JwtHelper::issue([
            'admin_id' => (int) $admin->id,
            'admin_name' => $admin->real_name !== '' ? $admin->real_name : $admin->username,
            'site_id' => (int) $admin->site_id,
            'is_super' => $admin->is_super === 1,
            'permissions' => $permissions,
        ], (string) config('mtrip.jwt_secret'), (int) config('mtrip.jwt_ttl', 7200));

        return [
            'token' => $token,
            'admin' => $this->profile($admin, $permissions),
        ];
    }

    /**
     * 管理员概要信息(手机号脱敏,不返回密码)
     */
    public function profile(SysAdmin $admin, ?array $permissions = null): array
    {
        $permissions ??= ($admin->is_super === 1 ? [] : $this->collectPermissions((int) $admin->id));
        return [
            'id' => (int) $admin->id,
            'username' => $admin->username,
            'realName' => $admin->real_name,
            'avatar' => $admin->avatar,
            'email' => MaskHelper::email($admin->email),
            'siteId' => (int) $admin->site_id,
            'isSuper' => $admin->is_super === 1,
            'permissions' => $permissions,
            'lastLoginAt' => (string) $admin->last_login_at,
        ];
    }

    /**
     * 聚合管理员全部权限标识:启用角色 → 角色菜单 → perm_key 集合
     */
    public function collectPermissions(int $adminId): array
    {
        return Db::table('sys_admin_role as ar')
            ->join('sys_role as r', 'r.id', '=', 'ar.role_id')
            ->join('sys_role_menu as rm', 'rm.role_id', '=', 'r.id')
            ->join('sys_menu as m', 'm.id', '=', 'rm.menu_id')
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
     * 动态菜单:按角色返回可见菜单树(目录+页面)与按钮权限集合
     */
    public function menus(int $adminId, bool $isSuper): array
    {
        $query = SysMenu::query()->where('status', 1)->orderBy('sort')->orderBy('id');
        if (! $isSuper) {
            $menuIds = Db::table('sys_admin_role as ar')
                ->join('sys_role as r', 'r.id', '=', 'ar.role_id')
                ->join('sys_role_menu as rm', 'rm.role_id', '=', 'r.id')
                ->where('ar.admin_id', $adminId)
                ->where('r.status', 1)
                ->whereNull('r.deleted_at')
                ->distinct()
                ->pluck('rm.menu_id')
                ->toArray();
            $query->whereIn('id', $menuIds === [] ? [0] : $menuIds);
        }
        $rows = $query->get()->toArray();

        $menus = array_values(array_filter($rows, static fn (array $row) => in_array($row['menu_type'], [1, 2], true)));
        $perms = array_values(array_unique(array_column(
            array_filter($rows, static fn (array $row) => $row['menu_type'] === 3 && $row['perm_key'] !== ''),
            'perm_key'
        )));

        return [
            'menus' => TreeHelper::build($menus),
            'perms' => $perms,
        ];
    }

    /**
     * 修改本人密码:校验旧密码,长度≥8且含字母数字
     */
    public function updatePassword(int $adminId, string $oldPassword, string $newPassword): void
    {
        /** @var SysAdmin|null $admin */
        $admin = SysAdmin::query()->find($adminId);
        if ($admin === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '账号不存在');
        }
        if (! password_verify($oldPassword, (string) $admin->password)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '原密码错误');
        }
        self::assertPasswordStrength($newPassword);
        $admin->password = password_hash($newPassword, PASSWORD_BCRYPT);
        $admin->save();
    }

    /** 密码强度校验(文档安全策略:至少8位,含字母与数字) */
    public static function assertPasswordStrength(string $password): void
    {
        if (strlen($password) < 8 || ! preg_match('/[A-Za-z]/', $password) || ! preg_match('/\d/', $password)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '密码至少8位且需包含字母和数字');
        }
    }

    private function writeLoginLog(SysAdmin $admin, string $ip, string $userAgent, int $status, string $remark): void
    {
        Db::table('sys_admin_login_log')->insert([
            'admin_id' => (int) $admin->id,
            'username' => $admin->username,
            'site_id' => (int) $admin->site_id,
            'login_ip' => $ip,
            'user_agent' => mb_substr($userAgent, 0, 250),
            'status' => $status,
            'remark' => $remark,
            'created_at' => Carbon::now()->toDateTimeString(),
        ]);
    }
}
