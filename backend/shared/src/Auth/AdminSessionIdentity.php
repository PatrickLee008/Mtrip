<?php

declare(strict_types=1);

namespace Mtrip\Shared\Auth;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

final class AdminSessionIdentity
{
    public static function permissions(int $id): array
    {
        return Db::connection('system')->table('sys_admin_role as ar')
            ->join('sys_role as r', 'r.id', '=', 'ar.role_id')
            ->join('sys_role_menu as rm', 'rm.role_id', '=', 'r.id')
            ->join('sys_menu as m', 'm.id', '=', 'rm.menu_id')
            ->where('ar.admin_id', $id)->where('r.status', 1)->whereNull('r.deleted_at')
            ->whereNull('m.deleted_at')->where('m.perm_key', '<>', '')->distinct()->pluck('m.perm_key')->toArray();
    }

    public static function stamp(int $id): string
    {
        $admin = Db::connection('system')->table('sys_admin')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $admin || (int) $admin->status !== 1) throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号已禁用或删除');
        $permissions = (int) $admin->is_super === 1 ? [] : self::permissions($id);
        return self::fingerprint((string) $admin->password, (int) $admin->site_id, (int) $admin->is_super, $permissions);
    }

    public static function fingerprint(string $password, int $siteId, int $isSuper, array $permissions): string
    {
        sort($permissions);
        return hash('sha256', json_encode([$password, $siteId, $isSuper, $permissions]));
    }

    public static function assertSession(array $claims): void
    {
        if (! hash_equals(self::stamp((int) ($claims['admin_id'] ?? 0)), (string) ($claims['security_stamp'] ?? ''))) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号认证或授权已变更，请重新登录');
        }
    }
}
