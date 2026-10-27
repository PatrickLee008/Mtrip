<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessGuard;

/** Support uses live grants and supports every property business type. */
final class SupportAccess
{
    public const ACTIONS = ['list', 'create', 'reply', 'close', 'reopen', 'merchant-scope', 'guides'];

    public static function employee(int $id): array
    {
        $row = Db::table('merchant_admin')->where('id', $id)->where('status', 1)->whereNull('deleted_at')->first();
        if (! $row) throw new BusinessException(ErrorCode::FORBIDDEN);
        MerchantAccessGuard::assertSubject((array) $row);
        return (array) $row;
    }

    public static function permission(array $account, string $key): bool
    {
        if ($key === 'mch:support:merchant-scope' && ! in_array((int) $account['account_type'], [1, 2], true)) return false;
        $q = Db::table('merchant_menu as m')->where('m.perm_key', $key)->where('m.status', 1)->whereNull('m.deleted_at')
            ->whereRaw('FIND_IN_SET(?, m.account_scope)', [(int) $account['account_type']]);
        if (! $account['is_owner']) {
            $q->join('merchant_role_menu as rm', 'rm.menu_id', '=', 'm.id')->join('merchant_role as r', 'r.id', '=', 'rm.role_id')
                ->join('merchant_admin_role as ar', 'ar.role_id', '=', 'r.id')->where('ar.admin_id', $account['id'])
                ->whereIn('r.site_id', [0, (int) $account['site_id']])->where('r.status', 1)->whereNull('r.deleted_at');
        }
        return $q->exists();
    }

    public static function merchants(array $a): array
    {
        $q = Db::table('merchant_info')->where('site_id', $a['site_id'])->whereIn('status', [3, 4])->whereNull('deleted_at')
            ->whereNotIn('id', Db::table('merchant_blacklist')->where('status', 1)->select('merchant_id'));
        if ((int) $a['account_type'] === 1) $q->where('group_id', $a['group_id']);
        else $q->where('id', $a['merchant_id']);
        return $q->pluck('id')->map(static fn ($id) => (int) $id)->all();
    }

    public static function properties(array $a): array
    {
        $q = Db::table('merchant_store')->where('site_id', $a['site_id'])->whereNull('deleted_at')->whereIn('merchant_id', self::merchants($a));
        if ((int) $a['account_type'] === 3) $q->where('id', $a['store_id']);
        if (! $a['is_owner']) $q->whereIn('id', Db::table('merchant_employee_property')->where('site_id', $a['site_id'])
            ->where('admin_id', $a['id'])->select('property_id'));
        return $q->pluck('id')->map(static fn ($id) => (int) $id)->all();
    }

    public static function merchantScope(Builder $q, array $a, string $alias = 't', bool $selected = true): Builder
    {
        $q->where($alias . '.site_id', $a['site_id'])->whereIn($alias . '.merchant_id', self::merchants($a));
        $ids = self::properties($a);
        $property = $selected ? MerchantContext::selectedPropertyId() : 0;
        if ($property > 0) return $q->whereIn($alias . '.property_id', in_array($property, $ids, true) ? [$property] : [-1]);
        return $q->where(static function ($scope) use ($ids, $a, $alias) {
            $scope->whereIn($alias . '.property_id', $ids ?: [-1]);
            if (self::permission($a, 'mch:support:merchant-scope')) $scope->orWhereNull($alias . '.property_id');
        });
    }

    public static function requireMerchant(string $permission = 'mch:support:list'): array
    {
        $a = self::employee(MerchantContext::adminId());
        if (! self::permission($a, 'mch:support:list') || ! self::permission($a, $permission)) throw new BusinessException(ErrorCode::FORBIDDEN);
        return $a;
    }

    public static function admin(int $id, string $permission, ?int $site = null): array
    {
        $row = Db::connection('system')->table('sys_admin')->where('id', $id)->where('status', 1)->whereNull('deleted_at')->first();
        if (! $row) throw new BusinessException(ErrorCode::FORBIDDEN);
        $a = (array) $row;
        $super = (int) $a['site_id'] === 0 && (int) $a['is_super'] === 1;
        if ($site !== null && ! $super && (int) $a['site_id'] !== $site) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        if (! $super && ! Db::connection('system')->table('sys_admin_role as ar')->join('sys_role as r', 'r.id', '=', 'ar.role_id')
            ->join('sys_role_menu as rm', 'rm.role_id', '=', 'r.id')->join('sys_menu as m', 'm.id', '=', 'rm.menu_id')
            ->where('ar.admin_id', $id)->whereIn('r.site_id', [0, (int) $a['site_id']])->where('r.status', 1)->whereNull('r.deleted_at')->where('m.status', 1)->whereNull('m.deleted_at')
            ->where('m.perm_key', $permission)->exists()) throw new BusinessException(ErrorCode::FORBIDDEN);
        return $a;
    }

    public static function notificationScope(Builder $q): void
    {
        $a = self::employee(MerchantContext::adminId());
        $q->where(static function ($scope) use ($a) {
            $scope->where('n.deep_link_type', '!=', 'support_ticket');
            if (self::permission($a, 'mch:support:list')) $scope->orWhereExists(static function ($tickets) use ($a) {
                $tickets->selectRaw('1')->from('merchant_support_ticket as st')->whereRaw('CAST(st.id AS CHAR) = n.deep_link_value')
                    ->whereColumn('st.merchant_id', 'n.merchant_id')->whereColumn('st.site_id', 'n.site_id');
                self::merchantScope($tickets, $a, 'st', false);
            });
        });
    }
}
