<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;
use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Affiliate\PayoutAccounts;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\Result;

class AffiliatePayoutAccountController extends AbstractController
{
    #[Inject]
    protected ConfigInterface $config;

    public function index(): array
    {
        $siteId = $this->requireSiteId();
        $profileId = $this->activeProfile($siteId);
        return Result::success([
            'accounts' => PayoutAccounts::summary($siteId, $profileId)->orderByDesc('a.id')->get()->all(),
            'providers' => Db::table('consumer_affiliate_payout_provider')->where('site_id', $siteId)
                ->where('enabled', 1)->orderBy('kind')->orderBy('name')->get(['id', 'kind', 'name'])->all(),
        ]);
    }

    public function save(): array
    {
        $siteId = $this->requireSiteId();
        $id = $this->intInput('id');
        $providerId = $this->requireId('providerId');
        $version = $this->intInput('version');
        $holder = $this->requireStr('holderName');
        $number = preg_replace('/[\s-]+/u', '', $this->requireStr('accountNumber')) ?? '';
        if (mb_strlen($holder) > 100 || ! preg_match('/^\+?[a-zA-Z0-9]{4,40}$/D', $number)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请输入有效的收款人和账号');
        }
        $key = (string) $this->config->get('mtrip.aes_key', '');
        if ($key === '') {
            throw new BusinessException(ErrorCode::SERVER_ERROR);
        }
        $fields = [
            'provider_id' => $providerId,
            'holder_cipher' => CryptoHelper::encrypt($holder, $key),
            'number_cipher' => CryptoHelper::encrypt($number, $key),
            'number_hash' => hash_hmac('sha256', $number, $key),
            'number_suffix' => substr($number, -4),
            'status' => 0,
            'is_default' => 0,
            'review_note' => '',
        ];
        $accountId = Db::transaction(function () use ($siteId, $id, $providerId, $version, $fields): int {
            $affiliateId = $this->activeProfile($siteId, true);
            if (! Db::table('consumer_affiliate_payout_provider')->where('site_id', $siteId)
                ->where('id', $providerId)->where('enabled', 1)->exists()) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '收款服务商不可用');
            }
            $accounts = Db::table('consumer_affiliate_payout_account')->where('site_id', $siteId)
                ->where('affiliate_id', $affiliateId);
            $sameNumberId = (int) (clone $accounts)->where('provider_id', $providerId)
                ->where('number_hash', $fields['number_hash'])->value('id');
            if ($id <= 0) {
                return $sameNumberId ?: (int) Db::table('consumer_affiliate_payout_account')
                    ->insertGetId($fields + ['site_id' => $siteId, 'affiliate_id' => $affiliateId]);
            }
            if ($sameNumberId > 0 && $sameNumberId !== $id) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该收款账号已存在');
            }
            $updated = $accounts->where('id', $id)->where('version', $version)
                ->update($fields + ['version' => $version + 1]);
            if ($updated !== 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT);
            }
            return $id;
        });
        return Result::success(['id' => $accountId]);
    }

    public function makeDefault(): array
    {
        $siteId = $this->requireSiteId();
        $id = $this->requireId();
        Db::transaction(function () use ($siteId, $id): void {
            $affiliateId = $this->activeProfile($siteId, true);
            $accounts = Db::table('consumer_affiliate_payout_account')->where('site_id', $siteId)
                ->where('affiliate_id', $affiliateId);
            $account = (clone $accounts)->where('id', $id)->where('status', 1)->lockForUpdate()->first();
            if ($account === null || ! Db::table('consumer_affiliate_payout_provider')->where('site_id', $siteId)
                ->where('id', $account->provider_id)->where('enabled', 1)->exists()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅可选择已核验的收款账户');
            }
            (clone $accounts)->where('is_default', 1)->update(['is_default' => 0]);
            $accounts->where('id', $id)->update(['is_default' => 1]);
        });
        return Result::success();
    }

    private function activeProfile(int $siteId, bool $lock = false): int
    {
        $query = Db::table('consumer_affiliate_profile as a')->join('user_info as u', 'u.id', '=', 'a.user_id')
            ->whereColumn('a.site_id', 'u.site_id')->where('a.site_id', $siteId)
            ->where('a.user_id', UserContext::userId())->where('a.status', 1)
            ->where('u.user_status', 1)->whereNull('u.deleted_at');
        $profileId = (int) ($lock ? $query->lockForUpdate() : $query)->value('a.id');
        if ($profileId <= 0) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $profileId;
    }
}
