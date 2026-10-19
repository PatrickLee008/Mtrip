<?php

declare(strict_types=1);

namespace Mtrip\Shared\Chat;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessGuard;

/** Live chat authorization; never trust the role/property snapshot in a long-lived socket. */
final class ChatAccess
{
    public static function employee(int $id): array
    {
        $row = Db::table('merchant_admin')->where('id', $id)->where('status', 1)->whereNull('deleted_at')->first();
        if (! $row) throw new BusinessException(ErrorCode::FORBIDDEN);
        $account = (array) $row;
        MerchantAccessGuard::assertSubject($account);
        return $account;
    }

    public static function permission(array $account, string $key): bool
    {
        if ((int) $account['is_owner'] === 1) return true;
        return self::grants((int) $account['id'], $key)->exists();
    }

    private static function grants(int $id, string $key)
    {
        return Db::table('merchant_admin_role as ar')->join('merchant_role as r', 'r.id', '=', 'ar.role_id')
            ->join('merchant_role_menu as rm', 'rm.role_id', '=', 'r.id')->join('merchant_menu as m', 'm.id', '=', 'rm.menu_id')
            ->where('ar.admin_id', $id)->where('r.status', 1)->whereNull('r.deleted_at')
            ->where('m.perm_key', $key)->where('m.status', 1)->whereNull('m.deleted_at');
    }

    public static function properties(array $account): array
    {
        // Operating status must not revoke access to existing guest conversations.
        $q = Db::table('merchant_store')->where('site_id', $account['site_id'])->whereNull('deleted_at');
        if ((int) $account['account_type'] === 1) {
            $q->whereIn('merchant_id', Db::table('merchant_info')->where('group_id', $account['group_id'])
                ->where('site_id', $account['site_id'])->whereIn('status', [3, 4])->whereNull('deleted_at')
                ->whereNotIn('id', Db::table('merchant_blacklist')->where('status', 1)->select('merchant_id'))->select('id'));
        } elseif ((int) $account['account_type'] === 3) {
            $q->where('id', $account['store_id'])->where('merchant_id', $account['merchant_id']);
        } else {
            $q->where('merchant_id', $account['merchant_id']);
        }
        if (! $account['is_owner']) $q->whereIn('id', Db::table('merchant_employee_property')
            ->where('site_id', $account['site_id'])->where('admin_id', $account['id'])->select('property_id'));
        return $q->pluck('id')->map(static fn ($id) => (int) $id)->all();
    }

    public static function require(int $employeeId, int $propertyId, string $permission = 'mch:chat:list'): array
    {
        $a = self::employee($employeeId);
        if (! self::permission($a, $permission) || ! in_array($propertyId, self::properties($a), true)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $a;
    }

    public static function authorizedSince(array $a, int $propertyId): string
    {
        $since = $a['created_at'];
        if (! $a['is_owner']) {
            $propertySince = Db::table('merchant_employee_property')->where('admin_id', $a['id'])->where('property_id', $propertyId)->value('created_at');
            $roleSince = self::grants((int) $a['id'], 'mch:chat:list')->selectRaw('MIN(GREATEST(ar.created_at,rm.created_at)) AS since')->value('since');
            $since = max($since, $propertySince ?? $since, $roleSince ?? $since);
        }
        return (string) $since;
    }

    public static function handlers(int $siteId, int $propertyId): array
    {
        $result = [];
        foreach (Db::table('merchant_admin')->where('site_id', $siteId)->where('status', 1)->whereNull('deleted_at')->get() as $row) {
            try {
                $a = self::require((int) $row->id, $propertyId);
                if (self::permission($a, 'mch:chat:reply')) $result[] = ['id' => (int) $a['id'], 'name' => $a['real_name'] ?: $a['username']];
            } catch (BusinessException) {
                continue;
            }
        }
        return $result;
    }
}
