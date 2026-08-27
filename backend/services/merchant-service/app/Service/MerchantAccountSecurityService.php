<?php

declare(strict_types=1);

namespace App\Service;

use App\Service\Merchant\MerchantAuthService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
use Mtrip\Shared\Merchant\MerchantImpersonationGuard;
use Mtrip\Shared\Merchant\Totp;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\JwtHelper;

use function Hyperf\Config\config;

class MerchantAccountSecurityService
{
    public function begin(int $id, string $password): array
    {
        $result = Db::transaction(function () use ($id, $password) {
            $account = $this->account($id);
            $this->unlocked($account);
            if (! password_verify($password, $account['password'])) {
                $this->failure($account);
                return ['error' => true];
            }
            $token = JwtHelper::issue(['aud' => 'merchant_2fa', 'admin_id' => $id, 'auth_version' => $account['auth_version']], $this->key('jwt_secret'), 300);
            Db::table('merchant_admin')->where('id', $id)->update([
                'challenge_hash' => hash('sha256', $token), 'challenge_expires_at' => gmdate('Y-m-d H:i:s', time() + 300),
                'pending_secret_enc' => '',
            ]);
            return ['challengeToken' => $token, 'requiresEnrollment' => (int) $account['two_fa_status'] !== 1, 'expiresIn' => 300];
        });
        if (isset($result['error'])) throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号或密码错误');
        return $result;
    }

    public function setup(string $token): array
    {
        return Db::transaction(function () use ($token) {
            $account = $this->challenge($token);
            if ((int) $account['two_fa_status'] === 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '账号已注册身份验证器');
            $secret = $account['pending_secret_enc'] === '' ? Totp::secret() : CryptoHelper::decrypt($account['pending_secret_enc'], $this->key('aes_key'));
            if ($account['pending_secret_enc'] === '') {
                Db::table('merchant_admin')->where('id', $account['id'])->update(['pending_secret_enc' => CryptoHelper::encrypt($secret, $this->key('aes_key'))]);
            }
            return ['manualKey' => $secret, 'otpauthUri' => 'otpauth://totp/' . rawurlencode('mTrip:' . $account['username']) . '?secret=' . $secret . '&issuer=mTrip&algorithm=SHA1&digits=6&period=30'];
        });
    }

    public function verify(string $token, string $code, string $ip): array
    {
        $result = Db::transaction(function () use ($token, $code, $ip) {
            $account = $this->challenge($token);
            $enrolling = (int) $account['two_fa_status'] !== 1;
            $encrypted = $enrolling ? $account['pending_secret_enc'] : $account['two_fa_secret_enc'];
            if ($encrypted === '') throw new BusinessException(ErrorCode::DATA_CONFLICT, '请先设置身份验证器');
            $step = Totp::matchStep(CryptoHelper::decrypt($encrypted, $this->key('aes_key')), $code, (int) $account['last_accepted_totp_step']);
            if ($step === null) {
                $this->failure($account);
                return ['error' => true];
            }
            $update = [
                'two_fa_status' => 1, 'two_fa_method' => 'google_authenticator', 'two_fa_secret_enc' => $encrypted,
                'last_accepted_totp_step' => $step, 'challenge_hash' => null, 'challenge_expires_at' => null,
                'pending_secret_enc' => '', 'security_fail_count' => 0, 'security_locked_until' => null,
                'last_login_at' => gmdate('Y-m-d H:i:s'),
            ];
            if ($enrolling) $update['two_fa_enrolled_at'] = gmdate('Y-m-d H:i:s');
            Db::table('merchant_admin')->where('id', $account['id'])->update($update);
            if ($enrolling) MerchantActivityService::account($account, 'two_fa_enrolled', $ip);
            MerchantActivityService::account($account, 'login', $ip);
            return (new MerchantAuthService())->issueSession(array_replace($account, $update));
        });
        // Throw after the transaction commits so failed attempts cannot roll back their own lockout.
        if (isset($result['error'])) throw new BusinessException(ErrorCode::PARAM_ERROR, '验证码无效、已使用或过期');
        return $result;
    }

    public function reset(int $merchantId, int $accountId, int $expectedVersion, string $reason): void
    {
        $this->assertSuper();
        $reason = trim($reason);
        if ($reason === '' || mb_strlen($reason) > 200) throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写200字以内的重置原因');
        Db::transaction(function () use ($merchantId, $accountId, $expectedVersion, $reason) {
            $merchant = $this->merchant($merchantId);
            $account = $this->scopedAccounts($merchant)->where('id', $accountId)->lockForUpdate()->first();
            if (! $account) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '账号不属于所选商户或集团');
            if ((int) $account->auth_version !== $expectedVersion) throw new BusinessException(ErrorCode::DATA_CONFLICT, '账号安全状态已变更，请刷新');
            Db::table('merchant_admin')->where('id', $accountId)->update([
                'two_fa_status' => 2, 'two_fa_method' => '', 'two_fa_secret_enc' => '', 'pending_secret_enc' => '',
                'two_fa_enrolled_at' => null, 'two_fa_last_reset_at' => gmdate('Y-m-d H:i:s'),
                'auth_version' => $expectedVersion + 1, 'last_accepted_totp_step' => -1,
                'challenge_hash' => null, 'challenge_expires_at' => null, 'security_fail_count' => 0, 'security_locked_until' => null,
            ]);
            Db::table('merchant_activity_log')->insert([
                'site_id' => $account->site_id, 'merchant_id' => $account->merchant_id,
                'activity_type' => 'account_change', 'description' => '2FA reset: ' . $reason,
                'performed_by_id' => AdminContext::adminId(), 'performed_by' => AdminContext::adminName(),
                'actor_type' => 'admin', 'target_account_id' => $accountId,
                'entity_type' => (int) $account->account_type === 1 ? 'group' : 'account',
                'entity_id' => (int) $account->account_type === 1 ? $account->group_id : $accountId,
            ]);
        });
    }

    public function accounts(int $merchantId): array
    {
        $this->assertSuper();
        return $this->scopedAccounts($this->merchant($merchantId))->orderBy('account_type')->orderBy('id')
            ->get(['id', 'username', 'real_name', 'account_type', 'status', 'two_fa_status', 'two_fa_method', 'two_fa_enrolled_at', 'two_fa_last_reset_at', 'auth_version'])
            ->map(static fn ($row) => (array) $row)->all();
    }

    public function assertSuper(): void
    {
        if (! AdminContext::isSuper()) throw new BusinessException(ErrorCode::FORBIDDEN, '仅授权超级管理员可操作');
        MerchantImpersonationGuard::operator(AdminContext::adminId());
    }

    public function merchant(int $id): array
    {
        $merchant = Db::table('merchant_info')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $merchant) throw new BusinessException(ErrorCode::NOT_FOUND);
        if (AdminContext::siteId() > 0 && (int) $merchant->site_id !== AdminContext::siteId()) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        return (array) $merchant;
    }

    private function scopedAccounts(array $merchant): \Hyperf\Database\Query\Builder
    {
        return Db::table('merchant_admin')->where('site_id', $merchant['site_id'])->whereNull('deleted_at')
            ->where(function ($query) use ($merchant) {
                $query->where(function ($q) use ($merchant) { $q->where('merchant_id', $merchant['id'])->whereIn('account_type', [2, 3]); });
                if ((int) $merchant['group_id'] > 0) $query->orWhere(function ($q) use ($merchant) { $q->where('group_id', $merchant['group_id'])->where('account_type', 1); });
            });
    }

    private function account(int $id): array
    {
        $account = Db::table('merchant_admin')->where('id', $id)->where('status', 1)->whereNull('deleted_at')->lockForUpdate()->first();
        if (! $account) throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号已失效');
        MerchantAccessGuard::assertSubject((array) $account);
        return (array) $account;
    }

    private function challenge(string $token): array
    {
        $claims = JwtHelper::verify($token, $this->key('jwt_secret'));
        if (($claims['aud'] ?? '') !== 'merchant_2fa') throw new BusinessException(ErrorCode::UNAUTHORIZED);
        $account = $this->account((int) ($claims['admin_id'] ?? 0));
        if ((int) $account['auth_version'] !== (int) ($claims['auth_version'] ?? 0)
            || ! hash_equals((string) $account['challenge_hash'], hash('sha256', $token))
            || ! $account['challenge_expires_at'] || strtotime($account['challenge_expires_at'] . ' UTC') <= time()) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED, '登录验证已失效，请重新登录');
        }
        $this->unlocked($account);
        return $account;
    }

    private function unlocked(array $account): void
    {
        if ($account['security_locked_until'] && strtotime($account['security_locked_until'] . ' UTC') > time()) throw new BusinessException(ErrorCode::TOO_MANY_REQUESTS, '验证失败次数过多，请15分钟后重试');
    }

    private function failure(array $account): void
    {
        $count = (int) $account['security_fail_count'] + 1;
        Db::table('merchant_admin')->where('id', $account['id'])->update([
            'security_fail_count' => $count >= 5 ? 0 : $count,
            'security_locked_until' => $count >= 5 ? gmdate('Y-m-d H:i:s', time() + 900) : null,
        ]);
        MerchantActivityService::account($account, $count >= 5 ? 'authentication_locked' : 'authentication_failed');
    }

    private function key(string $name): string
    {
        $key = (string) config('mtrip.' . $name);
        if ($key === '') throw new BusinessException(ErrorCode::SERVER_ERROR, '认证密钥未配置');
        return $key;
    }
}
