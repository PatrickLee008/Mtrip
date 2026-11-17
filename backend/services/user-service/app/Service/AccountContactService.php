<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Account\AccountContact;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\RedisLock;

/**
 * 关联邮箱 / 关联手机号(Consumer App PRD 模块 19.2「账户安全」)
 *
 * 两条流程同一口径:输入 → 校验格式 → 与当前相同则行内拦截(不发码)→ 已被其他账号占用则拦截 →
 * 发验证码 → 验码成功后**才**写库。没完成验证前现有邮箱 / 手机号原样不动(PRD 通用规则)。
 *
 * 唯一性:手机号沿用 mobile_hash(站点内唯一索引 + 跨已启用站点查重,见 UserAuthService::isRegistered),
 * 邮箱新增 email_hash(迁移 V20261117141000)。写库前在「联系方式」维度加分布式锁并重新查重,
 * 防止两个账号同时验证同一个号码 / 邮箱。
 */
class AccountContactService
{
    public function __construct(
        protected UserAuthService $auth,
        protected SmsVerifyService $sms,
        protected EmailVerifyService $emailOtp,
        protected RedisLock $lock,
    ) {
    }

    // ---------------- 邮箱 ----------------

    /** @return array<string, mixed> */
    public function sendEmailCode(int $siteId, int $userId, string $input, string $ip): array
    {
        [$email, $hash] = $this->normalizeEmail($input);
        $user = $this->activeUser($userId);
        $this->assertEmailChanged($user, $email, $hash);
        $this->assertEmailAvailable($siteId, $userId, $hash);
        return $this->emailOtp->send($siteId, $userId, $email, $hash, $ip);
    }

    /** @return array<string, mixed> 最新资料 */
    public function bindEmail(int $siteId, int $userId, string $input, string $code, string $ip): array
    {
        [$email, $hash] = $this->normalizeEmail($input);
        $user = $this->activeUser($userId);
        $this->assertEmailChanged($user, $email, $hash);
        $this->emailOtp->verify($siteId, $userId, $hash, $code);

        $this->lock->run("mtrip:lock:user:contact:email:{$hash}", 10, function () use ($siteId, $userId, $email, $hash): void {
            $this->assertEmailAvailable($siteId, $userId, $hash);
            try {
                Db::table('user_info')->where('id', $userId)->update([
                    'email' => CryptoHelper::encrypt($email, $this->auth->aesKey()),
                    'email_hash' => $hash,
                ]);
            } catch (\Throwable $e) {
                if (str_contains($e->getMessage(), 'uk_site_email_hash') || str_contains($e->getMessage(), 'Duplicate entry')) {
                    throw new BusinessException(ErrorCode::CONTACT_IN_USE);
                }
                throw $e;
            }
        }, 'Request in progress, please wait');
        $this->auth->actionLog((int) $user['site_id'], $userId, 1, (string) $user['email'] === '' ? '关联邮箱' : '更换关联邮箱', $ip);

        return $this->auth->profile($userId);
    }

    // ---------------- 手机号 ----------------

    /** @return array<string, mixed> */
    public function sendPhoneCode(int $siteId, int $userId, string $input, string $ip): array
    {
        $mobile = $this->normalizeMobile($input);
        $user = $this->activeUser($userId);
        $this->assertMobileChanged($user, $mobile);
        $this->assertMobileAvailable($siteId, $userId, $mobile);
        return $this->sms->send($siteId, $mobile, SmsVerifyService::SCENE_BIND, $ip);
    }

    /** @return array<string, mixed> 最新资料 */
    public function bindPhone(int $siteId, int $userId, string $input, string $code, string $ip): array
    {
        $mobile = $this->normalizeMobile($input);
        $user = $this->activeUser($userId);
        $this->assertMobileChanged($user, $mobile);
        // 验码成功换一次性票据,立刻在本请求里兑换(票据与站点 + 场景 + 号码绑定)
        $ticket = $this->sms->verify($siteId, $mobile, SmsVerifyService::SCENE_BIND, $code)['verifyToken'];
        $this->sms->assertTicket($siteId, SmsVerifyService::SCENE_BIND, $mobile, $ticket);

        $hash = $this->auth->mobileHash($mobile);
        try {
            $this->lock->run("mtrip:lock:user:contact:mobile:{$hash}", 10, function () use ($siteId, $userId, $mobile, $hash): void {
                $this->assertMobileAvailable($siteId, $userId, $mobile);
                try {
                    Db::table('user_info')->where('id', $userId)->update([
                        'mobile' => CryptoHelper::encrypt($mobile, $this->auth->aesKey()),
                        'mobile_hash' => $hash,
                    ]);
                } catch (\Throwable $e) {
                    if (str_contains($e->getMessage(), 'uk_site_mobile_hash') || str_contains($e->getMessage(), 'Duplicate entry')) {
                        throw new BusinessException(ErrorCode::CONTACT_IN_USE);
                    }
                    throw $e;
                }
            }, 'Request in progress, please wait');
        } finally {
            $this->sms->discardTicket($ticket);
        }
        $this->auth->actionLog((int) $user['site_id'], $userId, 1, (string) $user['mobile'] === '' ? '关联手机号' : '更换关联手机号', $ip);

        return $this->auth->profile($userId);
    }

    // ---------------- 内部 ----------------

    /** @return array{0:string,1:string} [规范化邮箱, email_hash] */
    private function normalizeEmail(string $input): array
    {
        $email = AccountContact::email($input);
        if ($email === null) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'Please enter a valid email address');
        }
        return [$email, $this->emailHash($email)];
    }

    private function normalizeMobile(string $input): string
    {
        $mobile = AccountContact::myanmarMobile($input);
        if ($mobile === null) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'Please enter a valid Myanmar (+95) mobile number');
        }
        return $mobile;
    }

    public function emailHash(string $normalizedEmail): string
    {
        return hash_hmac('sha256', $normalizedEmail, $this->auth->aesKey());
    }

    /** @return array<string, mixed> */
    private function activeUser(int $userId): array
    {
        $user = Db::table('user_info')->where('id', $userId)->whereNull('deleted_at')->first();
        if (! $user || (int) $user->user_status !== 1) {
            throw new BusinessException(ErrorCode::FORBIDDEN, 'Account unavailable; please contact support');
        }
        return (array) $user;
    }

    /** @param array<string, mixed> $user */
    private function assertEmailChanged(array $user, string $email, string $hash): void
    {
        $current = (string) ($user['email_hash'] ?? '');
        $same = $current !== ''
            ? hash_equals($current, $hash)
            // 历史邮箱(Apple 登录带回)没有 hash,解密后比较
            : strtolower(trim($this->auth->decryptSafe((string) $user['email']))) === $email;
        // 未验证过的历史邮箱(无 hash)即使相同也允许走一次验证,把它变成「已验证」
        if ($same && $current !== '') {
            throw new BusinessException(ErrorCode::CONTACT_UNCHANGED, 'This email is already linked to your account');
        }
    }

    private function assertEmailAvailable(int $siteId, int $userId, string $hash): void
    {
        $taken = Db::table('user_info')
            ->where('email_hash', $hash)->where('id', '<>', $userId)
            ->whereIn('site_id', $this->auth->lookupSiteIds($siteId))
            ->whereNull('deleted_at')->exists();
        if ($taken) {
            throw new BusinessException(ErrorCode::CONTACT_IN_USE, 'This email is already linked to another mTrip account');
        }
    }

    /** @param array<string, mixed> $user */
    private function assertMobileChanged(array $user, string $mobile): void
    {
        $current = (string) ($user['mobile_hash'] ?? '');
        if ($current === '') {
            return;
        }
        foreach (AccountContact::mobileCandidates($mobile) as $candidate) {
            if (hash_equals($current, $this->auth->mobileHash($candidate))) {
                throw new BusinessException(ErrorCode::CONTACT_UNCHANGED, 'This phone number is already linked to your account');
            }
        }
    }

    private function assertMobileAvailable(int $siteId, int $userId, string $mobile): void
    {
        $hashes = array_map(fn (string $m) => $this->auth->mobileHash($m), AccountContact::mobileCandidates($mobile));
        $taken = Db::table('user_info')
            ->whereIn('mobile_hash', $hashes)->where('id', '<>', $userId)
            ->whereIn('site_id', $this->auth->lookupSiteIds($siteId))
            ->whereNull('deleted_at')->exists();
        if ($taken) {
            throw new BusinessException(ErrorCode::CONTACT_IN_USE, 'This phone number is already linked to another mTrip account');
        }
    }
}
