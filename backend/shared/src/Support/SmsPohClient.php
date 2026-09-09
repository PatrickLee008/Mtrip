<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

/**
 * SMSPoh Verify API V3 客户端(https://smspoh.com/v3/developers/verify-api)
 *
 * 服务商口径(照抄自规范,别按常见 REST 习惯猜):
 *   - 基址 https://v3.smspoh.com/api/otp,发码 POST /request,验码 POST /verify
 *   - **参数全部走 query string,不是 JSON body**;POST 本身没有请求体
 *   - 鉴权是 `accessToken=base64(APIKey:APISecret)`,同样放在 query 里
 *     (V3 与旧版凭证不通用,需在 v3.smspoh.com 的 Accounts & Security > API Credentials 重新申请)
 *   - 发码成功返回 `requestId`,验码必须带上它;**验证码本身服务端拿不到**,
 *     所以我们只能把 requestId 存起来,由 SMSPoh 校验用户输入的码
 *
 * 设计:纯逻辑(建 URL / 解析响应)与网络调用分开 —— `httpPost()` 是 protected,
 * 单测里覆写它就能在没有网络的情况下覆盖全部分支(见 shared/tests/cases/SmsPohClientTest.php)。
 */
class SmsPohClient
{
    public const BASE_URL = 'https://v3.smspoh.com/api/otp';

    /** SMSPoh 对三个可调参数的取值范围(超出会被服务商拒绝,故在本地先夹取) */
    public const TTL_MIN = 60;
    public const TTL_MAX = 3600;
    public const PIN_LENGTH_MIN = 4;
    public const PIN_LENGTH_MAX = 8;
    public const ATTEMPTS_MIN = 1;
    public const ATTEMPTS_MAX = 10;

    public function __construct(
        protected string $apiKey,
        protected string $apiSecret,
        /** 默认国家码(不含 +),把用户输入的本地号码补成 E.164;空串 = 不补 */
        protected string $countryCode = '',
        protected int $timeout = 15,
    ) {
    }

    /** 鉴权令牌:base64(APIKey:APISecret) */
    public static function accessToken(string $apiKey, string $apiSecret): string
    {
        return base64_encode($apiKey . ':' . $apiSecret);
    }

    /**
     * 手机号归一为 E.164(`+国家码国内号`)
     *
     * **必须补国家码**:App 登录/注册页把「+95」画成静态标签却从不拼进请求,
     * 用户按占位符 `9xxxxxxxx` 输入的 `9971183240` 以 `99` 开头 —— SMSPoh 只接受
     * `09xxxxxxxx` / `959xxxxxxx` / `+959xxxxxx` 三种前缀,三种都不是,直接发过去会被拒。
     *
     * **只影响出网的 `to`**:库里的 `mobile` / `mobile_hash` 仍按用户原样输入存,
     * 改存储格式会让存量账号登不进来。
     *
     * 判定顺序:
     *   1. `+` 开头   → 已是 E.164,原样用
     *   2. `00` 开头  → 国际冠码,换成 `+`
     *   3. `0` 开头   → 国内长途冠码,去掉 0 再补国家码(`09971183240` → `+959971183240`)
     *   4. 以国家码开头**且总长 ≥ 国家码长+9** → 用户自己带了国家码,只补 `+`
     *   5. 其余       → 当作国内号,补 `+国家码`
     *
     * 第 4 条的长度门槛是为了消歧:缅甸国内号 `95xxxxxxxx`(10 位)本身就以 95 开头,
     * 只看前缀会把它误判成「已带国家码」而少发 2 位;带国家码的 `959971183240` 是 12 位,
     * 用长度就能把两者分开。这条在极端号段上仍可能判错,所以国家码做成渠道可配 ——
     * 真要严格,得让客户端把国家码作为独立字段上送(那要改 App 与接口约定,本次未做)。
     */
    public static function normalizeMobile(string $mobile, string $countryCode = ''): string
    {
        $digits = preg_replace('/[\s\-()]/', '', trim($mobile)) ?? '';
        if ($digits === '' || str_starts_with($digits, '+')) {
            return $digits;
        }
        if (str_starts_with($digits, '00')) {
            return '+' . substr($digits, 2);
        }
        $cc = ltrim(trim($countryCode), '+');
        if ($cc === '') {
            // 没配国家码时维持原样(不猜),由服务商自行判定
            return $digits;
        }
        if (str_starts_with($digits, '0')) {
            return '+' . $cc . ltrim(substr($digits, 1), '0');
        }
        if (str_starts_with($digits, $cc) && strlen($digits) >= strlen($cc) + 9) {
            return '+' . $digits;
        }
        return '+' . $cc . $digits;
    }

    /**
     * 发码请求 URL(纯函数,便于单测)
     *
     * @param array<string, string|int> $extra ttl / pinLength / template / maxInvalidAttempts 等可选参数
     */
    public function buildRequestUrl(string $to, string $from, string $brand, array $extra = []): string
    {
        $query = array_merge([
            'accessToken' => self::accessToken($this->apiKey, $this->apiSecret),
            'to' => self::normalizeMobile($to, $this->countryCode),
            'from' => $from,
            'brand' => $brand,
        ], $extra);

        // http_build_query 做 RFC1738 编码:accessToken 里的 `+` `/` `=` 都会被正确转义
        return self::BASE_URL . '/request?' . http_build_query($query);
    }

    /** 验码请求 URL(纯函数,便于单测) */
    public function buildVerifyUrl(string $requestId, string $code): string
    {
        return self::BASE_URL . '/verify?' . http_build_query([
            'accessToken' => self::accessToken($this->apiKey, $this->apiSecret),
            'requestId' => $requestId,
            'code' => $code,
        ]);
    }

    /**
     * 发码。返回 `['ok'=>bool, 'status'=>int, 'requestId'=>string, 'expireAt'=>string, 'message'=>string]`
     *
     * **不抛异常**:调用方(SmsVerifyService)要按 status 区分「我方凭证配错(401)」与
     * 「服务商临时故障(5xx)」并给出不同的用户文案,抛异常就得靠 message 猜。
     *
     * @param array<string, string|int> $extra
     */
    public function requestOtp(string $to, string $from, string $brand, array $extra = []): array
    {
        [$status, $body] = $this->httpPost($this->buildRequestUrl($to, $from, $brand, $extra));
        return self::parseRequestResponse($status, $body);
    }

    /** 验码。返回结构同上(无 requestId/expireAt) */
    public function verifyOtp(string $requestId, string $code): array
    {
        [$status, $body] = $this->httpPost($this->buildVerifyUrl($requestId, $code));
        return self::parseVerifyResponse($status, $body);
    }

    /**
     * 解析发码响应(纯函数)
     *
     * 成功体:{"channel":"SMS","requestId":123456789,"to":"09********","createdAt":..,"expireAt":..}
     * `requestId` 按字符串保存 —— 示例值是 9 位整数,但服务商没承诺位数,
     * 用 int 存在 32 位环境上有溢出风险,而我们只是原样回传给验码接口。
     */
    public static function parseRequestResponse(int $status, string $body): array
    {
        $json = self::decode($body);
        $ok = $status >= 200 && $status < 300;
        $requestId = '';
        if (isset($json['requestId']) && (is_string($json['requestId']) || is_int($json['requestId']))) {
            $requestId = trim((string) $json['requestId']);
        }
        // 2xx 但没给 requestId 等于没发出去:后续验码无从谈起,按失败处理
        if ($ok && $requestId === '') {
            return ['ok' => false, 'status' => $status, 'requestId' => '', 'expireAt' => '', 'message' => '短信服务商未返回 requestId'];
        }
        return [
            'ok' => $ok,
            'status' => $status,
            'requestId' => $requestId,
            'expireAt' => isset($json['expireAt']) ? (string) $json['expireAt'] : '',
            'message' => self::errorMessage($json, $body, $ok),
        ];
    }

    /** 解析验码响应(纯函数):2xx 即验证通过 */
    public static function parseVerifyResponse(int $status, string $body): array
    {
        $json = self::decode($body);
        $ok = $status >= 200 && $status < 300;
        return [
            'ok' => $ok,
            'status' => $status,
            'message' => self::errorMessage($json, $body, $ok),
        ];
    }

    /**
     * 发起 POST(无请求体,参数已在 URL 上),返回 [HTTP状态码, 响应体]
     *
     * 用 stream_context + file_get_contents,与 system-service 调阿里云 OSS 的既有写法一致:
     * Swoole 的 hook 会把流函数协程化,不会阻塞 worker,也不必为此新增 composer 依赖。
     * `ignore_errors` 必须开,否则 4xx/5xx 时拿不到响应体,错误原因就丢了。
     *
     * @return array{0:int,1:string}
     */
    protected function httpPost(string $url): array
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", ['Accept: application/json', 'Content-Length: 0']),
                'content' => '',
                'ignore_errors' => true,
                'timeout' => $this->timeout,
            ],
        ]);
        $body = @file_get_contents($url, false, $context);
        if ($body === false) {
            // 连不上/超时:$http_response_header 可能压根没有,用 0 表示「没有拿到 HTTP 响应」
            return [0, ''];
        }
        return [self::statusFromHeaders($http_response_header ?? []), $body];
    }

    /**
     * 从响应头数组里取 HTTP 状态码
     *
     * 取**最后一个** `HTTP/` 行:发生重定向时 $http_response_header 会把每一跳的头依次追加,
     * 取第一行会拿到 30x 而不是最终状态。
     *
     * @param array<int, string> $headers
     */
    public static function statusFromHeaders(array $headers): int
    {
        $status = 0;
        foreach ($headers as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m) === 1) {
                $status = (int) $m[1];
            }
        }
        return $status;
    }

    /** @return array<string, mixed> */
    private static function decode(string $body): array
    {
        $json = json_decode($body, true);
        return is_array($json) ? $json : [];
    }

    /**
     * 失败原因:优先服务商的 message 字段,没有就退回截断的原始响应体
     *
     * 该文案**只进日志**,不直接下发给 C 端用户(服务商返回的是英文技术描述,
     * 且可能带内部信息);用户看到的是 SmsVerifyService 里的 i18n 无关中文提示。
     *
     * @param array<string, mixed> $json
     */
    private static function errorMessage(array $json, string $body, bool $ok): string
    {
        if ($ok) {
            return '';
        }
        if (isset($json['message']) && is_string($json['message']) && $json['message'] !== '') {
            return $json['message'];
        }
        return $body === '' ? '短信服务商无响应' : mb_substr($body, 0, 200);
    }
}
