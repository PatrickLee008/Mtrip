<?php

declare(strict_types=1);

namespace App\Service;

use App\Service\Merchant\MerchantAuthService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\Totp;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\SmsPohClient;
use Mtrip\Shared\Support\SmtpClient;

use function Hyperf\Config\config;

/** First activation, OTP login, Google linking and account recovery. */
class MerchantAuthenticationService
{
    private const OTP_TTL = 300;
    private const IDENTITY_TTL = 900;
    private const RESEND_AFTER = 60;
    private const MAX_ATTEMPTS = 5;

    public function __construct(
        private readonly MerchantAccountSecurityService $security,
        private readonly MerchantAuthService $auth
    ) {
    }

    public function config(): array
    {
        return [
            'methods' => ['access_code', 'email', 'sms', 'google'],
            'googleAvailable' => $this->googleClientIds() !== [],
            'otpExpiresIn' => self::OTP_TTL,
            'resendAfter' => self::RESEND_AFTER,
            'maxAttempts' => self::MAX_ATTEMPTS,
            'biometricAvailableOnWeb' => false,
            'testMode' => MerchantAuthTestMode::enabled(),
        ];
    }

    public function startActivation(int $siteId, string $accessCode, string $username, string $temporaryPassword, string $ip): array
    {
        $result = Db::transaction(function () use ($siteId, $accessCode, $username, $temporaryPassword): array {
            $account = null;
            if ($accessCode !== '') {
                $merchantQuery = Db::table('merchant_info')->where('access_code_normalized', strtoupper(trim($accessCode)))
                    ->where('status', 1)->whereNull('deleted_at');
                if ($siteId > 0) $merchantQuery->where('site_id', $siteId);
                $merchant = $merchantQuery->lockForUpdate()->first();
                if ($merchant) {
                    $account = Db::table('merchant_admin')->where('merchant_id', $merchant->id)->where('site_id', $merchant->site_id)
                        ->where('account_type', 2)->where('is_owner', 1)->where('status', 2)->whereNull('deleted_at')->lockForUpdate()->first();
                }
            } elseif ($username !== '' && $temporaryPassword !== '') {
                $query = Db::table('merchant_admin')->where('username', trim($username))->where('account_type', 2)
                    ->where('is_owner', 1)->where('status', 2)->whereNull('deleted_at');
                if ($siteId > 0) $query->where('site_id', $siteId);
                $candidate = $query->lockForUpdate()->first();
                if ($candidate && password_verify($temporaryPassword, (string) $candidate->password)) {
                    $merchant = Db::table('merchant_info')->where('id', $candidate->merchant_id)->where('site_id', $candidate->site_id)
                        ->where('status', 1)->whereNull('deleted_at')->lockForUpdate()->first();
                    if ($merchant) $account = $candidate;
                } elseif ($candidate) {
                    $this->authenticationFailure((array) $candidate, 'activation_credential_failed');
                    return ['error' => true];
                }
            }
            if (! $account) return ['error' => true];
            $this->assertUnlocked((array) $account);
            return (array) $account;
        });
        if (isset($result['error'])) throw new BusinessException(ErrorCode::UNAUTHORIZED, '激活凭证无效');
        $account = $result;

        $token = $this->newToken();
        Db::table('merchant_auth_challenge')->where('account_id', $account['id'])->where('purpose', 'activation_identity')
            ->where('status', 'pending')->update(['status' => 'expired']);
        Db::table('merchant_auth_challenge')->insert([
            'site_id' => $account['site_id'], 'account_id' => $account['id'], 'purpose' => 'activation_identity',
            'method' => $accessCode !== '' ? 'access_code' : 'temporary_password', 'token_hash' => hash('sha256', $token),
            'status' => 'pending', 'expires_at' => gmdate('Y-m-d H:i:s', time() + self::IDENTITY_TTL),
            'request_ip_hash' => $this->ipHash($ip),
        ]);
        MerchantActivityService::account($account, 'activation_started', $ip);
        return ['activationToken' => $token, 'expiresIn' => self::IDENTITY_TTL, 'profile' => $this->profile($account, false)];
    }

    public function activationProfile(string $token): array
    {
        $challenge = $this->challenge($token, ['activation_identity', 'activation'], ['pending', 'verified']);
        $account = $this->account((int) $challenge['account_id'], [2]);
        return $this->profile($account, $challenge['purpose'] === 'activation' && $challenge['status'] === 'verified');
    }

    public function sendActivationOtp(string $identityToken, string $channel, string $ip): array
    {
        $challenge = $this->challenge($identityToken, ['activation_identity'], ['pending']);
        $account = $this->account((int) $challenge['account_id'], [2]);
        return $this->createOtp($account, 'activation', $channel, $channel, $ip);
    }

    public function verifyActivationOtp(string $token, string $code, string $ip): array
    {
        $challenge = $this->verifyOtp($token, $code, 'activation', $ip);
        $account = $this->account((int) $challenge['account_id'], [2]);
        $field = $this->otpChannel((string) $challenge['method']) === 'email' ? 'verified_email_at' : 'verified_mobile_at';
        Db::table('merchant_admin')->where('id', $account['id'])->update([$field => gmdate('Y-m-d H:i:s')]);
        MerchantActivityService::account($account, 'activation_contact_verified', $ip);
        return ['activationToken' => $token, 'expiresIn' => max(1, strtotime($challenge['expires_at'] . ' UTC') - time()), 'profile' => $this->profile($this->account((int) $account['id'], [2]), true)];
    }

    public function setupActivationTotp(string $token): array
    {
        $account = $this->verifiedAccount($token, 'activation', [2]);
        if ((int) $account['two_fa_status'] === 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '身份验证器已关联');
        $secret = $account['pending_secret_enc'] === '' ? Totp::secret() : CryptoHelper::decrypt((string) $account['pending_secret_enc'], $this->aesKey());
        if ($account['pending_secret_enc'] === '') {
            Db::table('merchant_admin')->where('id', $account['id'])->update(['pending_secret_enc' => CryptoHelper::encrypt($secret, $this->aesKey())]);
        }
        return $this->totpSetup($account, $secret);
    }

    public function verifyActivationTotp(string $token, string $code, string $ip): array
    {
        $account = $this->verifiedAccount($token, 'activation', [2]);
        $this->saveTotp($account, $code, $ip, 'activation_authenticator_linked');
        return $this->profile($this->account((int) $account['id'], [2]), true);
    }

    public function linkGoogle(string $token, string $idToken, string $ip): array
    {
        $account = $this->verifiedAccount($token, 'activation', [2]);
        $identity = $this->verifyGoogleIdToken($idToken);
        $subjectHash = $this->googleHash($identity['issuer'], $identity['subject']);
        try {
            Db::table('merchant_admin')->where('id', $account['id'])->update([
                'google_subject_hash' => $subjectHash,
                'google_email' => CryptoHelper::encrypt($identity['email'], $this->aesKey()),
                'google_linked_at' => gmdate('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该 Google 账号已关联其他商户账号');
        }
        MerchantActivityService::account($account, 'google_linked', $ip);
        return $this->profile($this->account((int) $account['id'], [2]), true);
    }

    public function finishActivation(string $token, string $ip): array
    {
        $accountId = (int) $this->challenge($token, ['activation'], ['verified'])['account_id'];
        $result = Db::transaction(function () use ($token, $accountId, $ip): array {
            $challenge = $this->challenge($token, ['activation'], ['verified'], true);
            $account = $this->account($accountId, [2], true);
            $merchant = Db::table('merchant_info')->where('id', $account['merchant_id'])->where('site_id', $account['site_id'])
                ->where('status', 1)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $merchant) throw new BusinessException(ErrorCode::DATA_CONFLICT, '商户当前不能完成激活');
            if (! $account['verified_email_at'] && ! $account['verified_mobile_at']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '请先完成注册联系方式 OTP 验证');
            }
            $now = gmdate('Y-m-d H:i:s');
            $method = $this->otpChannel((string) $challenge['method']);
            Db::table('merchant_admin')->where('id', $account['id'])->update([
                'status' => 1, 'activated_at' => $now, 'last_login_at' => $now,
                'last_login_method' => 'activation_' . $method . '_otp',
                'password' => password_hash(bin2hex(random_bytes(32)), PASSWORD_BCRYPT),
                'auth_version' => (int) $account['auth_version'] + 1,
                'pending_secret_enc' => (int) $account['two_fa_status'] === 1 ? $account['pending_secret_enc'] : '',
                'security_fail_count' => 0, 'security_locked_until' => null,
            ]);
            Db::table('merchant_info')->where('id', $merchant->id)->update(['status' => 3]);
            $updated = Db::table('merchant_application')->where('merchant_id', $merchant->id)->where('site_id', $merchant->site_id)
                ->where('account_status', 1)->update(['account_status' => 2, 'last_updated_at' => $now]);
            if ($updated !== 1) throw new BusinessException(ErrorCode::DATA_CONFLICT, '入驻申请账号状态异常');
            Db::table('merchant_auth_challenge')->where('id', $challenge['id'])->update(['status' => 'consumed', 'consumed_at' => $now]);
            Db::table('merchant_auth_challenge')->where('account_id', $account['id'])->where('id', '<>', $challenge['id'])
                ->whereIn('status', ['pending', 'verified'])->update(['status' => 'expired']);
            $active = $this->account((int) $account['id'], [1]);
            MerchantActivityService::account($active, 'account_activated', $ip);
            MerchantActivityService::account($active, 'login', $ip);
            return ['account' => $active, 'amr' => 'activation_' . $method . '_otp'];
        });
        return $this->auth->issueSession($result['account'], [], $result['amr']);
    }

    public function loginChallenge(int $siteId, string $method, string $identifier, string $googleIdToken, string $ip): array
    {
        if ($method === 'access_code') {
            $pending = Db::table('merchant_application as a')->join('merchant_info as m', 'm.id', '=', 'a.merchant_id')
                ->where('m.access_code_normalized', strtoupper(trim($identifier)))->where('m.status', 1)
                ->where('a.account_status', 1)->whereNotNull('a.final_approved_at')
                ->whereNull('a.deleted_at')->whereNull('m.deleted_at');
            if ($siteId > 0) $pending->where('a.site_id', $siteId);
            if ($pending->exists()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '账号尚未激活，请在首次激活页面使用访问码完成激活');
            }
            return array_merge($this->security->beginWithAccessCode($identifier), [
                'method' => 'access_code', 'verification' => 'totp', 'recipient' => '',
            ]);
        }
        if ($method === 'google') {
            $identity = $this->verifyGoogleIdToken($googleIdToken);
            $account = $this->findGoogleAccount($siteId, $this->googleHash($identity['issuer'], $identity['subject']));
            if (! $account) return $this->decoyChallenge($siteId, 'login', 'google:email', $ip);
            $channel = $account['verified_email_at'] ? 'email' : ($account['verified_mobile_at'] ? 'sms' : '');
            if ($channel === '') return $this->decoyChallenge($siteId, 'login', 'google:email', $ip);
            return $this->createOtp($account, 'login', 'google:' . $channel, $channel, $ip, $this->googleHash($identity['issuer'], $identity['subject']));
        }
        if (! in_array($method, ['email', 'sms'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR, '登录方式不受支持');
        $account = $this->findContactAccount($siteId, $method, $identifier);
        return $account ? $this->createOtp($account, 'login', $method, $method, $ip) : $this->decoyChallenge($siteId, 'login', $method, $ip);
    }

    public function verifyLogin(string $method, string $token, string $code, string $ip): array
    {
        if ($method === 'access_code') return $this->security->verify($token, $code, $ip);
        $challenge = $this->verifyOtp($token, $code, 'login', $ip);
        if ((int) $challenge['account_id'] <= 0) throw new BusinessException(ErrorCode::SMS_CODE_INVALID);
        $account = $this->account((int) $challenge['account_id'], [1], true);
        $amr = str_starts_with((string) $challenge['method'], 'google:')
            ? 'google_mtrip_otp' : $this->otpChannel((string) $challenge['method']) . '_otp';
        $now = gmdate('Y-m-d H:i:s');
        Db::table('merchant_auth_challenge')->where('id', $challenge['id'])->where('status', 'verified')
            ->update(['status' => 'consumed', 'consumed_at' => $now]);
        Db::table('merchant_admin')->where('id', $account['id'])->update(['last_login_at' => $now, 'last_login_method' => $amr]);
        MerchantActivityService::account($account, 'login', $ip);
        return $this->auth->issueSession(array_replace($account, ['last_login_at' => $now, 'last_login_method' => $amr]), [], $amr);
    }

    public function recoveryChallenge(int $siteId, string $method, string $identifier, string $ip): array
    {
        if (! in_array($method, ['email', 'sms'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR, '恢复方式不受支持');
        $account = $this->findContactAccount($siteId, $method, $identifier);
        return $account ? $this->createOtp($account, 'recovery', $method, $method, $ip) : $this->decoyChallenge($siteId, 'recovery', $method, $ip);
    }

    public function verifyRecoveryOtp(string $token, string $code, string $ip): array
    {
        $challenge = $this->verifyOtp($token, $code, 'recovery', $ip);
        if ((int) $challenge['account_id'] <= 0) throw new BusinessException(ErrorCode::SMS_CODE_INVALID);
        $account = $this->account((int) $challenge['account_id'], [1]);
        MerchantActivityService::account($account, 'recovery_contact_verified', $ip);
        return ['recoveryToken' => $token, 'expiresIn' => max(1, strtotime($challenge['expires_at'] . ' UTC') - time())];
    }

    public function setupRecoveryTotp(string $token): array
    {
        $account = $this->verifiedAccount($token, 'recovery', [1]);
        $secret = Totp::secret();
        Db::table('merchant_admin')->where('id', $account['id'])->update(['pending_secret_enc' => CryptoHelper::encrypt($secret, $this->aesKey())]);
        return $this->totpSetup($account, $secret);
    }

    public function verifyRecoveryTotp(string $token, string $code, string $ip): array
    {
        $result = Db::transaction(function () use ($token, $code, $ip): array {
            $challenge = $this->challenge($token, ['recovery'], ['verified'], true);
            $account = $this->account((int) $challenge['account_id'], [1], true);
            try {
                $this->saveTotp($account, $code, $ip, 'account_recovered');
            } catch (BusinessException $e) {
                return ['error' => $e];
            }
            $now = gmdate('Y-m-d H:i:s');
            Db::table('merchant_auth_challenge')->where('id', $challenge['id'])->update(['status' => 'consumed', 'consumed_at' => $now]);
            Db::table('merchant_admin')->where('id', $account['id'])->update([
                'auth_version' => Db::raw('auth_version + 1'), 'challenge_hash' => null, 'challenge_expires_at' => null,
            ]);
            return $this->account((int) $account['id'], [1]);
        });
        if (isset($result['error'])) throw $result['error'];
        $account = $result;
        $now = gmdate('Y-m-d H:i:s');
        Db::table('merchant_admin')->where('id', $account['id'])->update(['last_login_at' => $now, 'last_login_method' => 'totp_recovery']);
        MerchantActivityService::account($account, 'login', $ip);
        return $this->auth->issueSession(array_replace($account, ['last_login_at' => $now]), [], 'totp');
    }

    /** @return array{challengeToken:string,method:string,verification:string,recipient:string,expiresIn:int,resendAfter:int} */
    private function createOtp(array $account, string $purpose, string $method, string $channel, string $ip, string $googleHash = ''): array
    {
        $this->assertOtpChannel($channel);
        return Db::transaction(function () use ($account, $purpose, $method, $channel, $ip, $googleHash): array {
            $account = $this->account((int) $account['id'], [(int) $account['status']], true);
            $this->assertUnlocked($account);
            $recipientCiphertext = (string) ($channel === 'email' ? $account['email'] : $account['mobile']);
            $recipient = $this->decrypt($recipientCiphertext);
            if ($recipient === '') throw new BusinessException(ErrorCode::DATA_CONFLICT, '账号缺少可验证联系方式');
            $latest = Db::table('merchant_auth_challenge')->where('account_id', $account['id'])->where('purpose', $purpose)
                ->where('method', $method)->where('status', 'pending')->orderByDesc('id')->first();
            if ($latest && $latest->resend_available_at && strtotime($latest->resend_available_at . ' UTC') > time()) {
                throw new BusinessException(ErrorCode::SMS_SEND_TOO_FREQUENT);
            }
            Db::table('merchant_auth_challenge')->where('account_id', $account['id'])->where('purpose', $purpose)
                ->where('method', $method)->where('status', 'pending')->update(['status' => 'expired']);
            $token = $this->newToken();
            $testMode = MerchantAuthTestMode::enabled();
            $code = $testMode ? MerchantAuthTestMode::OTP : (string) random_int(100000, 999999);
            $providerRequestId = $testMode ? MerchantAuthTestMode::OTP_MARKER : ($channel === 'email'
                ? ($this->sendEmailOtp((int) $account['site_id'], $recipient, $code, $purpose) ? '' : throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE, '邮件服务暂不可用'))
                : $this->sendSmsOtp((int) $account['site_id'], $recipient));
            Db::table('merchant_auth_challenge')->insert([
                'site_id' => $account['site_id'], 'account_id' => $account['id'], 'purpose' => $purpose, 'method' => $method,
                'token_hash' => hash('sha256', $token), 'identifier_hash' => $this->contactHash($channel, $recipient),
                'recipient_ciphertext' => $recipientCiphertext, 'google_subject_hash' => $googleHash,
                'otp_hash' => $testMode || $channel === 'email' ? hash_hmac('sha256', $code, $this->jwtKey()) : '',
                'provider_request_id' => $providerRequestId, 'status' => 'pending', 'max_attempts' => self::MAX_ATTEMPTS,
                'expires_at' => gmdate('Y-m-d H:i:s', time() + self::OTP_TTL),
                'resend_available_at' => gmdate('Y-m-d H:i:s', time() + self::RESEND_AFTER), 'request_ip_hash' => $this->ipHash($ip),
            ]);
            MerchantActivityService::account($account, $purpose . ($testMode ? '_test_otp_requested' : '_otp_requested'), $ip);
            return [
                'challengeToken' => $token, 'method' => str_starts_with($method, 'google:') ? 'google' : $method,
                'verification' => 'mtrip_otp', 'recipient' => $channel === 'email' ? MaskHelper::email($recipient) : MaskHelper::mobile($recipient),
                'expiresIn' => self::OTP_TTL, 'resendAfter' => self::RESEND_AFTER,
                'testMode' => $testMode,
            ];
        });
    }

    private function decoyChallenge(int $siteId, string $purpose, string $method, string $ip): array
    {
        $token = $this->newToken();
        $channel = $this->otpChannel($method);
        Db::table('merchant_auth_challenge')->insert([
            'site_id' => max(0, $siteId), 'account_id' => 0, 'purpose' => $purpose, 'method' => $method,
            'token_hash' => hash('sha256', $token), 'otp_hash' => hash_hmac('sha256', bin2hex(random_bytes(8)), $this->jwtKey()),
            'status' => 'pending', 'max_attempts' => self::MAX_ATTEMPTS,
            'expires_at' => gmdate('Y-m-d H:i:s', time() + self::OTP_TTL),
            'resend_available_at' => gmdate('Y-m-d H:i:s', time() + self::RESEND_AFTER), 'request_ip_hash' => $this->ipHash($ip),
        ]);
        return ['challengeToken' => $token, 'method' => str_starts_with($method, 'google:') ? 'google' : $method,
            'verification' => 'mtrip_otp', 'recipient' => $channel === 'email' ? '***@***' : '*******',
            'expiresIn' => self::OTP_TTL, 'resendAfter' => self::RESEND_AFTER, 'testMode' => MerchantAuthTestMode::enabled()];
    }

    private function verifyOtp(string $token, string $code, string $purpose, string $ip): array
    {
        if (! preg_match('/^\d{6}$/D', $code)) throw new BusinessException(ErrorCode::SMS_CODE_INVALID);
        $result = Db::transaction(function () use ($token, $code, $purpose, $ip): array {
            $challenge = $this->challenge($token, [$purpose], ['pending'], true);
            $channel = $this->otpChannel((string) $challenge['method']);
            $valid = (int) $challenge['account_id'] > 0 && ($channel === 'email' || $challenge['provider_request_id'] === MerchantAuthTestMode::OTP_MARKER
                ? hash_equals((string) $challenge['otp_hash'], hash_hmac('sha256', $code, $this->jwtKey()))
                : $this->verifySmsOtp((int) $challenge['site_id'], (string) $challenge['provider_request_id'], $code));
            if (! $valid) {
                $attempts = (int) $challenge['attempts'] + 1;
                $locked = $attempts >= (int) $challenge['max_attempts'];
                Db::table('merchant_auth_challenge')->where('id', $challenge['id'])->update([
                    'attempts' => $attempts, 'status' => $locked ? 'locked' : 'pending',
                ]);
                if ((int) $challenge['account_id'] > 0) {
                    $account = $this->account((int) $challenge['account_id'], [1, 2]);
                    $this->authenticationFailure($account, $purpose . '_otp_failed', $locked);
                }
                return ['error' => $locked ? ErrorCode::TOO_MANY_REQUESTS : ErrorCode::SMS_CODE_INVALID];
            }
            $now = gmdate('Y-m-d H:i:s');
            if ($challenge['provider_request_id'] === MerchantAuthTestMode::OTP_MARKER) {
                MerchantActivityService::account($this->account((int) $challenge['account_id'], [1, 2]), $purpose . '_test_otp_verified', $ip);
            }
            Db::table('merchant_auth_challenge')->where('id', $challenge['id'])->update(['status' => 'verified', 'verified_at' => $now]);
            $challenge['status'] = 'verified'; $challenge['verified_at'] = $now;
            return $challenge;
        });
        if (isset($result['error'])) {
            $locked = $result['error'] === ErrorCode::TOO_MANY_REQUESTS;
            throw new BusinessException($result['error'], $locked ? '验证码错误次数过多，请重新获取' : '验证码不正确');
        }
        return $result;
    }

    private function verifiedAccount(string $token, string $purpose, array $statuses): array
    {
        $challenge = $this->challenge($token, [$purpose], ['verified']);
        return $this->account((int) $challenge['account_id'], $statuses);
    }

    private function challenge(string $token, array $purposes, array $statuses, bool $lock = false): array
    {
        if (! preg_match('/^[A-Za-z0-9_-]{43}$/D', $token)) throw new BusinessException(ErrorCode::UNAUTHORIZED, '验证上下文无效');
        $query = Db::table('merchant_auth_challenge')->where('token_hash', hash('sha256', $token))->whereIn('purpose', $purposes);
        if ($lock) $query->lockForUpdate();
        $row = $query->first();
        if (! $row) throw new BusinessException(ErrorCode::UNAUTHORIZED, '验证上下文无效');
        $row = (array) $row;
        if ($row['provider_request_id'] === MerchantAuthTestMode::OTP_MARKER && ! MerchantAuthTestMode::enabled()) {
            throw new BusinessException(ErrorCode::SMS_CODE_EXPIRED, '测试验证码已停用，请重新获取验证码');
        }
        if (strtotime($row['expires_at'] . ' UTC') <= time()) {
            Db::table('merchant_auth_challenge')->where('id', $row['id'])->whereIn('status', ['pending', 'verified'])->update(['status' => 'expired']);
            throw new BusinessException(ErrorCode::SMS_CODE_EXPIRED);
        }
        if ($row['status'] === 'locked') throw new BusinessException(ErrorCode::TOO_MANY_REQUESTS, '验证码错误次数过多，请重新获取');
        if (! in_array($row['status'], $statuses, true)) throw new BusinessException(ErrorCode::SMS_CODE_EXPIRED);
        return $row;
    }

    private function account(int $id, array $statuses, bool $lock = false): array
    {
        $query = Db::table('merchant_admin')->where('id', $id)->whereIn('status', $statuses)->whereNull('deleted_at');
        if ($lock) $query->lockForUpdate();
        $account = $query->first();
        if (! $account) throw new BusinessException(ErrorCode::UNAUTHORIZED, '账号不可用');
        return (array) $account;
    }

    private function findContactAccount(int $siteId, string $channel, string $identifier): ?array
    {
        $identifier = $channel === 'email' ? strtolower(trim($identifier)) : (preg_replace('/[\s().-]+/', '', trim($identifier)) ?? '');
        if (($channel === 'email' && ! filter_var($identifier, FILTER_VALIDATE_EMAIL))
            || ($channel === 'sms' && ! preg_match('/^\+[1-9]\d{6,14}$/D', $identifier))) return null;
        $index = $this->contactHash($channel, $identifier);
        $column = $channel === 'email' ? 'email_index' : 'mobile_index';
        $verified = $channel === 'email' ? 'verified_email_at' : 'verified_mobile_at';
        $query = Db::table('merchant_admin as a')->join('merchant_info as m', 'm.id', '=', 'a.merchant_id')
            ->where("a.{$column}", $index)->whereNotNull("a.{$verified}")->where('a.status', 1)
            ->whereIn('m.status', [3, 4])->whereNull('a.deleted_at')->whereNull('m.deleted_at')
            ->whereNotIn('m.id', Db::table('merchant_blacklist')->where('status', 1)->select('merchant_id'));
        if ($siteId > 0) $query->where('a.site_id', $siteId);
        $rows = $query->limit(2)->get(['a.*'])->map(static fn ($row) => (array) $row)->all();
        return count($rows) === 1 ? $rows[0] : null;
    }

    private function findGoogleAccount(int $siteId, string $subjectHash): ?array
    {
        $query = Db::table('merchant_admin as a')->join('merchant_info as m', 'm.id', '=', 'a.merchant_id')
            ->where('a.google_subject_hash', $subjectHash)->where('a.status', 1)->whereIn('m.status', [3, 4])
            ->whereNull('a.deleted_at')->whereNull('m.deleted_at')
            ->whereNotIn('m.id', Db::table('merchant_blacklist')->where('status', 1)->select('merchant_id'));
        if ($siteId > 0) $query->where('a.site_id', $siteId);
        $row = $query->first(['a.*']);
        return $row ? (array) $row : null;
    }

    private function profile(array $account, bool $otpVerified): array
    {
        $email = $this->decrypt((string) $account['email']);
        $mobile = $this->decrypt((string) $account['mobile']);
        return [
            'accountId' => (int) $account['id'], 'merchantId' => (int) $account['merchant_id'],
            'username' => (string) $account['username'], 'email' => MaskHelper::email($email), 'mobile' => MaskHelper::mobile($mobile),
            'otpVerified' => $otpVerified, 'activated' => (int) $account['status'] === 1,
            'methods' => [
                'email' => (bool) $account['verified_email_at'], 'sms' => (bool) $account['verified_mobile_at'],
                'google' => (bool) $account['google_linked_at'], 'accessCode' => (int) $account['two_fa_status'] === 1,
            ],
        ];
    }

    private function totpSetup(array $account, string $secret): array
    {
        return ['manualKey' => $secret, 'otpauthUri' => 'otpauth://totp/' . rawurlencode('mTrip:' . $account['username'])
            . '?secret=' . $secret . '&issuer=mTrip&algorithm=SHA1&digits=6&period=30'];
    }

    private function saveTotp(array $account, string $code, string $ip, string $activity): void
    {
        if ($account['pending_secret_enc'] === '') throw new BusinessException(ErrorCode::DATA_CONFLICT, '请先获取身份验证器设置');
        $encrypted = (string) $account['pending_secret_enc'];
        $step = Totp::matchStep(CryptoHelper::decrypt($encrypted, $this->aesKey()), $code, -1);
        if ($step === null) {
            $this->authenticationFailure($account, $activity . '_failed');
            throw new BusinessException(ErrorCode::SMS_CODE_INVALID, '身份验证器验证码无效');
        }
        Db::table('merchant_admin')->where('id', $account['id'])->update([
            'two_fa_status' => 1, 'two_fa_method' => 'google_authenticator', 'two_fa_secret_enc' => $encrypted,
            'pending_secret_enc' => '', 'last_accepted_totp_step' => $step, 'two_fa_enrolled_at' => gmdate('Y-m-d H:i:s'),
            'security_fail_count' => 0, 'security_locked_until' => null,
        ]);
        Db::table('merchant_info')->where('id', $account['merchant_id'])->update(['access_status' => 1]);
        MerchantActivityService::account($account, $activity, $ip);
    }

    private function authenticationFailure(array $account, string $activity, bool $locked = false): void
    {
        $count = (int) $account['security_fail_count'] + 1;
        $shouldLock = $locked || $count >= self::MAX_ATTEMPTS;
        Db::table('merchant_admin')->where('id', $account['id'])->update([
            'security_fail_count' => $shouldLock ? 0 : $count,
            'security_locked_until' => $shouldLock ? gmdate('Y-m-d H:i:s', time() + 900) : null,
        ]);
        MerchantActivityService::account($account, $shouldLock ? 'authentication_locked' : $activity);
    }

    private function assertOtpChannel(string $channel): void
    {
        if (! in_array($channel, ['email', 'sms'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR, 'OTP 渠道不受支持');
    }

    private function otpChannel(string $method): string
    {
        return str_ends_with($method, ':sms') || $method === 'sms' ? 'sms' : 'email';
    }

    private function contactHash(string $channel, string $value): string
    {
        $type = $channel === 'sms' ? 'phone' : 'email';
        return hash_hmac('sha256', 'merchant-registration-' . $type . '-v1:' . $value, $this->aesKey());
    }

    private function googleHash(string $issuer, string $subject): string
    {
        return hash_hmac('sha256', 'merchant-google-v1:' . $issuer . ':' . $subject, $this->aesKey());
    }

    /** @return array{issuer:string,subject:string,email:string} */
    protected function verifyGoogleIdToken(string $idToken): array
    {
        $clientIds = $this->googleClientIds();
        if ($clientIds === []) throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Google 登录尚未配置');
        if ($idToken === '' || strlen($idToken) > 4096) throw new BusinessException(ErrorCode::UNAUTHORIZED, 'Google 身份验证失败');
        $context = stream_context_create(['http' => ['method' => 'GET', 'header' => 'Accept: application/json', 'ignore_errors' => true, 'timeout' => 8]]);
        $body = @file_get_contents('https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken), false, $context);
        $payload = $body === false ? null : json_decode($body, true);
        $issuer = (string) ($payload['iss'] ?? '');
        if (! is_array($payload) || ! in_array((string) ($payload['aud'] ?? ''), $clientIds, true)
            || ! in_array($issuer, ['accounts.google.com', 'https://accounts.google.com'], true)
            || (int) ($payload['exp'] ?? 0) <= time() || ! in_array($payload['email_verified'] ?? false, [true, 'true', 1, '1'], true)
            || (string) ($payload['sub'] ?? '') === '' || ! filter_var((string) ($payload['email'] ?? ''), FILTER_VALIDATE_EMAIL)) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED, 'Google 身份验证失败');
        }
        return ['issuer' => 'https://accounts.google.com', 'subject' => (string) $payload['sub'], 'email' => strtolower((string) $payload['email'])];
    }

    protected function sendEmailOtp(int $siteId, string $recipient, string $code, string $purpose): bool
    {
        $channel = $this->emailChannel($siteId);
        if ($channel === null) throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE, '当前站点未配置邮件验证码');
        $body = strtr((string) $channel['otpContent'], ['{{code}}' => $code, '{{expiresMinutes}}' => '5']);
        $result = (new SmtpClient($channel['host'], $channel['port'], $channel['encryption'], $channel['username'], $channel['password']))
            ->send($channel['fromEmail'], $channel['fromName'], $recipient, $channel['otpSubject'], $body);
        try {
            Db::connection('system')->table('sys_email_log')->insert([
                'site_id' => $siteId, 'channel_id' => $channel['id'], 'scene' => 'merchant_' . $purpose,
                'recipient' => CryptoHelper::encrypt($recipient, $this->aesKey()), 'subject' => mb_substr($channel['otpSubject'], 0, 200),
                'status' => $result['ok'] ? 1 : 2, 'provider_message' => mb_substr($result['message'], 0, 500),
            ]);
        } catch (\Throwable) {
        }
        return (bool) $result['ok'];
    }

    protected function sendSmsOtp(int $siteId, string $recipient): string
    {
        $channel = $this->smsChannel($siteId);
        if ($channel === null) throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE);
        $result = (new SmsPohClient($channel['apiKey'], $channel['apiSecret'], $channel['countryCode']))
            ->requestOtp($recipient, $channel['from'], $channel['brand'], ['ttl' => self::OTP_TTL, 'pinLength' => 6, 'maxInvalidAttempts' => self::MAX_ATTEMPTS]);
        if (! $result['ok'] || $result['requestId'] === '') throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE);
        return (string) $result['requestId'];
    }

    protected function verifySmsOtp(int $siteId, string $requestId, string $code): bool
    {
        $channel = $this->smsChannel($siteId);
        return $channel !== null && (new SmsPohClient($channel['apiKey'], $channel['apiSecret'], $channel['countryCode']))->verifyOtp($requestId, $code)['ok'];
    }

    private function emailChannel(int $siteId): ?array
    {
        $row = Db::connection('system')->table('sys_email_channel')->whereIn('site_id', [$siteId, 0])->where('status', 1)
            ->whereNull('deleted_at')->orderByRaw('site_id = ? DESC', [$siteId])->first();
        if (! $row) return null;
        $row = (array) $row;
        return ['id' => (int) $row['id'], 'host' => (string) $row['smtp_host'], 'port' => (int) $row['smtp_port'],
            'encryption' => (string) $row['encryption'], 'username' => CryptoHelper::decrypt((string) $row['username'], $this->aesKey()),
            'password' => CryptoHelper::decrypt((string) $row['password'], $this->aesKey()), 'fromEmail' => (string) $row['from_email'],
            'fromName' => (string) $row['from_name'], 'otpSubject' => (string) $row['otp_subject'],
            'otpContent' => (string) ($row['otp_content'] ?: 'Your mTrip verification code is {{code}}. It expires in {{expiresMinutes}} minutes.')];
    }

    private function smsChannel(int $siteId): ?array
    {
        $row = Db::connection('system')->table('sys_sms_channel')->whereIn('site_id', [$siteId, 0])->where('provider_code', 'smspoh')
            ->where('status', 1)->whereNull('deleted_at')->orderByRaw('site_id = ? DESC', [$siteId])->first();
        if (! $row) return null;
        $row = (array) $row;
        return ['apiKey' => CryptoHelper::decrypt((string) $row['api_key'], $this->aesKey()),
            'apiSecret' => CryptoHelper::decrypt((string) $row['api_secret'], $this->aesKey()), 'countryCode' => (string) $row['country_code'],
            'from' => (string) $row['sign_name'], 'brand' => (string) ($row['brand_name'] ?: $row['sign_name'])];
    }

    private function googleClientIds(): array
    {
        return array_values(array_filter(array_map('strval', (array) config('mtrip.google_client_ids', []))));
    }

    private function decrypt(string $ciphertext): string
    {
        try {
            return $ciphertext === '' ? '' : CryptoHelper::decrypt($ciphertext, $this->aesKey());
        } catch (\Throwable) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '账号联系方式无法解密');
        }
    }

    private function newToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    private function ipHash(string $ip): string
    {
        return $ip === '' ? '' : hash_hmac('sha256', $ip, $this->aesKey());
    }

    private function aesKey(): string
    {
        $key = (string) config('mtrip.aes_key');
        if ($key === '') throw new BusinessException(ErrorCode::SERVER_ERROR, '数据加密密钥未配置');
        return $key;
    }

    private function jwtKey(): string
    {
        $key = (string) config('mtrip.jwt_secret');
        if ($key === '') throw new BusinessException(ErrorCode::SERVER_ERROR, '认证密钥未配置');
        return $key;
    }

    private function assertUnlocked(array $account): void
    {
        if ($account['security_locked_until'] && strtotime($account['security_locked_until'] . ' UTC') > time()) {
            throw new BusinessException(ErrorCode::TOO_MANY_REQUESTS, '验证失败次数过多，请15分钟后重试');
        }
    }
}
