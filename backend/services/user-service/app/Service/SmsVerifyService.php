<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\RedisLock;
use Mtrip\Shared\Support\SmsPohClient;

/**
 * C端短信验证码服务(SMSPoh Verify API V3)
 *
 * 三个场景共用一条链路:发码 `send()` → 验码 `verify()` 拿到一次性 `verifyToken`
 * → 业务接口 `consumeTicket()` 兑换。**验证码本身后端拿不到也不存**——
 * SMSPoh 只回一个 `requestId`,码由服务商校验,我们存的是 requestId(Redis,随验证码同寿)。
 *
 * 为什么要 verifyToken 而不是「验码即注册」:
 *   注册是一次性收单(手机号 + 密码 + 推荐码),而设计稿把推荐码排在验证码之后,
 *   验完码到真正提交注册中间还隔着一屏。用 10 分钟有效的一次性票据把两步串起来,
 *   既不用把密码提前发给验码接口,也不至于让用户回到推荐码页时验证码已经过期。
 *
 * 渠道配置在 `mtrip_system.sys_sms_channel`(provider_code='smspoh'),
 * 走 `system` 连接读取;**没有启用中的渠道时视为未开通短信验证**,
 * 注册接口据此放行(见 `UserAuthService::register` 的 requireSmsVerified 参数),
 * 这样本机开发不必申请真实凭证,生产装上凭证即自动生效。
 */
class SmsVerifyService
{
    /** 支持的场景:注册 / 验证码登录 / 重置密码 */
    public const SCENES = ['register', 'login', 'reset'];

    /** 验码成功后签发的一次性票据有效期(秒) */
    private const TICKET_TTL = 600;

    /** 同一手机号同一场景的重发冷却(秒),与 App 验证码页的倒计时口径一致 */
    private const RESEND_COOLDOWN = 60;

    /** 同一手机号每日发送上限(所有场景合计) */
    private const MOBILE_DAILY_LIMIT = 10;

    /** 同一 IP 每小时发送上限 */
    private const IP_HOURLY_LIMIT = 20;

    public function __construct(
        protected ConfigInterface $config,
        protected Redis $redis,
        protected RedisLock $lock,
        protected UserAuthService $auth,
    ) {
    }

    /** 场景合法性校验(控制器入参用) */
    public static function assertScene(string $scene): string
    {
        if (! in_array($scene, self::SCENES, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 scene 只能是 register/login/reset');
        }
        return $scene;
    }

    /**
     * 当前站点是否已开通短信验证
     *
     * 注册接口用它决定是否强制校验 verifyToken:配了启用中的渠道就强制,没配就照旧放行。
     */
    public function enabled(int $siteId): bool
    {
        return $this->channel($siteId) !== null;
    }

    /**
     * 取本站点可用的 SMSPoh 渠道配置(站点专属优先,回退全局 site_id=0)
     *
     * @return array<string, mixed>|null 缺任一必填项(apiKey/apiSecret/from)时返回 null —— 半配的渠道等于没配
     */
    public function channel(int $siteId): ?array
    {
        $row = Db::connection('system')->table('sys_sms_channel')
            ->where('provider_code', 'smspoh')
            ->where('status', 1)
            ->whereIn('site_id', [$siteId, 0])
            ->whereNull('deleted_at')
            // 站点专属排前面:同时存在站点渠道与全局渠道时用站点的
            ->orderByDesc('site_id')
            ->first();
        if (! $row) {
            return null;
        }
        $row = (array) $row;
        $aesKey = $this->auth->aesKey();
        $apiKey = $this->decryptSafe((string) $row['api_key'], $aesKey);
        $apiSecret = $this->decryptSafe((string) ($row['api_secret'] ?? ''), $aesKey);
        $from = trim((string) $row['sign_name']);
        if ($apiKey === '' || $apiSecret === '' || $from === '') {
            return null;
        }
        $brand = trim((string) ($row['brand_name'] ?? ''));

        return [
            'id' => (int) $row['id'],
            'siteId' => (int) $row['site_id'],
            'apiKey' => $apiKey,
            'apiSecret' => $apiSecret,
            'from' => $from,
            // brand 是 SMSPoh 的必填项,后台没填就用签名兜底,避免整条链路因为一个展示字段发不出去
            'brand' => $brand !== '' ? $brand : $from,
            // 默认国家码:App 的「+95」只是静态标签,用户输入的是本地号,出网前要补成 E.164
            'countryCode' => ltrim(trim((string) ($row['country_code'] ?? '')), '+'),
            'ttl' => $this->clamp((int) $row['code_expire_sec'], SmsPohClient::TTL_MIN, SmsPohClient::TTL_MAX),
            'pinLength' => $this->clamp((int) ($row['pin_length'] ?? 6), SmsPohClient::PIN_LENGTH_MIN, SmsPohClient::PIN_LENGTH_MAX),
            'maxInvalidAttempts' => $this->clamp((int) ($row['max_invalid_attempts'] ?? 5), SmsPohClient::ATTEMPTS_MIN, SmsPohClient::ATTEMPTS_MAX),
        ];
    }

    /**
     * 发送验证码
     *
     * @return array{expiresIn:int,resendAfter:int,pinLength:int,mobile:string}
     */
    public function send(int $siteId, string $mobile, string $scene, string $ip): array
    {
        self::assertScene($scene);
        $this->assertMobileFormat($mobile);
        $channel = $this->requireChannel($siteId);
        $mobileHash = $this->auth->mobileHash($mobile);

        // 场景前置条件:注册要求号码未占用,登录/重置要求号码已存在且可用
        $this->assertSceneEligible($siteId, $scene, $mobileHash);

        // 同号同场景串行,防止连点两次拿到两个 requestId(后发的会把先发的覆盖掉,先发的码就废了)
        $lockKey = "mtrip:lock:sms:send:{$siteId}:{$scene}:{$mobileHash}";
        return $this->lock->run($lockKey, 15, function () use ($siteId, $mobile, $scene, $ip, $channel, $mobileHash): array {
            $this->assertRateLimit($siteId, $scene, $mobileHash, $ip);

            $result = $this->client($channel)->requestOtp($mobile, $channel['from'], $channel['brand'], [
                'ttl' => $channel['ttl'],
                'pinLength' => $channel['pinLength'],
                'maxInvalidAttempts' => $channel['maxInvalidAttempts'],
            ]);

            $this->writeLog($siteId, $channel, $scene, $mobile, $result);
            if (! $result['ok']) {
                // 服务商的英文技术描述只进日志,不下发给用户
                throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE);
            }

            // requestId 与验证码同寿:多给 60 秒余量,让「码刚过期」的用户拿到"已过期"而不是"请重新获取"
            $this->redis->setex(
                $this->otpKey($siteId, $scene, $mobileHash),
                $channel['ttl'] + 60,
                (string) $result['requestId'],
            );
            $this->markSent($siteId, $scene, $mobileHash, $ip);

            return [
                'expiresIn' => $channel['ttl'],
                'resendAfter' => self::RESEND_COOLDOWN,
                'pinLength' => $channel['pinLength'],
                // 回显脱敏号码,让 App 的「已发送到 09***56」与后端实际发送的目标一致
                'mobile' => MaskHelper::mobile($mobile),
            ];
        }, '验证码发送中,请勿重复提交');
    }

    /**
     * 校验验证码,成功返回一次性 verifyToken
     *
     * @return array{verifyToken:string,expiresIn:int}
     */
    public function verify(int $siteId, string $mobile, string $scene, string $code): array
    {
        self::assertScene($scene);
        $this->assertMobileFormat($mobile);
        if (! preg_match('/^\d{4,8}$/', $code)) {
            throw new BusinessException(ErrorCode::SMS_CODE_INVALID);
        }
        $channel = $this->requireChannel($siteId);
        $mobileHash = $this->auth->mobileHash($mobile);

        $otpKey = $this->otpKey($siteId, $scene, $mobileHash);
        $requestId = $this->redis->get($otpKey);
        if (! is_string($requestId) || $requestId === '') {
            throw new BusinessException(ErrorCode::SMS_CODE_EXPIRED);
        }

        $result = $this->client($channel)->verifyOtp($requestId, $code);
        if (! $result['ok']) {
            // 401 是我们的凭证问题(用户重填多少次都不会好),其余 4xx 才是码不对
            if ($result['status'] === 401 || $result['status'] >= 500 || $result['status'] === 0) {
                throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE);
            }
            throw new BusinessException(ErrorCode::SMS_CODE_INVALID);
        }

        // 验过即作废:同一个 requestId 不允许复用(SMSPoh 侧也已核销)
        $this->redis->del($otpKey);

        $token = bin2hex(random_bytes(24));
        $this->redis->setex($this->ticketKey($token), self::TICKET_TTL, json_encode([
            'siteId' => $siteId,
            'scene' => $scene,
            'mobileHash' => $mobileHash,
        ], JSON_UNESCAPED_UNICODE) ?: '');

        return ['verifyToken' => $token, 'expiresIn' => self::TICKET_TTL];
    }

    /**
     * 校验 verifyToken:「站点 + 场景 + 手机号」三者必须与签发时一致
     *
     * 手机号绑定是关键的一道 —— 否则拿自己号码验出来的票据可以用来注册别人的号码。
     *
     * **本方法只验不销**,必须与 `discardTicket()` 配对使用:
     * 业务(建号 / 改密)成功之后才作废票据,这样「推荐码填错」这类中途失败
     * 不会把票据一起赔进去,用户改完直接重试即可,不用再等一条短信。
     * 反过来说,验完到销毁之间不能有任何"可能建号成功但整体失败"的分支。
     */
    public function assertTicket(int $siteId, string $scene, string $mobile, string $token): void
    {
        if ($token === '') {
            throw new BusinessException(ErrorCode::SMS_VERIFY_REQUIRED);
        }
        $raw = $this->redis->get($this->ticketKey($token));
        if (! is_string($raw) || $raw === '') {
            throw new BusinessException(ErrorCode::SMS_VERIFY_REQUIRED, '短信验证已失效,请重新获取验证码');
        }
        $payload = json_decode($raw, true);
        $matched = is_array($payload)
            && (int) ($payload['siteId'] ?? 0) === $siteId
            && (string) ($payload['scene'] ?? '') === $scene
            && hash_equals((string) ($payload['mobileHash'] ?? ''), $this->auth->mobileHash($mobile));
        if (! $matched) {
            // 票据存在但对不上号:多半是拿票据去套别的手机号,直接作废掉,不留重试机会
            $this->discardTicket($token);
            throw new BusinessException(ErrorCode::SMS_VERIFY_REQUIRED, '短信验证与提交的手机号不一致,请重新验证');
        }
    }

    /** 作废 verifyToken(业务成功后调用,一次性) */
    public function discardTicket(string $token): void
    {
        if ($token !== '') {
            $this->redis->del($this->ticketKey($token));
        }
    }

    /**
     * 构造服务商客户端
     *
     * 单独抽一个方法是为了可测:单测覆写它注入假客户端,就能在不发真短信、不联网的前提下
     * 覆盖「发码失败 / 验码通过 / 验码失败 / 凭证错误」四条分支(见 shared/tests/cases/SmsVerifyServiceTest.php)。
     *
     * @param array<string, mixed> $channel
     */
    protected function client(array $channel): SmsPohClient
    {
        return new SmsPohClient(
            (string) $channel['apiKey'],
            (string) $channel['apiSecret'],
            (string) $channel['countryCode'],
        );
    }

    /** 未配置可用渠道时统一按「短信服务不可用」拒绝(而不是 500 堆栈) */
    private function requireChannel(int $siteId): array
    {
        $channel = $this->channel($siteId);
        if ($channel === null) {
            throw new BusinessException(ErrorCode::SMS_CHANNEL_UNAVAILABLE, '短信服务未配置,请联系客服');
        }
        return $channel;
    }

    /** 与 AuthController::register 同一条正则,避免两处口径不一致 */
    private function assertMobileFormat(string $mobile): void
    {
        if (! preg_match('/^\+?\d{6,20}$/', $mobile)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '手机号格式不正确');
        }
    }

    /**
     * 场景前置校验
     *
     * 注册向未注册号码发码、登录/重置向已注册号码发码 —— 不校验的话,
     * 用户会在「收到码、验完码」之后才在最后一步被告知号码已注册/未注册,白等两分钟。
     * 这确实构成手机号是否注册的探测面,但注册接口本身就会返回「该手机号已注册」,
     * 这里不额外扩大暴露面,换来的是可用的错误提示。
     */
    private function assertSceneEligible(int $siteId, string $scene, string $mobileHash): void
    {
        $user = Db::table('user_info')
            ->where('site_id', $siteId)->where('mobile_hash', $mobileHash)
            ->whereNull('deleted_at')->first(['id', 'user_status']);

        if ($scene === 'register') {
            if ($user) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该手机号已注册');
            }
            return;
        }
        if (! $user) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '该手机号尚未注册');
        }
        $status = (int) ((array) $user)['user_status'];
        if ($status === 2) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '账号已被冻结,请联系客服');
        }
        if ($status === 3) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '账号已注销');
        }
    }

    /**
     * 三道限流:同号同场景冷却 60 秒、同号每日 10 条、同 IP 每小时 20 条
     *
     * 每条短信都是真金白银,且手机号可被任意游客提交,不限流等于给人当短信炮台。
     */
    private function assertRateLimit(int $siteId, string $scene, string $mobileHash, string $ip): void
    {
        if ($this->redis->exists($this->cooldownKey($siteId, $scene, $mobileHash))) {
            throw new BusinessException(ErrorCode::SMS_SEND_TOO_FREQUENT, '发送过于频繁,请稍后再试');
        }
        if ((int) $this->redis->get($this->mobileQuotaKey($siteId, $mobileHash)) >= self::MOBILE_DAILY_LIMIT) {
            throw new BusinessException(ErrorCode::SMS_SEND_TOO_FREQUENT, '该手机号今日验证码次数已达上限');
        }
        if ($ip !== '' && (int) $this->redis->get($this->ipQuotaKey($ip)) >= self::IP_HOURLY_LIMIT) {
            throw new BusinessException(ErrorCode::SMS_SEND_TOO_FREQUENT, '操作过于频繁,请稍后再试');
        }
    }

    /**
     * 发送成功后落冷却与计数
     *
     * 计数键只在首次创建时设 TTL(incr 返回 1),否则每发一条都续期会让「每日上限」变成滚动窗口而永不重置。
     */
    private function markSent(int $siteId, string $scene, string $mobileHash, string $ip): void
    {
        $this->redis->setex($this->cooldownKey($siteId, $scene, $mobileHash), self::RESEND_COOLDOWN, '1');

        $mobileQuota = $this->mobileQuotaKey($siteId, $mobileHash);
        if ((int) $this->redis->incr($mobileQuota) === 1) {
            $this->redis->expire($mobileQuota, 86400);
        }
        if ($ip !== '') {
            $ipQuota = $this->ipQuotaKey($ip);
            if ((int) $this->redis->incr($ipQuota) === 1) {
                $this->redis->expire($ipQuota, 3600);
            }
        }
    }

    /** 写 sys_sms_log(手机号加密存储,与该表既有约定一致);日志失败不影响发码结果 */
    private function writeLog(int $siteId, array $channel, string $scene, string $mobile, array $result): void
    {
        try {
            Db::connection('system')->table('sys_sms_log')->insert([
                'site_id' => $siteId,
                'channel_id' => $channel['id'],
                'template_id' => 0,
                'scene' => $scene,
                'provider_request_id' => (string) $result['requestId'],
                'mobile' => CryptoHelper::encrypt($mobile, $this->auth->aesKey()),
                // 正文由 SMSPoh 按 brand 模板下发,我方不持有;只记可复核的元信息
                'content' => sprintf('[SMSPoh] OTP %s pin=%d ttl=%ds', $scene, $channel['pinLength'], $channel['ttl']),
                'status' => $result['ok'] ? 1 : 2,
                'fail_reason' => mb_substr((string) $result['message'], 0, 255),
            ]);
        } catch (\Throwable) {
            // 日志表写不进去不该让用户收不到验证码
        }
    }

    private function otpKey(int $siteId, string $scene, string $mobileHash): string
    {
        return "mtrip:otp:req:{$siteId}:{$scene}:{$mobileHash}";
    }

    private function cooldownKey(int $siteId, string $scene, string $mobileHash): string
    {
        return "mtrip:otp:cd:{$siteId}:{$scene}:{$mobileHash}";
    }

    private function mobileQuotaKey(int $siteId, string $mobileHash): string
    {
        return "mtrip:otp:quota:mobile:{$siteId}:{$mobileHash}:" . gmdate('Ymd');
    }

    private function ipQuotaKey(string $ip): string
    {
        return 'mtrip:otp:quota:ip:' . sha1($ip) . ':' . gmdate('YmdH');
    }

    private function ticketKey(string $token): string
    {
        return 'mtrip:otp:ticket:' . $token;
    }

    private function clamp(int $value, int $min, int $max): int
    {
        return max($min, min($max, $value));
    }

    private function decryptSafe(string $ciphertext, string $aesKey): string
    {
        if ($ciphertext === '') {
            return '';
        }
        try {
            return CryptoHelper::decrypt($ciphertext, $aesKey);
        } catch (\Throwable) {
            return '';
        }
    }
}
