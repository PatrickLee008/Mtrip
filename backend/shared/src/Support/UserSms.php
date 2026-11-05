<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Coroutine\Coroutine;
use Hyperf\DbConnection\Db;

/**
 * C 端预订通知短信(Consumer App PRD 模块 10 Notification,QA N_TC_018 / 019 / 020)。
 *
 * 由 UserNotify::send 在写完站内信后顺带调用,只对 TEMPLATES 里的事件发短信:
 *   退款申请(含退款金额、退款去向、预计 3-7 个工作日到账,PRD「Refunds … may take 3–7 business days」)、
 *   退款完成、住后写评价提醒。
 *
 * 通道复用后台「短信渠道」里本站点(回退全局)启用的 SMSPoh 配置(与 OTP 同一组凭证),
 * 走 RESTful SMS API 发普通短信;没有可用渠道 / 用户没绑手机就静默跳过。
 * **在独立协程里发送,不等结果**:短信慢或失败都不能拖慢、更不能回滚退款等主流程;
 * 每次发送写一条 sys_sms_log(scene=notify,手机号加密存),便于后台对账。
 * 文案统一英文(SMS 不随 App 语言切换;缅甸语模板待运营提供)。
 */
final class UserSms
{
    /** 预计退款到账时间(PRD 模块 9 退款规则) */
    private const REFUND_ETA = '3-7 business days';

    /** 事件 → 英文短信模板;{var} 用通知 params 替换,{amount} 预先格式化成「MMK 19,500」 */
    public const TEMPLATES = [
        'refund_requested' => 'mTrip: Your cancellation for {hotel} ({orderNo}) is received. Refund of {amount} will be credited to your mTrip Wallet, estimated ' . self::REFUND_ETA . '.',
        'refund_requested_original' => 'mTrip: Your cancellation for {hotel} ({orderNo}) is received. Refund of {amount} will be returned to your original payment account, estimated ' . self::REFUND_ETA . '.',
        'refund_completed' => 'mTrip: Refund of {amount} for {hotel} ({orderNo}) has been credited to your mTrip Wallet.',
        'refund_completed_original' => 'mTrip: Refund of {amount} for {hotel} ({orderNo}) has been returned to your original payment account.',
        'refund_completed_wallet_fallback' => 'mTrip: Refund of {amount} for {hotel} ({orderNo}) has been credited to your mTrip Wallet.',
        'review_request' => 'mTrip: Thanks for staying at {hotel}! Share your experience in the mTrip app and earn loyalty points.',
    ];

    /** 零小数位币种(与 App formatMoney 同口径) */
    private const ZERO_DECIMAL = ['MMK', 'JPY', 'KRW', 'VND', 'IDR'];

    /** 渲染短信正文(纯函数,便于单测);不在模板里的事件返回 null */
    public static function render(string $event, array $params, string $currency = ''): ?string
    {
        $template = self::TEMPLATES[$event] ?? null;
        if ($template === null) {
            return null;
        }
        if (isset($params['amount']) && is_numeric($params['amount'])) {
            $params['amount'] = self::money((float) $params['amount'], $currency);
        }
        return (string) preg_replace_callback('/\{(\w+)\}/', static function (array $m) use ($params): string {
            $value = $params[$m[1]] ?? '';
            return is_scalar($value) ? (string) $value : '';
        }, $template);
    }

    public static function money(float $amount, string $currency): string
    {
        $currency = strtoupper(trim($currency));
        $digits = in_array($currency, self::ZERO_DECIMAL, true) ? 0 : 2;
        $number = number_format($amount, $digits, '.', ',');
        return $currency === '' ? $number : $currency . ' ' . $number;
    }

    /** 异步发送(协程里跑,调用方无需等待);非协程环境(脚本 / 单测)直接同步跑 */
    public static function dispatch(int $siteId, int $userId, string $event, array $params, int $bizId = 0): void
    {
        if ($userId <= 0 || ! isset(self::TEMPLATES[$event])) {
            return;
        }
        $job = static function () use ($siteId, $userId, $event, $params, $bizId): void {
            try {
                self::sendNow($siteId, $userId, $event, $params, $bizId);
            } catch (\Throwable) {
                // 短信是附加通道,任何异常都吞掉(站内信已写)
            }
        };
        if (class_exists(Coroutine::class) && Coroutine::inCoroutine()) {
            Coroutine::create($job);
            return;
        }
        $job();
    }

    private static function sendNow(int $siteId, int $userId, string $event, array $params, int $bizId): void
    {
        $aesKey = (string) ApplicationContext::getContainer()->get(ConfigInterface::class)->get('mtrip.aes_key', '');
        $channel = self::channel($siteId, $aesKey);
        if ($channel === null) {
            return;
        }
        $user = Db::table('user_info')->where('id', $userId)->first(['mobile']);
        $mobile = $user ? self::decrypt((string) $user->mobile, $aesKey) : '';
        if ($mobile === '') {
            return;
        }
        $currency = (string) Db::connection('system')->table('sys_site')->where('id', $siteId)->value('currency');
        $text = self::render($event, $params, $currency);
        if ($text === null) {
            return;
        }
        $result = (new SmsPohClient($channel['apiKey'], $channel['apiSecret'], $channel['countryCode']))
            ->sendMessage($mobile, $channel['from'], $text, "notify-{$event}-{$bizId}");
        Db::connection('system')->table('sys_sms_log')->insert([
            'site_id' => $siteId,
            'channel_id' => $channel['id'],
            'template_id' => 0,
            'scene' => 'notify',
            'provider_request_id' => mb_substr((string) $result['messageId'], 0, 64),
            'mobile' => CryptoHelper::encrypt($mobile, $aesKey),
            'content' => mb_substr("[{$event}] {$text}", 0, 500),
            'status' => $result['ok'] ? 1 : 2,
            'fail_reason' => mb_substr((string) $result['message'], 0, 255),
        ]);
    }

    /**
     * 本站点可用的 SMSPoh 渠道(站点专属优先,回退全局 site_id=0;与 user-service SmsVerifyService::channel 同口径)。
     * 缺 apiKey / apiSecret / 签名任一项视为未配置。
     *
     * @return array{id:int,apiKey:string,apiSecret:string,from:string,countryCode:string}|null
     */
    private static function channel(int $siteId, string $aesKey): ?array
    {
        $row = Db::connection('system')->table('sys_sms_channel')
            ->where('provider_code', 'smspoh')
            ->where('status', 1)
            ->whereIn('site_id', [$siteId, 0])
            ->whereNull('deleted_at')
            ->orderByDesc('site_id')
            ->first();
        if (! $row) {
            return null;
        }
        $row = (array) $row;
        $apiKey = self::decrypt((string) $row['api_key'], $aesKey);
        $apiSecret = self::decrypt((string) ($row['api_secret'] ?? ''), $aesKey);
        $from = trim((string) $row['sign_name']);
        if ($apiKey === '' || $apiSecret === '' || $from === '') {
            return null;
        }
        return [
            'id' => (int) $row['id'],
            'apiKey' => $apiKey,
            'apiSecret' => $apiSecret,
            'from' => $from,
            'countryCode' => ltrim(trim((string) ($row['country_code'] ?? '')), '+'),
        ];
    }

    private static function decrypt(string $ciphertext, string $aesKey): string
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
