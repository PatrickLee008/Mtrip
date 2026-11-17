<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\SmtpClient;

/**
 * C 端邮箱验证码(Consumer App PRD 模块 19.2「关联邮箱」)
 *
 * 渠道沿用平台「邮件配置」`mtrip_system.sys_email_channel`(站点专属优先,回退全局 site_id=0),
 * 发信用 shared `SmtpClient`,落 `sys_email_log`(收件人加密,不存正文和验证码)—— 与商户注册邮箱验证码同一套。
 * 没有启用中的渠道时返回 50021「邮件服务不可用」,**不提供任何测试旁路**。
 *
 * 验证码由我方生成,Redis 只存 HMAC(码),与「登录用户 + 邮箱」绑定:
 * 换一个邮箱重新发码会覆盖上一条,拿 A 邮箱的码验 B 邮箱一律按码错处理;错满 maxInvalidAttempts 次作废。
 */
class EmailVerifyService
{
    /** sys_email_log.scene */
    public const LOG_SCENE = 'user_link_email';

    private const RESEND_COOLDOWN = 60;
    private const USER_DAILY_LIMIT = 10;
    private const EMAIL_DAILY_LIMIT = 10;
    private const IP_HOURLY_LIMIT = 20;

    public function __construct(protected Redis $redis, protected UserAuthService $auth)
    {
    }

    /**
     * 发送验证码到(已规范化的)邮箱
     *
     * @return array{expiresIn:int,resendAfter:int,pinLength:int,email:string}
     */
    public function send(int $siteId, int $userId, string $email, string $emailHash, string $ip): array
    {
        $channel = $this->channel($siteId);
        if ($channel === null) {
            throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE, 'Email service is not available. Please try again later or contact support.');
        }
        $this->assertRateLimit($userId, $emailHash, $ip);

        $code = $this->generateCode($channel['pinLength']);
        $minutes = (string) max(1, (int) ceil($channel['ttl'] / 60));
        $body = strtr($channel['otpContent'], ['{{code}}' => $code, '{{expiresMinutes}}' => $minutes]);
        $result = $this->client($channel)->send($channel['fromEmail'], $channel['fromName'], $email, $channel['otpSubject'], $body);
        $this->writeLog($siteId, $channel['id'], $email, $channel['otpSubject'], $result);
        if (! $result['ok']) {
            throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE, 'Email service is not available. Please try again later.');
        }

        $this->redis->setex($this->otpKey($siteId, $userId), $channel['ttl'], json_encode([
            'emailHash' => $emailHash,
            'codeHash' => $this->codeHash($code),
            'attempts' => 0,
            'maxAttempts' => $channel['maxAttempts'],
        ]) ?: '');
        $this->markSent($userId, $emailHash, $ip);

        return [
            'expiresIn' => $channel['ttl'],
            'resendAfter' => self::RESEND_COOLDOWN,
            'pinLength' => $channel['pinLength'],
            'email' => MaskHelper::email($email),
        ];
    }

    /** 校验验证码;通过即作废(一次性),失败按次数累计,错满作废 */
    public function verify(int $siteId, int $userId, string $emailHash, string $code): void
    {
        if (! preg_match('/^\d{4,8}$/D', $code)) {
            throw new BusinessException(ErrorCode::SMS_CODE_INVALID);
        }
        $key = $this->otpKey($siteId, $userId);
        $payload = json_decode((string) $this->redis->get($key), true);
        if (! is_array($payload)) {
            throw new BusinessException(ErrorCode::SMS_CODE_EXPIRED);
        }
        $valid = hash_equals((string) ($payload['emailHash'] ?? ''), $emailHash)
            && hash_equals((string) ($payload['codeHash'] ?? ''), $this->codeHash($code));
        if (! $valid) {
            $payload['attempts'] = (int) ($payload['attempts'] ?? 0) + 1;
            if ($payload['attempts'] >= max(1, (int) ($payload['maxAttempts'] ?? 5))) {
                $this->redis->del($key);
                throw new BusinessException(ErrorCode::SMS_CODE_EXPIRED, 'Too many incorrect attempts. Please request a new code.');
            }
            $ttl = (int) $this->redis->ttl($key);
            $this->redis->setex($key, max(1, $ttl), json_encode($payload) ?: '');
            throw new BusinessException(ErrorCode::SMS_CODE_INVALID);
        }
        $this->redis->del($key);
    }

    /** @return array<string, mixed>|null 未配置 / 半配置的渠道一律视为不可用 */
    public function channel(int $siteId): ?array
    {
        $row = Db::connection('system')->table('sys_email_channel')
            ->whereIn('site_id', [$siteId, 0])->where('status', 1)->whereNull('deleted_at')
            ->orderByDesc('site_id')->first();
        if (! $row) {
            return null;
        }
        $row = (array) $row;
        $fromEmail = trim((string) $row['from_email']);
        $host = trim((string) $row['smtp_host']);
        if ($fromEmail === '' || $host === '') {
            return null;
        }
        return [
            'id' => (int) $row['id'],
            'host' => $host,
            'port' => (int) $row['smtp_port'],
            'encryption' => (string) $row['encryption'],
            'username' => $this->auth->decryptSafe((string) $row['username']),
            'password' => $this->auth->decryptSafe((string) $row['password']),
            'fromEmail' => $fromEmail,
            'fromName' => (string) ($row['from_name'] ?: 'mTrip'),
            'otpSubject' => (string) ($row['otp_subject'] ?: 'Your mTrip verification code'),
            'otpContent' => (string) ($row['otp_content'] ?: 'Your mTrip verification code is {{code}}. It expires in {{expiresMinutes}} minutes.'),
            'ttl' => max(60, min(1800, (int) $row['code_expire_sec'])),
            'pinLength' => max(4, min(8, (int) ($row['pin_length'] ?? 6))),
            'maxAttempts' => max(1, min(10, (int) ($row['max_invalid_attempts'] ?? 5))),
        ];
    }

    /** 单独成方法便于测试替换(不发真邮件) @param array<string, mixed> $channel */
    protected function client(array $channel): SmtpClient
    {
        return new SmtpClient((string) $channel['host'], (int) $channel['port'], (string) $channel['encryption'],
            (string) $channel['username'], (string) $channel['password']);
    }

    private function generateCode(int $length): string
    {
        $code = '';
        for ($i = 0; $i < $length; ++$i) {
            $code .= (string) random_int(0, 9);
        }
        return $code;
    }

    private function codeHash(string $code): string
    {
        return hash_hmac('sha256', 'email-otp:' . $code, $this->auth->aesKey());
    }

    private function assertRateLimit(int $userId, string $emailHash, string $ip): void
    {
        if ($this->redis->exists($this->cooldownKey($userId))) {
            throw new BusinessException(ErrorCode::SMS_SEND_TOO_FREQUENT, 'Please wait before requesting another code.');
        }
        if ((int) $this->redis->get($this->userQuotaKey($userId)) >= self::USER_DAILY_LIMIT
            || (int) $this->redis->get($this->emailQuotaKey($emailHash)) >= self::EMAIL_DAILY_LIMIT) {
            throw new BusinessException(ErrorCode::SMS_SEND_TOO_FREQUENT, 'Daily verification code limit reached. Please try again tomorrow.');
        }
        if ($ip !== '' && (int) $this->redis->get($this->ipQuotaKey($ip)) >= self::IP_HOURLY_LIMIT) {
            throw new BusinessException(ErrorCode::SMS_SEND_TOO_FREQUENT, 'Too many requests. Please try again later.');
        }
    }

    /** 计数键只在首次创建时设 TTL,避免「每日上限」变成滚动窗口(同 SmsVerifyService) */
    private function markSent(int $userId, string $emailHash, string $ip): void
    {
        $this->redis->setex($this->cooldownKey($userId), self::RESEND_COOLDOWN, '1');
        foreach ([[$this->userQuotaKey($userId), 86400], [$this->emailQuotaKey($emailHash), 86400]] as [$key, $ttl]) {
            if ((int) $this->redis->incr($key) === 1) {
                $this->redis->expire($key, $ttl);
            }
        }
        if ($ip !== '') {
            $key = $this->ipQuotaKey($ip);
            if ((int) $this->redis->incr($key) === 1) {
                $this->redis->expire($key, 3600);
            }
        }
    }

    /** @param array{ok:bool,message:string} $result */
    private function writeLog(int $siteId, int $channelId, string $recipient, string $subject, array $result): void
    {
        try {
            Db::connection('system')->table('sys_email_log')->insert([
                'site_id' => $siteId,
                'channel_id' => $channelId,
                'scene' => self::LOG_SCENE,
                'recipient' => CryptoHelper::encrypt($recipient, $this->auth->aesKey()),
                'subject' => mb_substr($subject, 0, 200),
                'status' => $result['ok'] ? 1 : 2,
                'provider_message' => mb_substr($result['message'], 0, 500),
            ]);
        } catch (\Throwable) {
            // 日志失败不影响发码
        }
    }

    private function otpKey(int $siteId, int $userId): string
    {
        return "mtrip:emailotp:req:{$siteId}:{$userId}";
    }

    private function cooldownKey(int $userId): string
    {
        return "mtrip:emailotp:cd:{$userId}";
    }

    private function userQuotaKey(int $userId): string
    {
        return "mtrip:emailotp:quota:user:{$userId}:" . gmdate('Ymd');
    }

    private function emailQuotaKey(string $emailHash): string
    {
        return "mtrip:emailotp:quota:email:{$emailHash}:" . gmdate('Ymd');
    }

    private function ipQuotaKey(string $ip): string
    {
        return 'mtrip:emailotp:quota:ip:' . sha1($ip) . ':' . gmdate('YmdH');
    }
}
