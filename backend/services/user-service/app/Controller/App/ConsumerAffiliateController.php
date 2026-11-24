<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Support\Result;

class ConsumerAffiliateController extends AbstractController
{
    public function access(): array
    {
        $siteId = $this->requireSiteId();
        $profile = Db::table('consumer_affiliate_profile as a')
            ->join('user_info as u', 'a.user_id', '=', 'u.id')
            ->where('a.site_id', $siteId)->whereColumn('u.site_id', 'a.site_id')
            ->where('a.user_id', UserContext::userId())->where('a.status', 1)
            ->where('u.user_status', 1)->whereNull('u.deleted_at')
            ->first(['a.id', 'a.affiliate_type', 'a.activated_at']);

        return Result::success($profile === null ? ['active' => false] : [
            'active' => true,
            'affiliateId' => (int) $profile->id,
            'affiliateType' => $profile->affiliate_type,
            'activatedAt' => $profile->activated_at,
            'registeredReferrals' => Db::table('user_referral')->where('site_id', $siteId)
                ->where('consumer_affiliate_id', $profile->id)->count(),
        ]);
    }
}
