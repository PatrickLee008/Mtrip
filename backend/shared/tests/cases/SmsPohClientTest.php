<?php

declare(strict_types=1);

/**
 * SmsPohClient 单测:URL 构造 / 响应解析 / 状态码提取
 *
 * 覆盖思路:纯函数直接断言;requestOtp / verifyOtp 用覆写 httpPost 的子类跑,
 * 不联网也能覆盖「成功 / 401 凭证错 / 400 码错 / 连不上」四条分支。
 */

use Mtrip\Shared\Support\SmsPohClient;

/** 测试替身:把 httpPost 换成预置的 [状态码, 响应体],并记录请求过的 URL */
final class FakeSmsPohClient extends SmsPohClient
{
    /** @var array<int, string> */
    public array $calledUrls = [];

    /** @param array{0:int,1:string} $canned */
    public function __construct(
        private array $canned,
        string $apiKey = 'KEY',
        string $apiSecret = 'SECRET',
        string $countryCode = '',
    ) {
        parent::__construct($apiKey, $apiSecret, $countryCode);
    }

    /** 供 SmsVerifyService 单测复用同一实例时灌入渠道国家码 */
    public function useCountryCode(string $countryCode): void
    {
        $this->countryCode = $countryCode;
    }

    protected function httpPost(string $url): array
    {
        $this->calledUrls[] = $url;
        return $this->canned;
    }
}

MiniTest::add('SmsPoh:accessToken 为 base64(key:secret)', static function (): void {
    MiniTest::assertSame(
        base64_encode('SMSPohV3APIKey:SMSPohV3APISecret'),
        SmsPohClient::accessToken('SMSPohV3APIKey', 'SMSPohV3APISecret'),
        '与服务商文档示例一致'
    );
});

MiniTest::add('SmsPoh:未配国家码时只去分隔符,不猜前缀', static function (): void {
    MiniTest::assertSame('09771234567', SmsPohClient::normalizeMobile(' 09 77-123 4567 '), '空格与横杠应被清掉');
    MiniTest::assertSame('+959771234567', SmsPohClient::normalizeMobile('+95 (9) 771234567'), '括号应被清掉,+ 保留');
    MiniTest::assertSame('+959771234567', SmsPohClient::normalizeMobile('0095 9771234567'), '00 前缀应换成 +');
    MiniTest::assertSame('9971183240', SmsPohClient::normalizeMobile('9971183240'), '没给国家码就不补(不猜)');
});

MiniTest::add('SmsPoh:配了国家码后本地号补成 E.164', static function (): void {
    /*
     * 这条是线上真踩过的坑:App 登录/注册页把「+95」画成静态标签却从不拼进请求,
     * 用户按占位符 `9xxxxxxxx` 输入的 `9971183240` 以 99 开头 ——
     * SMSPoh 只认 09xxxxxxxx / 959xxxxxxx / +959xxxxxx 三种前缀,直接发过去必被拒。
     */
    MiniTest::assertSame('+959971183240', SmsPohClient::normalizeMobile('9971183240', '95'), '裸本地号应补国家码');
    MiniTest::assertSame('+959971183240', SmsPohClient::normalizeMobile('09971183240', '95'), '0 冠码应去掉再补');
    MiniTest::assertSame('+959971183240', SmsPohClient::normalizeMobile('959971183240', '95'), '已带国家码只补 +');
    MiniTest::assertSame('+959971183240', SmsPohClient::normalizeMobile('+959971183240', '95'), '已是 E.164 原样用');
    MiniTest::assertSame('+959971183240', SmsPohClient::normalizeMobile('00959971183240', '95'), '00 冠码换 +');
    MiniTest::assertSame('+959971183240', SmsPohClient::normalizeMobile('+95 (99) 7118-3240', '95'), '带分隔符也要能归一');
    // 国家码填成 +95 / 0095 都当 95
    MiniTest::assertSame('+959971183240', SmsPohClient::normalizeMobile('9971183240', '+95'), '国家码带 + 也认');
});

MiniTest::add('SmsPoh:以国家码开头的本地号不被误判(长度消歧)', static function (): void {
    /*
     * 缅甸本地号 `95xxxxxxxx`(10 位)本身就以 95 开头,只看前缀会被当成"已带国家码"而少发 2 位;
     * 带国家码的 `959971183240` 是 12 位。用「总长 ≥ 国家码长+9」把两者分开。
     */
    MiniTest::assertSame('+959512345678', SmsPohClient::normalizeMobile('9512345678', '95'), '10 位应判本地号,补国家码');
    MiniTest::assertSame('+959512345678', SmsPohClient::normalizeMobile('959512345678', '95'), '12 位应判已带国家码');
});

MiniTest::add('SmsPoh:发码 URL 的 to 已按渠道国家码补全', static function (): void {
    $client = new SmsPohClient('KEY', 'SECRET', '95');
    parse_str((string) parse_url($client->buildRequestUrl('9971183240', 'MTrip', 'mTrip'), PHP_URL_QUERY), $q);
    MiniTest::assertSame('+959971183240', $q['to'] ?? '', '出网的 to 必须是 E.164');
});

MiniTest::add('SmsPoh:发码 URL 参数齐全且已转义', static function (): void {
    $client = new SmsPohClient('KEY', 'SECRET');
    $url = $client->buildRequestUrl('09 771234567', 'MTrip', 'mTrip Travel', ['ttl' => 300, 'pinLength' => 6]);

    MiniTest::assertTrue(str_starts_with($url, SmsPohClient::BASE_URL . '/request?'), '应打在 /request 上');
    parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
    MiniTest::assertSame(base64_encode('KEY:SECRET'), $q['accessToken'] ?? '', 'accessToken 应可被正确解回');
    MiniTest::assertSame('09771234567', $q['to'] ?? '', 'to 应为归一后的号码');
    MiniTest::assertSame('MTrip', $q['from'] ?? '', 'from = Sender ID');
    MiniTest::assertSame('mTrip Travel', $q['brand'] ?? '', 'brand 带空格也要能原样解回');
    MiniTest::assertSame('300', $q['ttl'] ?? '', 'ttl 透传');
    MiniTest::assertSame('6', $q['pinLength'] ?? '', 'pinLength 透传');
});

MiniTest::add('SmsPoh:accessToken 里的 + / = 必须被转义', static function (): void {
    /*
     * base64 会产出 `+` `/` `=`,直接拼进 query 的话 `+` 会被服务端解成空格,
     * 凭证随即失效 —— 这是最容易踩且最难查的一个坑,单独锁一条用例。
     */
    $client = new SmsPohClient("k\xFB\xFF", "s\xFE\xEF");
    $token = SmsPohClient::accessToken("k\xFB\xFF", "s\xFE\xEF");
    MiniTest::assertTrue(str_contains($token, '+') || str_contains($token, '/'), '构造的密钥应产出含特殊字符的 base64');

    $url = $client->buildVerifyUrl('123456789', '1234');
    MiniTest::assertTrue(! str_contains(explode('?', $url)[1], '+'), 'query 里不应出现裸 +');
    parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
    MiniTest::assertSame($token, $q['accessToken'] ?? '', '转义后仍应解回原 token');
});

MiniTest::add('SmsPoh:验码 URL 带 requestId 与 code', static function (): void {
    $url = (new SmsPohClient('KEY', 'SECRET'))->buildVerifyUrl('123456789', '4321');
    MiniTest::assertTrue(str_starts_with($url, SmsPohClient::BASE_URL . '/verify?'), '应打在 /verify 上');
    parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
    MiniTest::assertSame('123456789', $q['requestId'] ?? '');
    MiniTest::assertSame('4321', $q['code'] ?? '');
});

MiniTest::add('SmsPoh:发码成功解析出 requestId 与 expireAt', static function (): void {
    // 服务商文档给的成功体(状态码是 201,不是 200)
    $body = '{"channel":"SMS","requestId":123456789,"to":"09********","createdAt":"2025-01-22 12:02:07","expireAt":"2025-01-22 12:03:07"}';
    $result = SmsPohClient::parseRequestResponse(201, $body);
    MiniTest::assertTrue($result['ok'], '201 应判成功');
    MiniTest::assertSame('123456789', $result['requestId'], 'requestId 按字符串保存');
    MiniTest::assertSame('2025-01-22 12:03:07', $result['expireAt']);
});

MiniTest::add('SmsPoh:2xx 但没有 requestId 视为失败', static function (): void {
    // 没有 requestId 就无从验码,不能当成功放过去
    $result = SmsPohClient::parseRequestResponse(200, '{"channel":"SMS"}');
    MiniTest::assertSame(false, $result['ok'], '缺 requestId 应判失败');
    MiniTest::assertSame('', $result['requestId']);
});

MiniTest::add('SmsPoh:401 凭证错误带回服务商文案', static function (): void {
    $body = '{"name":"Unauthorized","message":"Your request was made with invalid credentials.","code":0,"status":401}';
    $result = SmsPohClient::parseRequestResponse(401, $body);
    MiniTest::assertSame(false, $result['ok']);
    MiniTest::assertSame(401, $result['status'], '状态码要透出,调用方据此区分"我方凭证错"与"码错"');
    MiniTest::assertSame('Your request was made with invalid credentials.', $result['message']);
});

MiniTest::add('SmsPoh:响应体不是 JSON 时回退截断原文', static function (): void {
    $result = SmsPohClient::parseVerifyResponse(502, '<html>Bad Gateway</html>');
    MiniTest::assertSame(false, $result['ok']);
    MiniTest::assertSame('<html>Bad Gateway</html>', $result['message'], '非 JSON 也要留下可查的线索');
});

MiniTest::add('SmsPoh:验码 2xx 判通过、4xx 判不通过', static function (): void {
    $ok = SmsPohClient::parseVerifyResponse(201, '{"request_id":123456789,"to":"09*******","verifiedAt":"2025-01-22 12:23:54"}');
    MiniTest::assertTrue($ok['ok'], '201 应判验证通过');

    $bad = SmsPohClient::parseVerifyResponse(400, '{"name":"Bad Request","message":"Invalid request!.","code":0,"status":400}');
    MiniTest::assertSame(false, $bad['ok'], '400 应判验证失败');
    MiniTest::assertSame(400, $bad['status']);
});

MiniTest::add('SmsPoh:状态码取最后一个 HTTP 行(重定向场景)', static function (): void {
    MiniTest::assertSame(200, SmsPohClient::statusFromHeaders([
        'HTTP/1.1 301 Moved Permanently',
        'Location: https://v3.smspoh.com/api/otp/request',
        'HTTP/1.1 200 OK',
        'Content-Type: application/json',
    ]), '有重定向时取最终状态,取第一行会拿到 301');
    MiniTest::assertSame(0, SmsPohClient::statusFromHeaders([]), '没有响应头时按 0(未拿到 HTTP 响应)');
});

MiniTest::add('SmsPoh:requestOtp 打到 /request 并透传可选参数', static function (): void {
    $client = new FakeSmsPohClient([201, '{"requestId":987654321,"expireAt":"2025-01-22 12:03:07"}']);
    $result = $client->requestOtp('09771234567', 'MTrip', 'mTrip', ['ttl' => 600, 'maxInvalidAttempts' => 5]);

    MiniTest::assertTrue($result['ok']);
    MiniTest::assertSame('987654321', $result['requestId']);
    parse_str((string) parse_url($client->calledUrls[0], PHP_URL_QUERY), $q);
    MiniTest::assertSame('600', $q['ttl'] ?? '');
    MiniTest::assertSame('5', $q['maxInvalidAttempts'] ?? '');
});

MiniTest::add('SmsPoh:连不上服务商时状态码为 0', static function (): void {
    // httpPost 拿不到响应会返回 [0, ''];调用方要能区分"服务商拒绝"与"根本没连上"
    $client = new FakeSmsPohClient([0, '']);
    $result = $client->verifyOtp('123456789', '1234');
    MiniTest::assertSame(false, $result['ok']);
    MiniTest::assertSame(0, $result['status']);
    MiniTest::assertSame('短信服务商无响应', $result['message']);
});
