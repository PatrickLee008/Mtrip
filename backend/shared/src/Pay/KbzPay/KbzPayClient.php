<?php

declare(strict_types=1);

namespace Mtrip\Shared\Pay\KbzPay;

/**
 * KBZPay MMQR 网关客户端(方案 22 §1/§2;官方 PHP SDK 仅作协议对照,未引入)
 *
 * 报文:`{"Request":{timestamp,notify_url?,method,nonce_str,version,sign_type,sign,biz_content:{...}}}`
 * 签名:外层 + biz_content 平铺后按 KbzSigner 规则计算。
 * 响应:`{"Response":{result,code,msg,nonce_str,sign,sign_type,...}}`,result=SUCCESS 时**必须验签**。
 *
 * 结构参照 Support/SmsPohClient:报文构造 / 响应解析是 public static 纯函数,
 * 网络只在 protected httpPost() 里,单测覆写它即可离线覆盖全部分支。
 * curl 依赖各服务 bin/hyperf.php 的 SWOOLE_HOOK_FLAGS 协程化,不新增 composer 依赖。
 *
 * 安全:日志与异常消息不含 AppKey、证书、私钥密码、签名原串与原始响应体。
 */
class KbzPayClient
{
    public const VERSION_1_0 = '1.0';
    public const VERSION_3_0 = '3.0';

    public const METHOD_PRECREATE = 'kbz.payment.precreate';
    public const METHOD_QUERY_ORDER = 'kbz.payment.queryorder';
    public const METHOD_REFUND = 'kbz.payment.refund';

    public const TRADE_TYPE_QRCODE = 'PAY_BY_QRCODE';
    public const RESULT_SUCCESS = 'SUCCESS';

    /** 下单 / 查单(无需证书) */
    public const UAT_PRECREATE_URL = 'http://api-uat.kbzpay.com/payment/gateway/uat/precreate';
    public const UAT_QUERY_ORDER_URL = 'http://api-uat.kbzpay.com/payment/gateway/uat/queryorder';
    public const PROD_PRECREATE_URL = 'https://api.kbzpay.com/payment/gateway/precreate';
    public const PROD_QUERY_ORDER_URL = 'https://api.kbzpay.com/payment/gateway/queryorder';

    /**
     * 退款(mTLS,独立端口:UAT 18008 / Prod 8008,方案 §1)
     * 路径按下单 URL 规律推断 —— 官方 SDK 只从配置读 URL、未内置,文档站未能在线核实,联调时校准。
     */
    public const UAT_REFUND_URL = 'https://api-uat.kbzpay.com:18008/payment/gateway/uat/refund';
    public const PROD_REFUND_URL = 'https://api.kbzpay.com:8008/payment/gateway/refund';

    public const CONNECT_TIMEOUT = 3;
    public const TOTAL_TIMEOUT = 5;

    public function __construct(protected KbzAccountConfig $config)
    {
    }

    // ------------------------------------------------------------------ 对外接口

    /**
     * 预下单(MMQR 出码),version 1.0,trade_type=PAY_BY_QRCODE
     *
     * @param array<string, mixed> $params merch_order_id, total_amount, trans_currency(默认 MMK),
     *                                     timeout_express, callback_info, notify_url, title(可选)
     * @return array<string, mixed> 验签通过的 Response 平铺数组(含 prepay_id / qrCode)
     */
    public function precreate(array $params): array
    {
        $biz = self::buildPrecreateBiz($this->config, $params);
        $request = self::buildRequest(self::METHOD_PRECREATE, $biz, $this->config->appKey, self::VERSION_1_0, (string) ($params['notify_url'] ?? ''));
        return $this->send(self::urlFor($this->config->env, 'precreate'), $request, false);
    }

    /** 查单,version 3.0 */
    public function queryOrder(string $merchOrderId): array
    {
        $biz = self::buildQueryBiz($this->config, $merchOrderId);
        $request = self::buildRequest(self::METHOD_QUERY_ORDER, $biz, $this->config->appKey, self::VERSION_3_0);
        return $this->send(self::urlFor($this->config->env, 'queryorder'), $request, false);
    }

    /**
     * 退款,version 1.0,mTLS
     *
     * @param array<string, mixed> $params refund_request_no, merch_order_id, refund_reason,
     *                                     refund_amount(可选,部分退), is_last_refund(可选,仅 'Y')
     */
    public function refund(array $params): array
    {
        if (! $this->config->hasRefundCert()) {
            throw new KbzPayException(KbzPayException::KIND_CONFIG, 'KBZPay 退款需要双向证书,账户未配置证书或私钥');
        }
        $biz = self::buildRefundBiz($this->config, $params);
        $request = self::buildRequest(self::METHOD_REFUND, $biz, $this->config->appKey, self::VERSION_1_0);
        return $this->send(self::urlFor($this->config->env, 'refund'), $request, true);
    }

    /** 透传给 KbzPayException::isOrderNotFound,方便调用方只依赖 Client */
    public static function isOrderNotFound(string $kbzCode): bool
    {
        return KbzPayException::isOrderNotFound($kbzCode);
    }

    /**
     * 解析并验签异步通知
     *
     * 报文 `{"Request":{appid,notify_time,merch_code,merch_order_id,mm_order_id,total_amount,...,sign,sign_type}}`。
     * 只做取 Request + 平铺 + 验签;金额比对、幂等由调用方(阶段 4 回调)负责。
     * 回包为纯文本 `success`,由调用方输出。
     *
     * @return array<string, mixed>
     */
    public static function parseNotify(string $rawBody, string $appKey): array
    {
        $json = json_decode($rawBody, true);
        if (! is_array($json) || ! isset($json['Request']) || ! is_array($json['Request'])) {
            throw new KbzPayException(KbzPayException::KIND_PROTOCOL, 'KBZPay 通知报文无法解析(缺少 Request)');
        }
        $flat = KbzSigner::flatten($json['Request']);
        if (! KbzSigner::verify($flat, $appKey)) {
            throw new KbzPayException(KbzPayException::KIND_SIGN, 'KBZPay 通知验签失败');
        }
        return $flat;
    }

    // ------------------------------------------------------------------ 纯函数:URL / 报文

    /** @param string $api precreate | queryorder | refund */
    public static function urlFor(string $env, string $api): string
    {
        $prod = $env === KbzAccountConfig::ENV_PROD;
        return match ($api) {
            'precreate' => $prod ? self::PROD_PRECREATE_URL : self::UAT_PRECREATE_URL,
            'queryorder' => $prod ? self::PROD_QUERY_ORDER_URL : self::UAT_QUERY_ORDER_URL,
            'refund' => $prod ? self::PROD_REFUND_URL : self::UAT_REFUND_URL,
            default => throw new \InvalidArgumentException('未知的 KBZPay 接口:' . $api),
        };
    }

    /**
     * 组装带签名的完整请求体 `['Request' => [...]]`
     *
     * timestamp / nonce 可注入以便固定向量测试;缺省取当前秒级时间戳与 32 位随机串。
     *
     * @param array<string, mixed> $bizContent
     * @return array{Request: array<string, mixed>}
     */
    public static function buildRequest(
        string $method,
        array $bizContent,
        string $appKey,
        string $version = self::VERSION_1_0,
        string $notifyUrl = '',
        ?string $timestamp = null,
        ?string $nonce = null,
    ): array {
        $outer = [
            'timestamp' => $timestamp ?? (string) time(),
        ];
        if ($notifyUrl !== '') {
            $outer['notify_url'] = $notifyUrl;
        }
        $outer['method'] = $method;
        $outer['nonce_str'] = $nonce ?? bin2hex(random_bytes(16));
        $outer['version'] = $version;
        $outer['sign_type'] = KbzSigner::SIGN_TYPE;

        $outer['sign'] = KbzSigner::sign(array_merge($outer, $bizContent), $appKey);
        $outer['biz_content'] = $bizContent;

        return ['Request' => $outer];
    }

    /**
     * 预下单 biz_content
     *
     * @param array<string, mixed> $params
     * @return array<string, string>
     */
    public static function buildPrecreateBiz(KbzAccountConfig $config, array $params): array
    {
        $biz = self::baseBiz($config, self::requireOrderId($params['merch_order_id'] ?? ''));
        $biz['trade_type'] = self::TRADE_TYPE_QRCODE;
        $biz['total_amount'] = self::normalizeAmount($params['total_amount'] ?? null, 'total_amount');
        $biz['trans_currency'] = strtoupper(trim((string) ($params['trans_currency'] ?? ''))) ?: 'MMK';

        $timeout = trim((string) ($params['timeout_express'] ?? ''));
        if ($timeout !== '') {
            if (preg_match('/^(\d{1,3})m$/', $timeout, $m) !== 1 || (int) $m[1] < 1 || (int) $m[1] > 120) {
                throw new \InvalidArgumentException('timeout_express 取值 1m–120m');
            }
            $biz['timeout_express'] = $timeout;
        }

        $title = trim((string) ($params['title'] ?? ''));
        if ($title !== '') {
            $biz['title'] = $title;
        }

        $callback = (string) ($params['callback_info'] ?? '');
        if ($callback !== '') {
            // 文档要求 URL 编码后 ≤512;这里统一编码,调用方传原文即可,通知回传的是编码后的值
            $encoded = rawurlencode($callback);
            if (strlen($encoded) > 512) {
                throw new \InvalidArgumentException('callback_info 编码后超过 512 字节');
            }
            $biz['callback_info'] = $encoded;
        }

        $notify = trim((string) ($params['notify_url'] ?? ''));
        if ($notify !== '' && str_contains($notify, '?')) {
            throw new \InvalidArgumentException('notify_url 不能带 query 参数');
        }

        return self::withSubMerchant($config, $biz);
    }

    /** @return array<string, string> */
    public static function buildQueryBiz(KbzAccountConfig $config, string $merchOrderId): array
    {
        return self::withSubMerchant($config, self::baseBiz($config, self::requireOrderId($merchOrderId)));
    }

    /**
     * @param array<string, mixed> $params
     * @return array<string, string>
     */
    public static function buildRefundBiz(KbzAccountConfig $config, array $params): array
    {
        $biz = self::baseBiz($config, self::requireOrderId($params['merch_order_id'] ?? ''));

        $no = trim((string) ($params['refund_request_no'] ?? ''));
        if (preg_match('/^[A-Za-z0-9_]{1,32}$/', $no) !== 1) {
            throw new \InvalidArgumentException('refund_request_no 仅允许字母数字下划线且不超过 32 位');
        }
        $biz['refund_request_no'] = $no;

        $reason = trim((string) ($params['refund_reason'] ?? ''));
        if ($reason === '') {
            throw new \InvalidArgumentException('refund_reason 不能为空');
        }
        $biz['refund_reason'] = $reason;

        if (isset($params['refund_amount']) && $params['refund_amount'] !== '') {
            $biz['refund_amount'] = self::normalizeAmount($params['refund_amount'], 'refund_amount');
        }

        $last = strtoupper(trim((string) ($params['is_last_refund'] ?? '')));
        if ($last !== '') {
            if ($last !== 'Y') {
                throw new \InvalidArgumentException('is_last_refund 只能为 Y');
            }
            $biz['is_last_refund'] = 'Y';
        }

        return self::withSubMerchant($config, $biz);
    }

    // ------------------------------------------------------------------ 纯函数:响应解析

    /**
     * 解析网关响应:取 Response、平铺;result != SUCCESS 抛业务/签名异常;SUCCESS 时必须验签
     *
     * 失败响应不验签:KBZ 对签名错误等失败未必回签名,且失败不会触发任何资金动作。
     *
     * @return array<string, mixed>
     */
    public static function parseResponse(string $body, string $appKey): array
    {
        $json = json_decode($body, true);
        if (! is_array($json) || ! isset($json['Response']) || ! is_array($json['Response'])) {
            throw new KbzPayException(
                KbzPayException::KIND_PROTOCOL,
                sprintf('KBZPay 响应无法解析(长度 %d,缺少 Response)', strlen($body))
            );
        }
        $flat = KbzSigner::flatten($json['Response']);

        $result = strtoupper((string) ($flat['result'] ?? ''));
        if ($result !== self::RESULT_SUCCESS) {
            throw KbzPayException::fromKbzFailure((string) ($flat['code'] ?? ''), (string) ($flat['msg'] ?? ''));
        }
        if (! KbzSigner::verify($flat, $appKey)) {
            throw new KbzPayException(KbzPayException::KIND_SIGN, 'KBZPay 响应验签失败');
        }
        return $flat;
    }

    // ------------------------------------------------------------------ 网络

    /**
     * 发送并解析
     *
     * @param array{Request: array<string, mixed>} $request
     * @return array<string, mixed>
     */
    protected function send(string $url, array $request, bool $mtls): array
    {
        $json = json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new KbzPayException(KbzPayException::KIND_PROTOCOL, 'KBZPay 请求报文 JSON 编码失败');
        }
        return self::parseResponse($this->httpPost($url, $json, $mtls), $this->config->appKey);
    }

    /**
     * POST JSON,返回响应体;网络失败抛 KIND_NETWORK
     *
     * mTLS 时把 PEM 写成 0600 临时文件,finally 里删除(curl 只接受文件路径)。
     */
    protected function httpPost(string $url, string $json, bool $mtls): string
    {
        $tmpFiles = [];
        $ch = curl_init($url);
        if ($ch === false) {
            throw new KbzPayException(KbzPayException::KIND_NETWORK, 'KBZPay curl 初始化失败');
        }
        try {
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $json,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
                CURLOPT_TIMEOUT => self::TOTAL_TIMEOUT,
                CURLOPT_FOLLOWLOCATION => false,
            ]);
            if ($mtls) {
                $cfg = $this->config;
                $tmpFiles[] = $cert = self::writeTempPem($cfg->certPem);
                $tmpFiles[] = $key = self::writeTempPem($cfg->keyPem);
                curl_setopt_array($ch, [
                    CURLOPT_SSLCERTTYPE => 'PEM',
                    CURLOPT_SSLCERT => $cert,
                    CURLOPT_SSLKEYTYPE => 'PEM',
                    CURLOPT_SSLKEY => $key,
                ]);
                if ($cfg->keyPwd !== '') {
                    curl_setopt($ch, CURLOPT_KEYPASSWD, $cfg->keyPwd);
                }
                if (trim($cfg->caPem) !== '') {
                    $tmpFiles[] = $ca = self::writeTempPem($cfg->caPem);
                    curl_setopt($ch, CURLOPT_CAINFO, $ca);
                }
            }

            $body = curl_exec($ch);
            $errno = curl_errno($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($body === false || $errno !== 0) {
                // curl_error 文本可能含本地证书路径,只记 errno
                throw new KbzPayException(KbzPayException::KIND_NETWORK, sprintf('KBZPay 网络请求失败(curl errno %d)', $errno));
            }
            if ($body === '' || $body === true) {
                throw new KbzPayException(KbzPayException::KIND_NETWORK, sprintf('KBZPay 无响应体(HTTP %d)', $status));
            }
            return (string) $body;
        } finally {
            curl_close($ch);
            foreach ($tmpFiles as $file) {
                if (is_file($file)) {
                    @unlink($file);
                }
            }
        }
    }

    // ------------------------------------------------------------------ 内部

    /** @return array<string, string> */
    private static function baseBiz(KbzAccountConfig $config, string $merchOrderId): array
    {
        return [
            'appid' => $config->appId,
            'merch_code' => $config->merchCode,
            'merch_order_id' => $merchOrderId,
        ];
    }

    /**
     * 服务商模式附带子商户字段
     *
     * 方案 §1 只明确 precreate 需要;查单 / 退款是否必须带未能核实,统一附带(参与签名,对方按收到的字段验签)。
     *
     * @param array<string, string> $biz
     * @return array<string, string>
     */
    private static function withSubMerchant(KbzAccountConfig $config, array $biz): array
    {
        if ($config->isServiceProvider()) {
            $biz['sub_merch_code'] = $config->subMerchCode;
            if ($config->subAppId !== '') {
                $biz['sub_appid'] = $config->subAppId;
            }
        }
        return $biz;
    }

    private static function requireOrderId(mixed $id): string
    {
        $id = trim((string) $id);
        if (preg_match('/^[A-Za-z0-9_]{1,40}$/', $id) !== 1) {
            throw new \InvalidArgumentException('merch_order_id 仅允许字母数字下划线且不超过 40 位');
        }
        return $id;
    }

    /** 金额规范为字符串:>0,最多 2 位小数,去掉无意义的尾零(5000.00 → 5000) */
    private static function normalizeAmount(mixed $amount, string $field): string
    {
        if (is_int($amount)) {
            $str = (string) $amount;
        } elseif (is_float($amount)) {
            $str = number_format($amount, 2, '.', '');
        } elseif (is_string($amount)) {
            $str = trim($amount);
        } else {
            throw new \InvalidArgumentException($field . ' 不能为空');
        }
        if (preg_match('/^\d+(\.\d{1,2})?$/', $str) !== 1) {
            throw new \InvalidArgumentException($field . ' 须为不超过 2 位小数的正数');
        }
        if (str_contains($str, '.')) {
            $str = rtrim(rtrim($str, '0'), '.');
        }
        $str = ltrim($str, '0');
        if ($str === '' || str_starts_with($str, '.')) {
            $str = '0' . $str;
        }
        if ((float) $str <= 0) {
            throw new \InvalidArgumentException($field . ' 必须大于 0');
        }
        return $str;
    }

    private static function writeTempPem(string $pem): string
    {
        $file = tempnam(sys_get_temp_dir(), 'kbz');
        if ($file === false) {
            throw new KbzPayException(KbzPayException::KIND_CONFIG, 'KBZPay 无法创建证书临时文件');
        }
        @chmod($file, 0600);
        if (file_put_contents($file, $pem) === false) {
            @unlink($file);
            throw new KbzPayException(KbzPayException::KIND_CONFIG, 'KBZPay 无法写入证书临时文件');
        }
        return $file;
    }
}
