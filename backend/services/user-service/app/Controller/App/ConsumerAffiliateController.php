<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;
use App\Service\UserAuthService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Support\Result;

class ConsumerAffiliateController extends AbstractController
{
    #[Inject]
    protected UserAuthService $authService;

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
            'referralCode' => $this->authService->referralCodeForUser(UserContext::userId()),
            'registeredReferrals' => Db::table('user_referral')->where('site_id', $siteId)
                ->where('consumer_affiliate_id', $profile->id)->count(),
            'linkOpens' => (int) Db::table('consumer_affiliate_link_daily')->where('site_id', $siteId)
                ->where('affiliate_id', $profile->id)->sum('opens'),
        ]);
    }

    public function recordOpen(): array
    {
        $code = $this->strInput('code');
        $propertyId = $this->intInput('propertyId');
        $siteId = $this->requireSiteId();
        if (! preg_match('/^[A-Z0-9]{4,32}$/iD', $code) || $propertyId < 0) {
            return Result::success();
        }

        // Only count opens for live affiliate codes and, when provided, a property in the same site.
        Db::statement(
            'INSERT INTO consumer_affiliate_link_daily (site_id, affiliate_id, property_id, opened_on, opens)
             SELECT a.site_id, a.id, ?, UTC_DATE(), 1
             FROM consumer_affiliate_profile a
             JOIN user_info u ON u.id = a.user_id AND u.site_id = a.site_id
             WHERE a.status = 1 AND a.site_id = ? AND u.referral_code = ?
               AND u.user_status = 1 AND u.deleted_at IS NULL
               AND (? = 0 OR EXISTS (
                   SELECT 1 FROM merchant_store p
                   WHERE p.id = ? AND p.site_id = a.site_id AND p.deleted_at IS NULL AND p.business_type = \'hotel\'
               ))
             ON DUPLICATE KEY UPDATE opens = opens + 1',
            [$propertyId, $siteId, strtoupper($code), $propertyId, $propertyId]
        );
        return Result::success();
    }
}
