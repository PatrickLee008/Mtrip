<?php

declare(strict_types=1);

namespace App\Service;

use App\Service\Merchant\MerchantAuthService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
use Mtrip\Shared\Merchant\MerchantImpersonationGuard as Guard;

class MerchantImpersonationService
{
    public function start(int $merchantId, int $accountId, string $reason): array
    {
        $security = new MerchantAccountSecurityService();
        $security->assertSuper();
        $reason = trim($reason);
        if ($reason === '' || mb_strlen($reason) > 200 || $reason === 'other' || $reason === 'other:') throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写有效的代为登录原因（最多200字）');
        return Db::transaction(function () use ($security, $merchantId, $accountId, $reason) {
            $merchant = $security->merchant($merchantId);
            $account = Db::table('merchant_admin')->where('id', $accountId)->where('merchant_id', $merchantId)->where('site_id', $merchant['site_id'])
                ->whereIn('account_type', [2, 3])->where('status', 1)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $account) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '请选择该商户的有效账号；集团账号不支持代为登录');
            MerchantAccessGuard::assertSubject((array) $account);
            if (Db::table('merchant_impersonation_session')->where('operator_id', AdminContext::adminId())->where('target_account_id', $accountId)
                ->where('status', 1)->where('expires_at', '>', gmdate('Y-m-d H:i:s'))->exists()) throw new BusinessException(ErrorCode::DATA_CONFLICT, '该账号已有进行中的代为登录会话，请先结束');
            $exchange = bin2hex(random_bytes(32));
            $session = [
                'site_id' => $merchant['site_id'], 'merchant_id' => $merchantId, 'target_account_id' => $accountId,
                'operator_id' => AdminContext::adminId(), 'operator_name' => AdminContext::adminName(), 'reason' => $reason,
                'session_key' => 'IMP-' . bin2hex(random_bytes(12)), 'auth_version' => $account->auth_version, 'status' => 1,
                'exchange_hash' => hash('sha256', $exchange), 'exchange_expires_at' => gmdate('Y-m-d H:i:s', time() + 60),
                'expires_at' => gmdate('Y-m-d H:i:s', time() + 1800),
            ];
            $session['id'] = (int) Db::table('merchant_impersonation_session')->insertGetId($session);
            Guard::audit($session, 'started', $reason);
            return ['session_id' => $session['id'], 'session_key' => $session['session_key'], 'exchangeCode' => $exchange, 'expiresAt' => $session['expires_at'] . 'Z'];
        });
    }

    public function exchange(string $code): array
    {
        if (! preg_match('/^[a-f0-9]{64}$/D', $code)) throw new BusinessException(ErrorCode::UNAUTHORIZED);
        // All auth transitions lock account before session, including reset/exchange/request/logout.
        $hint = Db::table('merchant_impersonation_session')->where('exchange_hash', hash('sha256', $code))->first();
        if (! $hint) throw new BusinessException(ErrorCode::UNAUTHORIZED, '一次性凭证无效');
        return Db::transaction(function () use ($hint, $code) {
            $account = Db::table('merchant_admin')->where('id', $hint->target_account_id)->where('status', 1)->whereNull('deleted_at')->lockForUpdate()->first();
            $session = Db::table('merchant_impersonation_session')->where('id', $hint->id)->lockForUpdate()->first();
            if (! $account || ! $session || (int) $session->status !== 1 || $session->exchanged_at
                || ! hash_equals((string) $session->exchange_hash, hash('sha256', $code))
                || strtotime($session->exchange_expires_at . ' UTC') <= time() || strtotime($session->expires_at . ' UTC') <= time()
                || (int) $account->auth_version !== (int) $session->auth_version
                || (int) $account->merchant_id !== (int) $session->merchant_id || (int) $account->site_id !== (int) $session->site_id
                || ! in_array((int) $account->account_type, [2, 3], true)) throw new BusinessException(ErrorCode::UNAUTHORIZED, '一次性凭证已失效');
            Guard::operator((int) $session->operator_id);
            MerchantAccessGuard::assertSubject((array) $account);
            Db::table('merchant_impersonation_session')->where('id', $session->id)->update(['exchanged_at' => gmdate('Y-m-d H:i:s'), 'exchange_hash' => null]);
            Guard::audit((array) $session, 'exchanged', 'Support session authenticated');
            return (new MerchantAuthService())->issueSession((array) $account, (array) $session);
        });
    }

    public function end(int $sessionId, bool $fromMerchant = false): void
    {
        if (! $fromMerchant) (new MerchantAccountSecurityService())->assertSuper();
        Db::transaction(function () use ($sessionId, $fromMerchant) {
            $session = Db::table('merchant_impersonation_session')->where('id', $sessionId)->lockForUpdate()->first();
            if (! $session) throw new BusinessException(ErrorCode::NOT_FOUND);
            if (! $fromMerchant && ((int) $session->operator_id !== AdminContext::adminId()
                || (AdminContext::siteId() > 0 && (int) $session->site_id !== AdminContext::siteId()))) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
            if ((int) $session->status !== 1) return;
            Db::table('merchant_impersonation_session')->where('id', $sessionId)->update(['status' => 2, 'ended_at' => gmdate('Y-m-d H:i:s'), 'exchange_hash' => null]);
            Guard::audit((array) $session, 'ended', 'Support session revoked');
        });
    }

    public function expire(): int
    {
        $ids = Db::table('merchant_impersonation_session')->where('status', 1)->whereNotNull('target_account_id')
            ->where('expires_at', '<=', gmdate('Y-m-d H:i:s'))->orderBy('id')->limit(200)->pluck('id')->all();
        $count = 0;
        foreach ($ids as $id) {
            $count += Db::transaction(function () use ($id) {
                $row = Db::table('merchant_impersonation_session')->where('id', $id)->where('status', 1)->lockForUpdate()->first();
                if (! $row) return 0;
                Db::table('merchant_impersonation_session')->where('id', $id)->update(['status' => 2, 'ended_at' => gmdate('Y-m-d H:i:s'), 'exchange_hash' => null]);
                Guard::audit((array) $row, 'expired', 'Support session expired (system)');
                return 1;
            });
        }
        return $count;
    }
}
