<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Affiliate\PayoutAccounts;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class AffiliatePayoutAccountController extends AbstractController
{
    #[Permission('affiliate:payout-provider:manage')]
    public function providers(): array
    {
        $siteId = $this->requireId('siteId');
        $this->assertSiteScope($siteId);
        return Result::success(Db::table('consumer_affiliate_payout_provider')->where('site_id', $siteId)
            ->orderBy('kind')->orderBy('name')->get()->all());
    }

    #[Permission('affiliate:payout-provider:manage')]
    public function saveProvider(): array
    {
        $siteId = $this->requireId('siteId');
        $this->assertSiteScope($siteId);
        $id = $this->intInput('id');
        $enabled = $this->intInput('enabled', 1);
        if (! in_array($enabled, [0, 1], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR);
        }
        if ($id > 0) {
            $provider = Db::table('consumer_affiliate_payout_provider')->where('site_id', $siteId)->where('id', $id);
            if (! (clone $provider)->exists()) {
                throw new BusinessException(ErrorCode::NOT_FOUND);
            }
            $provider->update(['enabled' => $enabled]);
        } else {
            $kind = $this->requireStr('kind');
            $name = $this->requireStr('name');
            if (! in_array($kind, ['bank', 'wallet'], true) || mb_strlen($name) > 80
                || ! Db::connection('system')->table('sys_site')->where('id', $siteId)->exists()) {
                throw new BusinessException(ErrorCode::PARAM_ERROR);
            }
            Db::table('consumer_affiliate_payout_provider')->insertOrIgnore([
                'site_id' => $siteId, 'kind' => $kind, 'name' => $name, 'enabled' => $enabled,
            ]);
        }
        return Result::success();
    }

    #[Permission('affiliate:payout-account:verify')]
    public function index(): array
    {
        $profile = Db::table('consumer_affiliate_profile')->where('id', $this->requireId('affiliateId'))
            ->first(['id', 'site_id']);
        if ($profile === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND);
        }
        $this->assertSiteScope((int) $profile->site_id);
        return Result::success(PayoutAccounts::summary((int) $profile->site_id, (int) $profile->id)
            ->orderByDesc('a.id')->get()->all());
    }

    #[Permission('affiliate:payout-account:verify')]
    public function inspect(): array
    {
        $account = $this->scopedAccount($this->requireId());
        $holder = $this->decryptField($account->holder_cipher);
        $number = $this->decryptField($account->number_cipher);
        if ($holder === '' || $number === '') {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '无法读取收款资料');
        }
        $this->audit($account, 'inspected');
        return Result::success([
            'holderName' => $holder,
            'accountNumber' => $number,
            'version' => (int) $account->version,
        ]);
    }

    #[Permission('affiliate:payout-account:verify')]
    public function review(): array
    {
        $id = $this->requireId();
        $version = $this->requireId('version');
        $status = $this->intInput('status');
        $reason = $this->strInput('reason');
        if (! in_array($status, [1, 2], true) || ($status === 2 && $reason === '') || mb_strlen($reason) > 500) {
            throw new BusinessException(ErrorCode::PARAM_ERROR);
        }
        Db::transaction(function () use ($id, $version, $status, $reason): void {
            $account = $this->scopedAccount($id, true);
            if ((int) $account->version !== $version) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '收款资料已更新，请重新核验');
            }
            if ((int) $account->status === $status) {
                return;
            }
            if ((int) $account->status !== 0 || ($status === 1 && ! Db::table('consumer_affiliate_payout_provider')
                ->where('site_id', $account->site_id)->where('id', $account->provider_id)->where('enabled', 1)->exists())) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT);
            }
            if ($status === 1 && ($this->decryptField($account->holder_cipher) === '' || $this->decryptField($account->number_cipher) === '')) {
                throw new BusinessException(ErrorCode::SERVER_ERROR, '无法读取收款资料');
            }
            Db::table('consumer_affiliate_payout_account')->where('id', $id)
                ->update(['status' => $status, 'review_note' => $reason]);
            $this->audit($account, $status === 1 ? 'verified' : 'rejected', $reason);
        });
        return Result::success();
    }

    private function scopedAccount(int $id, bool $lock = false): object
    {
        $query = Db::table('consumer_affiliate_payout_account')->where('id', $id);
        $this->applySiteScope($query);
        $row = ($lock ? $query->lockForUpdate() : $query)->first();
        if ($row === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND);
        }
        return $row;
    }

    private function audit(object $account, string $action, string $reason = ''): void
    {
        Db::table('consumer_affiliate_payout_audit')->insert([
            'site_id' => (int) $account->site_id,
            'account_id' => (int) $account->id,
            'version' => (int) $account->version,
            'admin_id' => AdminContext::adminId(),
            'action' => $action,
            'reason' => $reason,
        ]);
    }
}
