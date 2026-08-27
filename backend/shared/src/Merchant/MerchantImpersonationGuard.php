<?php

declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/** Explicit support capabilities; unknown routes and all financial/security operations fail closed. */
final class MerchantImpersonationGuard
{
    public static function operator(int $id): array
    {
        $admin = Db::connection('system')->table('sys_admin')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $admin || (int) $admin->status !== 1 || (int) $admin->is_super !== 1
            || ($admin->locked_until !== null && strtotime($admin->locked_until . ' UTC') > time())) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅当前有效的超级管理员可执行账号安全操作');
        }
        return (array) $admin;
    }

    public static function assertSession(array $claims): array
    {
        $row = Db::table('merchant_impersonation_session')->where('id', (int) ($claims['impersonation_session_id'] ?? 0))->first();
        if (! $row || (int) $row->status !== 1 || ! $row->exchanged_at || ! $row->expires_at
            || strtotime($row->expires_at . ' UTC') <= time()
            || (int) $row->operator_id !== (int) ($claims['actor_admin_id'] ?? 0)
            || (int) $row->target_account_id !== (int) ($claims['admin_id'] ?? 0)
            || (int) $row->merchant_id !== (int) ($claims['merchant_id'] ?? 0)
            || (int) $row->site_id !== (int) ($claims['site_id'] ?? 0)
            || (int) $row->auth_version !== (int) ($claims['auth_version'] ?? 0)
            || ! in_array((int) ($claims['account_type'] ?? 0), [2, 3], true)) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED, '代为登录会话已失效，请重新进入');
        }
        self::operator((int) $row->operator_id);
        return (array) $row;
    }

    /** Recheck current target grants; never expand beyond the permissions issued for this session. */
    public static function permissions(array $claims): array
    {
        $query = Db::table('merchant_menu as m')->where('m.status', 1)->whereNull('m.deleted_at')
            ->whereRaw('FIND_IN_SET(?, m.account_scope)', [(int) $claims['account_type']]);
        if (! ($claims['is_owner'] ?? false)) {
            $query->join('merchant_role_menu as rm', 'rm.menu_id', '=', 'm.id')
                ->join('merchant_role as r', 'r.id', '=', 'rm.role_id')
                ->join('merchant_admin_role as ar', 'ar.role_id', '=', 'r.id')
                ->where('ar.admin_id', $claims['admin_id'])->where('r.status', 1)->whereNull('r.deleted_at');
        }
        return array_values(array_intersect((array) ($claims['permissions'] ?? []), $query->distinct()->pluck('m.perm_key')->all()));
    }

    public static function allowed(string $method, string $path): bool
    {
        $routes = [
            'GET' => ['auth/me', 'auth/menus', 'stats/dashboard', 'order/list', 'order/detail',
                'rooms/hotel-options', 'rooms/list', 'rooms/detail', 'availability/options', 'availability/calendar', 'availability/logs',
                'promotions/summary', 'promotions/list', 'promotions/detail', 'reviews/list', 'reviews/summary',
                'notifications/list', 'notifications/summary', 'notifications/destination'],
            'POST' => ['auth/logout', 'auth/impersonation/end'],
        ];
        return in_array($path, array_map(static fn ($route) => '/api/v1/merchant/' . $route, $routes[$method] ?? []), true);
    }

    public static function audit(array $session, string $action, string $description): void
    {
        Db::table('merchant_activity_log')->insert([
            'site_id' => $session['site_id'], 'merchant_id' => $session['merchant_id'],
            'activity_type' => 'impersonation', 'description' => mb_substr($action . ': ' . $description, 0, 255),
            'performed_by' => $session['operator_name'], 'performed_by_id' => $session['operator_id'],
            'actor_type' => 'admin', 'target_account_id' => $session['target_account_id'],
            'entity_type' => 'account', 'entity_id' => $session['target_account_id'],
            'impersonation_session_id' => $session['id'],
        ]);
    }
}
