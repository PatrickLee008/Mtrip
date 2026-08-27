<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\MerchantContext;

/** Never store passwords, tokens or raw request payloads in activity descriptions. */
class MerchantActivityService
{
    public static function account(array $account, string $action, string $ip = '', ?int $actorId = null, ?string $actorName = null): void
    {
        Db::table('merchant_activity_log')->insert([
            'site_id' => $account['site_id'], 'merchant_id' => $account['merchant_id'],
            'activity_type' => $action === 'login' ? 'login' : 'account_change',
            'description' => 'Account ' . $account['id'] . ': ' . $action,
            'performed_by' => $actorName ?? (string) ($account['real_name'] ?: $account['username']),
            'performed_by_id' => $actorId ?? (int) $account['id'], 'actor_type' => 'merchant',
            'target_account_id' => $account['id'], 'entity_type' => (int) $account['account_type'] === 1 ? 'group' : 'account',
            'entity_id' => (int) $account['account_type'] === 1 ? $account['group_id'] : $account['id'], 'ip_address' => $ip,
        ]);
    }

    public static function changed(int $id, string $action, string $ip): void
    {
        $account = (array) Db::table('merchant_admin')->where('id', $id)->first();
        self::account($account, $action, $ip, MerchantContext::adminId(), MerchantContext::adminName());
    }
}
