<?php

declare(strict_types=1);

namespace Mtrip\Shared\Payment;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * payment-service(统一支付中心)内部接口调用方 SDK(方案22 §4.1 / §4.2)
 *
 * - 全部 POST JSON 到 `/internal/v1/*`,入参驼峰,请求头带 `X-Internal-Token`(env MTRIP_INTERNAL_TOKEN);
 * - 响应 `{code,message,data}`:code=0 返回 data 数组;code≠0 原样抛 BusinessException(code, message);
 * - 网络失败 / 非 JSON / 缺 code 字段:抛 BusinessException(THIRD_PARTY_ERROR, '支付中心不可用')。
 *
 * 写法沿用 SmsPohClient / KbzPayClient:curl + 各服务 SWOOLE_HOOK_FLAGS 协程化,不新增 composer 依赖;
 * `httpPost()` 为 protected,单测覆写即可离线覆盖全部分支。token 不进任何日志。
 */
class PaymentCenterClient
{
    public const DEFAULT_BASE_URL = 'http://payment-service:9508';

    public const CONNECT_TIMEOUT = 2;

    public const TOTAL_TIMEOUT = 10;

    public const UNAVAILABLE_CODE = ErrorCode::THIRD_PARTY_ERROR;

    public const UNAVAILABLE_MESSAGE = '支付中心不可用';

    protected string $baseUrl;

    protected string $token;

    public function __construct(?string $baseUrl = null, ?string $token = null)
    {
        $base = $baseUrl ?? self::env('PAYMENT_CENTER_URL');
        $this->baseUrl = rtrim($base !== '' ? $base : self::DEFAULT_BASE_URL, '/');
        $this->token = $token ?? self::env('MTRIP_INTERNAL_TOKEN');
    }

    /** 下单:siteId, bizType, bizNo, userId, amount, currency, channel, subject, expireAt, notifyUrl → payNo, qrCode, expireAt, status */
    public function createPayment(array $p): array
    {
        return $this->call('/internal/v1/payment/create', $p);
    }

    /** 查单:payNo 或 bizType+bizNo;refresh=1 实时查渠道 → status, channelTradeNo, paidAt */
    public function queryPayment(array $p): array
    {
        return $this->call('/internal/v1/payment/query', $p);
    }

    /** 重推业务通知:payNo 或 refundNo */
    public function renotify(array $p): array
    {
        return $this->call('/internal/v1/payment/renotify', $p);
    }

    /** 退款:payNo, refundNo, amount, reason, notifyUrl → status, channelRefundNo */
    public function createRefund(array $p): array
    {
        return $this->call('/internal/v1/refund/create', $p);
    }

    /**
     * 该支付单已占用的渠道退款配额(payment/query 出参 refundCount / refundedAmount 透传;不刷新渠道)
     *
     * refundCount / refundedAmount 只计成功 + 处理中(失败的不占 KBZ 次数);旧版支付中心缺字段时按 0 处理。
     *
     * @return array{refundCount:int, refundedCents:int, paidCents:int, status:string}
     */
    public function refundQuota(string $payNo): array
    {
        $q = $this->queryPayment(['payNo' => $payNo]);
        return [
            'refundCount' => max(0, (int) ($q['refundCount'] ?? 0)),
            'refundedCents' => (int) (PaymentRules::toCents((string) ($q['refundedAmount'] ?? '0')) ?? 0),
            'paidCents' => (int) (PaymentRules::toCents((string) ($q['amount'] ?? '0')) ?? 0),
            'status' => (string) ($q['status'] ?? ''),
        ];
    }

    public function queryRefund(string $refundNo): array
    {
        return $this->call('/internal/v1/refund/query', ['refundNo' => $refundNo]);
    }

    /** 收款账户连通性测试 → ok, kind, code, message */
    public function channelTest(int $accountId): array
    {
        return $this->call('/internal/v1/channel/test', ['accountId' => $accountId]);
    }

    /**
     * 站点可用渠道(沿站点树回溯;绑定或账户停用即不可用)
     *
     * @return list<array{channel:string, currencies:list<string>, minAmount:string, maxAmount:string}>
     */
    public function availableChannels(int $siteId): array
    {
        return array_values($this->call('/internal/v1/channel/available', ['siteId' => $siteId]));
    }

    /** 发起调用并解包 data */
    protected function call(string $path, array $payload): array
    {
        $json = json_encode($payload === [] ? new \stdClass() : $payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '支付中心请求参数无法编码');
        }
        $resp = $this->httpPost($this->baseUrl . $path, $json, [
            'Content-Type: application/json',
            'Accept: application/json',
            'X-Internal-Token: ' . $this->token,
        ]);
        return self::unwrap($path, (int) ($resp['status'] ?? 0), (string) ($resp['body'] ?? ''));
    }

    /**
     * 解析响应(纯函数):以 body 中的 code 为准,HTTP 状态码仅用于诊断
     * (payment-service 的业务错误会带 4xx/5xx 状态,但 body 仍是标准结构,须原样透传)。
     */
    public static function unwrap(string $path, int $status, string $body): array
    {
        $decoded = $body === '' ? null : json_decode($body, true);
        if (! is_array($decoded) || ! array_key_exists('code', $decoded) || ! is_numeric($decoded['code'])) {
            error_log(sprintf('payment_center_unavailable path=%s status=%d reason=%s', $path, $status, $body === '' ? 'no_response' : 'bad_body'));
            throw new BusinessException(self::UNAVAILABLE_CODE, self::UNAVAILABLE_MESSAGE);
        }
        $code = (int) $decoded['code'];
        if ($code !== ErrorCode::SUCCESS) {
            $message = isset($decoded['message']) && is_string($decoded['message']) && $decoded['message'] !== ''
                ? $decoded['message'] : null;
            throw new BusinessException($code, $message);
        }
        return is_array($decoded['data'] ?? null) ? $decoded['data'] : [];
    }

    /**
     * POST JSON,返回 HTTP 状态与响应体;连接失败/超时返回 status=0、body=''
     *
     * @param array<int, string> $headers
     * @return array{status:int, body:string}
     */
    protected function httpPost(string $url, string $json, array $headers): array
    {
        $ch = curl_init($url);
        if ($ch === false) {
            return ['status' => 0, 'body' => ''];
        }
        try {
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $json,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
                CURLOPT_TIMEOUT => self::TOTAL_TIMEOUT,
                CURLOPT_FOLLOWLOCATION => false,
            ]);
            $body = curl_exec($ch);
            $errno = curl_errno($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($body === false || $errno !== 0) {
                error_log(sprintf('payment_center_curl_failed url=%s errno=%d', $url, $errno));
                return ['status' => 0, 'body' => ''];
            }
            return ['status' => $status, 'body' => (string) $body];
        } finally {
            curl_close($ch);
        }
    }

    private static function env(string $key): string
    {
        $value = function_exists('Hyperf\Support\env') ? \Hyperf\Support\env($key, '') : getenv($key);
        return is_string($value) ? trim($value) : '';
    }
}
