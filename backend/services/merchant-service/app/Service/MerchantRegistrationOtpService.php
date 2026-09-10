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
    private const REGISTRATION_TOKEN_TTL = 86400;
    private const RESEND_COOLDOWN = 60;

    #[Inject]
    protected Redis $redis;

    /** @return list<array{channel:string,label:string}> */
    public function availableChannels(int $siteId): array
    {
        $channels = [];
        if ($this->emailChannel($siteId) !== null) $channels[] = ['channel' => 'email', 'label' => 'Email'];
        if ($this->smsChannel($siteId) !== null) $channels[] = ['channel' => 'sms', 'label' => 'SMS'];
        return $channels;
    }

    /** @return array{expiresIn:int,resendAfter:int,pinLength:int,recipient:string,channel:string} */
    public function send(int $siteId, string $channel, string $recipient, string $ip): array
    {
        $channel = $this->assertChannel($channel);
        $recipient = $this->validateRecipient($channel, $recipient);
        $config = $channel === 'email' ? $this->emailChannel($siteId) : $this->smsChannel($siteId);
        if ($config === null) throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE, '当前站点未配置该验证渠道');
        $hash = $this->recipientHash($channel, $recipient);
        $cooldown = $this->cooldownKey($siteId, $channel, $hash);
        if ($this->redis->exists($cooldown)) throw new BusinessException(ErrorCode::SMS_SEND_TOO_FREQUENT);
        $ttl = (int) $config['ttl'];
        $pinLength = (int) $config['pinLength'];

        if ($channel === 'email') {
            $code = (string) random_int(10 ** ($pinLength - 1), (10 ** $pinLength) - 1);
            $body = strtr((string) $config['otpContent'], ['{{code}}' => $code, '{{expiresMinutes}}' => (string) max(1, (int) ceil($ttl / 60))]);
            $result = (new SmtpClient((string) $config['host'], (int) $config['port'], (string) $config['encryption'], (string) $config['username'], (string) $config['password']))
                ->send((string) $config['fromEmail'], (string) $config['fromName'], $recipient, (string) $config['otpSubject'], $body);
            $this->writeEmailLog($siteId, (int) $config['id'], $recipient, (string) $config['otpSubject'], $result);
            if (! $result['ok']) throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE, '邮件服务暂不可用，请稍后再试');
            $payload = ['type' => 'email', 'codeHash' => hash_hmac('sha256', $code, $this->key()), 'attempts' => 0, 'maxAttempts' => (int) $config['maxAttempts']];
        } else {
            $result = (new SmsPohClient((string) $config['apiKey'], (string) $config['apiSecret'], (string) $config['countryCode']))->requestOtp($recipient, (string) $config['from'], (string) $config['brand'], ['ttl' => $ttl, 'pinLength' => $pinLength, 'maxInvalidAttempts' => (int) $config['maxAttempts']]);
            if (! $result['ok']) throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE);
            $payload = ['type' => 'sms', 'requestId' => (string) $result['requestId']];
        }
        $this->redis->setex($this->otpKey($siteId, $channel, $hash), $ttl, json_encode($payload) ?: '');
        $this->redis->setex($cooldown, self::RESEND_COOLDOWN, '1');
        return ['expiresIn' => $ttl, 'resendAfter' => self::RESEND_COOLDOWN, 'pinLength' => $pinLength, 'recipient' => $channel === 'email' ? MaskHelper::email($recipient) : MaskHelper::mobile($recipient), 'channel' => $channel];
    }

    /** @return array{registrationToken:string,expiresIn:int} */
    public function verify(int $siteId, string $channel, string $recipient, string $code): array
    {
        $channel = $this->assertChannel($channel);
        $recipient = $this->validateRecipient($channel, $recipient);
        if (! preg_match('/^\d{4,8}$/', $code)) throw new BusinessException(ErrorCode::SMS_CODE_INVALID);
        $hash = $this->recipientHash($channel, $recipient);
        $key = $this->otpKey($siteId, $channel, $hash);
        $payload = json_decode((string) $this->redis->get($key), true);
        if (! is_array($payload)) throw new BusinessException(ErrorCode::SMS_CODE_EXPIRED);
        $valid = false;
        if (($payload['type'] ?? '') === 'email') {
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
        return ['registrationToken' => JwtHelper::issue(['aud' => 'merchant_registration', 'site_id' => $siteId, 'channel' => $channel, 'recipient_hash' => $hash], $this->key(), self::REGISTRATION_TOKEN_TTL), 'expiresIn' => self::REGISTRATION_TOKEN_TTL];
    }

    /** @return array<string,mixed> */
    public function registrationClaims(int $siteId, string $token): array
    {
        $claims = JwtHelper::verify($token, $this->key());
        if (($claims['aud'] ?? '') !== 'merchant_registration' || (int) ($claims['site_id'] ?? 0) !== $siteId) throw new BusinessException(ErrorCode::UNAUTHORIZED);
        return $claims;
    }

    private function assertChannel(string $channel): string
    {
        if (! in_array($channel, ['email', 'sms'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR, 'channel 仅支持 email 或 sms');
        return $channel;
    }
    private function validateRecipient(string $channel, string $recipient): string
    {
        $recipient = trim($recipient);
        if ($channel === 'email') { $recipient = strtolower($recipient); if (! filter_var($recipient, FILTER_VALIDATE_EMAIL)) throw new BusinessException(ErrorCode::PARAM_ERROR, '邮箱格式不正确'); }
        elseif (! preg_match('/^\+?\d{6,20}$/', $recipient)) throw new BusinessException(ErrorCode::PARAM_ERROR, '手机号格式不正确');
        return $recipient;
    }
    private function recipientHash(string $channel, string $recipient): string { return hash('sha256', $channel . ':' . strtolower($recipient)); }
    private function otpKey(int $siteId, string $channel, string $hash): string { return "mtrip:merchant:registration:otp:{$siteId}:{$channel}:{$hash}"; }
    private function cooldownKey(int $siteId, string $channel, string $hash): string { return "mtrip:merchant:registration:cooldown:{$siteId}:{$channel}:{$hash}"; }
    private function key(): string { $key = (string) config('mtrip.jwt_secret'); if ($key === '') throw new BusinessException(ErrorCode::SERVER_ERROR, '认证密钥未配置'); return $key; }

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
