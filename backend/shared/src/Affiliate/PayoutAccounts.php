<?php

declare(strict_types=1);

namespace Mtrip\Shared\Affiliate;

use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;

final class PayoutAccounts
{
    public static function summary(int $siteId, int $affiliateId): Builder
    {
        return Db::table('consumer_affiliate_payout_account as a')
            ->join('consumer_affiliate_payout_provider as p', 'p.id', '=', 'a.provider_id')
            ->whereColumn('a.site_id', 'p.site_id')->where('a.site_id', $siteId)
            ->where('a.affiliate_id', $affiliateId)
            ->select('a.id', 'a.provider_id', 'p.kind', 'p.name as provider_name', 'p.enabled as provider_enabled',
                'a.number_suffix', 'a.status', 'a.version', 'a.is_default', 'a.review_note', 'a.updated_at');
    }
}
