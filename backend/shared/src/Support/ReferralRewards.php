<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Hyperf\DbConnection\Db;

/** 同一站点的推荐奖励配置，供实际发奖与消费者展示共用。未配置表示不发奖。 */
final class ReferralRewards
{
    /** @return array{inviterAmount: float, inviteeAmount: float, currency: string} */
    public static function forSite(int $siteId): array
    {
        $values = Db::connection('system')->table('sys_site_config')
            ->where('site_id', $siteId)
            ->whereIn('config_key', ['referral_reward_inviter', 'referral_reward_invitee'])
            ->whereNull('deleted_at')
            ->pluck('config_value', 'config_key');
        $currency = Db::connection('system')->table('sys_site')
            ->where('id', $siteId)->value('currency');
        return [
            'inviterAmount' => max(0.0, (float) ($values['referral_reward_inviter'] ?? 0)),
            'inviteeAmount' => max(0.0, (float) ($values['referral_reward_invitee'] ?? 0)),
            'currency' => (string) ($currency ?? ''),
        ];
    }
}
