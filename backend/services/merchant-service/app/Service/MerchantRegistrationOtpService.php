<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\JwtHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\SmsPohClient;
use Mtrip\Shared\Support\SmtpClient;

use function Hyperf\Config\config;

/** Registration OTP for the unauthenticated merchant onboarding flow. */
class MerchantRegistrationOtpService
{
    private const SCENE = 'merchant_register';
    private const PIN_LENGTH = 6;
    private const REGISTRATION_TOKEN_TTL = 86400;
    private const RESEND_COOLDOWN = 60;

    #[Inject]
    protected Redis $redis;

    /** @return list<array{channel:string,label:string}> */
    public function availableChannels(int $siteId): array
    {
        if (MerchantAuthTestMode::enabled()) return [['channel' => 'email', 'label' => 'Email (test)'], ['channel' => 'sms', 'label' => 'SMS (test)']];
        $channels = [];
        if ($this->emailChannel($siteId) !== null) $channels[] = ['channel' => 'email', 'label' => 'Email'];
        if ($this->smsChannel($siteId) !== null) $channels[] = ['channel' => 'sms', 'label' => 'SMS'];
        return $channels;
    }

    /** @return array{expiresIn:int,resendAfter:int,pinLength:int,recipient:string,channel:string} */
    public function send(int $siteId, string $phone, string $email, string $channel, string $ip): array
    {
        $channel = $this->assertChannel($channel);
        [$phone, $email] = $this->validateContacts($phone, $email);
        $recipient = $channel === 'email' ? $email : $phone;
        $testMode = MerchantAuthTestMode::enabled();
        $config = $testMode ? ['ttl' => 300] : ($channel === 'email' ? $this->emailChannel($siteId) : $this->smsChannel($siteId));
        if ($config === null) throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE, '当前站点未配置该验证渠道');
        $hash = $this->contactHash($channel, $recipient);
        $phoneHash = $this->contactHash('phone', $phone);
        $emailHash = $this->contactHash('email', $email);
        $cooldown = $this->cooldownKey($siteId, $channel, $hash);
        if ($this->redis->exists($cooldown)) throw new BusinessException(ErrorCode::SMS_SEND_TOO_FREQUENT);
        $ttl = (int) $config['ttl'];

        if ($testMode) {
            $payload = ['type' => $channel, 'testMode' => true, 'codeHash' => hash_hmac('sha256', MerchantAuthTestMode::OTP, $this->key()), 'attempts' => 0, 'maxAttempts' => 5];
        } elseif ($channel === 'email') {
            $code = (string) random_int(100000, 999999);
            $body = strtr((string) $config['otpContent'], ['{{code}}' => $code, '{{expiresMinutes}}' => (string) max(1, (int) ceil($ttl / 60))]);
            $result = (new SmtpClient((string) $config['host'], (int) $config['port'], (string) $config['encryption'], (string) $config['username'], (string) $config['password']))
                ->send((string) $config['fromEmail'], (string) $config['fromName'], $recipient, (string) $config['otpSubject'], $body);
            $this->writeEmailLog($siteId, (int) $config['id'], $recipient, (string) $config['otpSubject'], $result);
            if (! $result['ok']) throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE, '邮件服务暂不可用，请稍后再试');
            $payload = ['type' => 'email', 'codeHash' => hash_hmac('sha256', $code, $this->key()), 'attempts' => 0, 'maxAttempts' => (int) $config['maxAttempts']];
        } else {
            $result = (new SmsPohClient((string) $config['apiKey'], (string) $config['apiSecret'], (string) $config['countryCode']))->requestOtp($recipient, (string) $config['from'], (string) $config['brand'], ['ttl' => $ttl, 'pinLength' => self::PIN_LENGTH, 'maxInvalidAttempts' => (int) $config['maxAttempts']]);
            if (! $result['ok']) throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE);
            $payload = ['type' => 'sms', 'requestId' => (string) $result['requestId']];
        }
        $payload['phoneHash'] = $phoneHash;
        $payload['emailHash'] = $emailHash;
        $this->redis->setex($this->otpKey($siteId, $channel, $hash), $ttl, json_encode($payload) ?: '');
        $this->redis->setex($cooldown, self::RESEND_COOLDOWN, '1');
        return ['expiresIn' => $ttl, 'resendAfter' => self::RESEND_COOLDOWN, 'pinLength' => self::PIN_LENGTH, 'recipient' => $channel === 'email' ? MaskHelper::email($recipient) : MaskHelper::mobile($recipient), 'channel' => $channel, 'testMode' => $testMode];
    }

    /** @return array{registrationToken:string,applicationId:int,expiresIn:int} */
    public function verify(int $siteId, string $phone, string $email, string $channel, string $code): array
    {
        $channel = $this->assertChannel($channel);
        [$phone, $email] = $this->validateContacts($phone, $email);
        $recipient = $channel === 'email' ? $email : $phone;
        if (! preg_match('/^\d{6}$/', $code)) throw new BusinessException(ErrorCode::SMS_CODE_INVALID);
        $hash = $this->contactHash($channel, $recipient);
        $phoneHash = $this->contactHash('phone', $phone);
        $emailHash = $this->contactHash('email', $email);
        $key = $this->otpKey($siteId, $channel, $hash);
        $payload = json_decode((string) $this->redis->get($key), true);
        if (! is_array($payload)) throw new BusinessException(ErrorCode::SMS_CODE_EXPIRED);
        if (($payload['testMode'] ?? false) && ! MerchantAuthTestMode::enabled()) throw new BusinessException(ErrorCode::SMS_CODE_EXPIRED);
        if (! hash_equals((string) ($payload['phoneHash'] ?? ''), $phoneHash)
            || ! hash_equals((string) ($payload['emailHash'] ?? ''), $emailHash)) {
            throw new BusinessException(ErrorCode::SMS_CODE_INVALID, '联系方式与验证码请求不一致');
        }
        $valid = false;
        if (($payload['testMode'] ?? false) || ($payload['type'] ?? '') === 'email') {
            $valid = hash_equals((string) ($payload['codeHash'] ?? ''), hash_hmac('sha256', $code, $this->key()));
            if (! $valid) {
                $payload['attempts'] = (int) ($payload['attempts'] ?? 0) + 1;
                if ($payload['attempts'] >= (int) ($payload['maxAttempts'] ?? 5)) $this->redis->del($key);
                else $this->redis->setex($key, max(1, $this->redis->ttl($key)), json_encode($payload) ?: '');
            }
        } else {
            $config = $this->smsChannel($siteId);
            if ($config === null) throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE);
            $valid = (new SmsPohClient((string) $config['apiKey'], (string) $config['apiSecret'], (string) $config['countryCode']))->verifyOtp((string) ($payload['requestId'] ?? ''), $code)['ok'];
        }
        if (! $valid) throw new BusinessException(ErrorCode::SMS_CODE_INVALID);
        $this->redis->del($key);
        $applicationId = $this->createOrRestoreDraft($siteId, $phone, $email, $phoneHash, $emailHash, $channel, $hash);
        return [
            'registrationToken' => JwtHelper::issue([
                'aud' => 'merchant_registration', 'site_id' => $siteId, 'application_id' => $applicationId,
                'otp_channel' => $channel, 'phone_hash' => $phoneHash, 'email_hash' => $emailHash,
                'test_mode' => (bool) ($payload['testMode'] ?? false),
            ], $this->key(), self::REGISTRATION_TOKEN_TTL),
            'applicationId' => $applicationId,
            'expiresIn' => self::REGISTRATION_TOKEN_TTL,
        ];
    }

    /** @return array<string,mixed> */
    public function registrationClaims(int $siteId, string $token): array
    {
        $claims = JwtHelper::verify($token, $this->key());
        if (($claims['test_mode'] ?? false) && ! MerchantAuthTestMode::enabled()) throw new BusinessException(ErrorCode::UNAUTHORIZED);
        if (($claims['aud'] ?? '') !== 'merchant_registration'
            || (int) ($claims['site_id'] ?? 0) !== $siteId
            || (int) ($claims['application_id'] ?? 0) <= 0
            || strlen((string) ($claims['phone_hash'] ?? '')) !== 64
            || strlen((string) ($claims['email_hash'] ?? '')) !== 64) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }
        return $claims;
    }

    private function assertChannel(string $channel): string
    {
        if (! in_array($channel, ['email', 'sms'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR, 'channel 仅支持 email 或 sms');
        return $channel;
    }
    /** @return array{0:string,1:string} */
    private function validateContacts(string $phone, string $email): array
    {
        $phone = preg_replace('/[\s().-]+/', '', trim($phone)) ?? '';
        $email = strtolower(trim($email));
        if (! preg_match('/^\+[1-9]\d{6,14}$/D', $phone)) throw new BusinessException(ErrorCode::PARAM_ERROR, '手机号必须为 E.164 格式');
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) throw new BusinessException(ErrorCode::PARAM_ERROR, '邮箱格式不正确');
        return [$phone, $email];
    }
    private function contactHash(string $type, string $value): string
    {
        return hash_hmac('sha256', 'merchant-registration-' . $type . '-v1:' . $value, $this->aesKey());
    }
    private function otpKey(int $siteId, string $channel, string $hash): string { return "mtrip:merchant:registration:otp:{$siteId}:{$channel}:{$hash}"; }
    private function cooldownKey(int $siteId, string $channel, string $hash): string { return "mtrip:merchant:registration:cooldown:{$siteId}:{$channel}:{$hash}"; }
    private function key(): string { $key = (string) config('mtrip.jwt_secret'); if ($key === '') throw new BusinessException(ErrorCode::SERVER_ERROR, '认证密钥未配置'); return $key; }
    private function aesKey(): string { $key = (string) config('mtrip.aes_key'); if ($key === '') throw new BusinessException(ErrorCode::SERVER_ERROR, '数据加密密钥未配置'); return $key; }

    private function createOrRestoreDraft(int $siteId, string $phone, string $email, string $phoneHash, string $emailHash, string $channel, string $recipientHash): int
    {
        return Db::transaction(function () use ($siteId, $phone, $email, $phoneHash, $emailHash, $channel, $recipientHash): int {
            $existing = Db::table('merchant_application')
                ->where('site_id', $siteId)
                ->where('registration_phone_index', $phoneHash)
                ->where('registration_email_index', $emailHash)
                ->whereNull('deleted_at')
                ->lockForUpdate()
                ->first();
            if ($existing) return (int) $existing->id;

            $now = gmdate('Y-m-d H:i:s');
            Db::table('merchant_application')->insertOrIgnore([
                'site_id' => $siteId,
                'app_no' => $this->appNo(),
                'merchant_name' => '',
                'company_name' => '',
                'num_businesses' => 0,
                'registration_channel' => $channel,
                'registration_contact_hash' => $recipientHash,
                'registration_phone' => CryptoHelper::encrypt($phone, $this->aesKey()),
                'registration_phone_index' => $phoneHash,
                'registration_email' => CryptoHelper::encrypt($email, $this->aesKey()),
                'registration_email_index' => $emailHash,
                'contact_data_status' => 0,
                'registration_status' => 0,
                'merchant_kyc_status' => 0,
                'account_status' => 0,
                'state_model_version' => 1,
                'current_step' => 0,
                'completion_percent' => 0,
                'last_activity_at' => $now,
                'last_updated_at' => $now,
            ]);
            $applicationId = (int) Db::table('merchant_application')
                ->where('site_id', $siteId)
                ->where('registration_phone_index', $phoneHash)
                ->where('registration_email_index', $emailHash)
                ->whereNull('deleted_at')
                ->value('id');
            if ($applicationId <= 0) throw new BusinessException(ErrorCode::DATA_CONFLICT, '注册草稿创建失败，请重试');
            return $applicationId;
        });
    }

    private function appNo(): string { return 'APP-' . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(5))); }

    /** @return array<string,mixed>|null */
    private function emailChannel(int $siteId): ?array
    {
        $row = Db::connection('system')->table('sys_email_channel')->whereIn('site_id', [$siteId, 0])->where('status', 1)->whereNull('deleted_at')->orderByRaw('site_id = ? DESC', [$siteId])->first();
        if (! $row) return null;
        $row = (array) $row; $aes = (string) config('mtrip.aes_key');
        return ['id' => $row['id'], 'host' => $row['smtp_host'], 'port' => $row['smtp_port'], 'encryption' => $row['encryption'], 'username' => CryptoHelper::decrypt((string) $row['username'], $aes), 'password' => CryptoHelper::decrypt((string) $row['password'], $aes), 'fromEmail' => $row['from_email'], 'fromName' => $row['from_name'], 'otpSubject' => $row['otp_subject'], 'otpContent' => $row['otp_content'] ?: 'Your mTrip verification code is {{code}}. It expires in {{expiresMinutes}} minutes.', 'ttl' => $row['code_expire_sec'], 'pinLength' => $row['pin_length'], 'maxAttempts' => $row['max_invalid_attempts']];
    }
    /** @return array<string,mixed>|null */
    private function smsChannel(int $siteId): ?array
    {
        $row = Db::connection('system')->table('sys_sms_channel')->whereIn('site_id', [$siteId, 0])->where('provider_code', 'smspoh')->where('status', 1)->whereNull('deleted_at')->orderByRaw('site_id = ? DESC', [$siteId])->first();
        if (! $row) return null;
        $row = (array) $row; $aes = (string) config('mtrip.aes_key');
        return ['apiKey' => CryptoHelper::decrypt((string) $row['api_key'], $aes), 'apiSecret' => CryptoHelper::decrypt((string) $row['api_secret'], $aes), 'countryCode' => $row['country_code'], 'from' => $row['sign_name'], 'brand' => $row['brand_name'] ?: $row['sign_name'], 'ttl' => $row['code_expire_sec'], 'pinLength' => $row['pin_length'], 'maxAttempts' => $row['max_invalid_attempts']];
    }
    /** @param array{ok:bool,message:string} $result */
    private function writeEmailLog(int $siteId, int $channelId, string $recipient, string $subject, array $result): void
    {
        try { Db::connection('system')->table('sys_email_log')->insert(['site_id' => $siteId, 'channel_id' => $channelId, 'scene' => self::SCENE, 'recipient' => CryptoHelper::encrypt($recipient, (string) config('mtrip.aes_key')), 'subject' => mb_substr($subject, 0, 200), 'status' => $result['ok'] ? 1 : 2, 'provider_message' => mb_substr($result['message'], 0, 500)]); } catch (\Throwable) { }
    }
}
