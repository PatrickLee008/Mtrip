<?php

declare(strict_types=1);

/**
 * KBZPay MMQR 协议库单测:签名固定向量 / 过滤规则 / 验签 / 通知解析 / 失败响应 / 服务商字段
 *
 * 固定向量来源:KBZ 文档站(wap.kbzpay.com/pgw)本机无法访问,官方 SDK 附带的 docx 只有安装说明、
 * 不含签名示例。因此按 SDK `PaymentUtils::joinKeyValue + signature` 的算法、以文档字段风格
 * 自行构造了一组 OrderInfo 报文;期望签名串由人工排序得出,SHA256 用 .NET
 * `System.Security.Cryptography.SHA256` 独立计算(不经本库),避免自证。
 */

use Mtrip\Shared\Pay\KbzPay\KbzAccountConfig;
use Mtrip\Shared\Pay\KbzPay\KbzPayClient;
use Mtrip\Shared\Pay\KbzPay\KbzPayException;
use Mtrip\Shared\Pay\KbzPay\KbzSigner;

const KBZ_TEST_APP_KEY = '192006250b4c09247ec02edce69f6a2d';

/** 测试替身:httpPost 返回预置响应体,并记录请求 */
final class FakeKbzPayClient extends KbzPayClient
{
    /** @var array<int, array{url:string, json:string, mtls:bool}> */
    public array $calls = [];

    /** @var callable(array):string|null 可按请求动态生成响应 */
    public $responder = null;

    public function __construct(KbzAccountConfig $config, public string $canned = '')
    {
        parent::__construct($config);
    }

    protected function httpPost(string $url, string $json, bool $mtls): string
    {
        $this->calls[] = ['url' => $url, 'json' => $json, 'mtls' => $mtls];
        if ($this->responder !== null) {
            return ($this->responder)(json_decode($json, true));
        }
        return $this->canned;
    }
}

/** 构造一份由 $appKey 正确签名的 Response 报文 */
function kbzSignedResponse(array $fields, string $appKey = KBZ_TEST_APP_KEY): string
{
    $fields['sign_type'] = 'SHA256';
    $fields['sign'] = KbzSigner::sign($fields, $appKey);
    return json_encode(['Response' => $fields]);
}

function kbzDirectConfig(): KbzAccountConfig
{
    return new KbzAccountConfig('uat', 'kp_app_001', '200001', KBZ_TEST_APP_KEY);
}

function kbzSpConfig(): KbzAccountConfig
{
    return new KbzAccountConfig('prod', 'kp_sp_app', '300001', KBZ_TEST_APP_KEY, '300001_SUB9', 'kp_sub_app_9');
}

// ------------------------------------------------------------------ 1. 固定向量

MiniTest::add('KBZ 签名:OrderInfo 固定向量(签名串与 SHA256 大写)', static function (): void {
    $flat = [
        'timestamp' => '1535166225',
        'notify_url' => 'http://test.payment.com/notify',
        'method' => 'kbz.payment.precreate',
        'nonce_str' => '5K8264ILTKCH16CQ2502SI8ZNMTM67VS',
        'sign_type' => 'SHA256',
        'version' => '1.0',
        'appid' => 'kp1234567890987654321aabbccddeef',
        'merch_code' => '200001',
        'merch_order_id' => '201811212009001',
        'trade_type' => 'PAY_BY_QRCODE',
        'title' => 'iPhoneX',
        'total_amount' => '5000',
        'trans_currency' => 'MMK',
        'timeout_express' => '100m',
        'callback_info' => 'title%3diphonex',
    ];
    MiniTest::assertSame(
        'appid=kp1234567890987654321aabbccddeef&callback_info=title%3diphonex&merch_code=200001'
        . '&merch_order_id=201811212009001&method=kbz.payment.precreate&nonce_str=5K8264ILTKCH16CQ2502SI8ZNMTM67VS'
        . '&notify_url=http://test.payment.com/notify&timeout_express=100m&timestamp=1535166225&title=iPhoneX'
        . '&total_amount=5000&trade_type=PAY_BY_QRCODE&trans_currency=MMK&version=1.0',
        KbzSigner::canonicalize($flat),
        '待签名串'
    );
    MiniTest::assertSame(
        'CA86B008B64011B9C41019683F6D2537CD7895EAB22D84AE409DD6DF6EAB62B2',
        KbzSigner::sign($flat, KBZ_TEST_APP_KEY),
        '签名'
    );
});

MiniTest::add('KBZ 签名:buildRequest 外层+biz_content 平铺后与固定向量一致', static function (): void {
    $biz = [
        'appid' => 'kp1234567890987654321aabbccddeef',
        'merch_code' => '200001',
        'merch_order_id' => '201811212009001',
        'trade_type' => 'PAY_BY_QRCODE',
        'title' => 'iPhoneX',
        'total_amount' => '5000',
        'trans_currency' => 'MMK',
        'timeout_express' => '100m',
        'callback_info' => 'title%3diphonex',
    ];
    $req = KbzPayClient::buildRequest(
        KbzPayClient::METHOD_PRECREATE,
        $biz,
        KBZ_TEST_APP_KEY,
        '1.0',
        'http://test.payment.com/notify',
        '1535166225',
        '5K8264ILTKCH16CQ2502SI8ZNMTM67VS'
    );
    MiniTest::assertSame('CA86B008B64011B9C41019683F6D2537CD7895EAB22D84AE409DD6DF6EAB62B2', $req['Request']['sign']);
    MiniTest::assertSame('SHA256', $req['Request']['sign_type']);
    MiniTest::assertSame($biz, $req['Request']['biz_content'], 'biz_content 原样嵌套');
    MiniTest::assertTrue(! isset($req['Request']['appid']), 'appid 只在 biz_content 内');
});

// ------------------------------------------------------------------ 2. 过滤规则

MiniTest::add('KBZ 签名:空值剔除、"0" 保留、数组不参与、sign/sign_type 排除', static function (): void {
    $flat = [
        'b' => '0',
        'a' => 'x',
        'empty' => '',
        'blank' => '  ',
        'nil' => null,
        'refund_info' => [['refund_request_no' => 'R1']],
        'obj' => new stdClass(),
        'sign' => 'WHATEVER',
        'sign_type' => 'SHA256',
        'n' => 0,
    ];
    MiniTest::assertSame('a=x&b=0&n=0', KbzSigner::canonicalize($flat));
    MiniTest::assertSame('a=x&b=0&n=0&key=K', KbzSigner::buildSignString($flat, 'K'));
    MiniTest::assertSame(
        strtoupper(hash('sha256', 'a=x&b=0&n=0&key=K')),
        KbzSigner::sign($flat, 'K')
    );
});

MiniTest::add('KBZ 签名:key 大小写敏感且按 ASCII 排序(大写在前)', static function (): void {
    MiniTest::assertSame('B=2&Z=3&a=1&b=4', KbzSigner::canonicalize(['b' => '4', 'a' => '1', 'Z' => '3', 'B' => '2']));
    MiniTest::assertTrue(
        KbzSigner::sign(['Amount' => '1'], 'K') !== KbzSigner::sign(['amount' => '1'], 'K'),
        '仅 key 大小写不同,签名应不同'
    );
});

MiniTest::add('KBZ 签名:flatten 展开 biz_content(数组与 JSON 字符串)', static function (): void {
    MiniTest::assertSame(['x' => '1', 'y' => '2'], KbzSigner::flatten(['x' => '1', 'biz_content' => ['y' => '2']]));
    MiniTest::assertSame(['x' => '1', 'y' => '2'], KbzSigner::flatten(['x' => '1', 'biz_content' => '{"y":"2"}']));
});

// ------------------------------------------------------------------ 3. 验签

MiniTest::add('KBZ 验签:篡改金额后失败,原文通过,错 key 失败', static function (): void {
    $flat = ['merch_order_id' => 'P1', 'total_amount' => '5000', 'trade_status' => 'PAY_SUCCESS'];
    $flat['sign'] = KbzSigner::sign($flat, KBZ_TEST_APP_KEY);
    MiniTest::assertTrue(KbzSigner::verify($flat, KBZ_TEST_APP_KEY), '原文');
    MiniTest::assertTrue(KbzSigner::verify(['sign' => strtolower($flat['sign'])] + $flat, KBZ_TEST_APP_KEY), '小写签名容忍');

    $tampered = $flat;
    $tampered['total_amount'] = '50';
    MiniTest::assertTrue(! KbzSigner::verify($tampered, KBZ_TEST_APP_KEY), '篡改金额');
    MiniTest::assertTrue(! KbzSigner::verify($flat, 'WRONG'), '错 key');
    MiniTest::assertTrue(! KbzSigner::verify(['total_amount' => '1'], KBZ_TEST_APP_KEY), '缺 sign');
});

// ------------------------------------------------------------------ 4. 通知

MiniTest::add('KBZ 通知:取 Request 平铺验签,refund 等数组字段不影响', static function (): void {
    $req = [
        'appid' => 'kp_app_001',
        'notify_time' => '1700000000',
        'merch_code' => '200001',
        'merch_order_id' => 'P261027120000123456',
        'mm_order_id' => '01001234567',
        'total_amount' => '15000',
        'trans_currency' => 'MMK',
        'trade_status' => 'PAY_SUCCESS',
        'trans_end_time' => '1700000000',
        'callback_info' => 'biz%3Dorder',
        'nonce_str' => 'abc',
        'sign_type' => 'SHA256',
    ];
    $req['sign'] = KbzSigner::sign($req, KBZ_TEST_APP_KEY);
    $raw = json_encode(['Request' => $req]);

    $flat = KbzPayClient::parseNotify($raw, KBZ_TEST_APP_KEY);
    MiniTest::assertSame('PAY_SUCCESS', $flat['trade_status']);
    MiniTest::assertSame('15000', $flat['total_amount']);

    $bad = $req;
    $bad['total_amount'] = '1';
    try {
        KbzPayClient::parseNotify(json_encode(['Request' => $bad]), KBZ_TEST_APP_KEY);
        MiniTest::assertTrue(false, '篡改通知应抛异常');
    } catch (KbzPayException $e) {
        MiniTest::assertSame(KbzPayException::KIND_SIGN, $e->kind());
    }
    try {
        KbzPayClient::parseNotify('not json', KBZ_TEST_APP_KEY);
        MiniTest::assertTrue(false, '非 JSON 应抛异常');
    } catch (KbzPayException $e) {
        MiniTest::assertSame(KbzPayException::KIND_PROTOCOL, $e->kind());
    }
});

// ------------------------------------------------------------------ 5. 响应解析

MiniTest::add('KBZ 响应:成功且验签通过返回平铺数组;签名不对抛 sign', static function (): void {
    $ok = kbzSignedResponse(['result' => 'SUCCESS', 'code' => '0', 'msg' => 'success', 'nonce_str' => 'n', 'prepay_id' => 'PP1', 'merch_order_id' => 'P1', 'qrCode' => '000201...']);
    $flat = KbzPayClient::parseResponse($ok, KBZ_TEST_APP_KEY);
    MiniTest::assertSame('PP1', $flat['prepay_id']);
    MiniTest::assertSame('000201...', $flat['qrCode']);

    try {
        KbzPayClient::parseResponse($ok, 'OTHER_KEY');
        MiniTest::assertTrue(false, '应抛验签异常');
    } catch (KbzPayException $e) {
        MiniTest::assertSame(KbzPayException::KIND_SIGN, $e->kind());
        MiniTest::assertTrue(! str_contains($e->getMessage(), 'OTHER_KEY'), '消息不含 AppKey');
    }
});

MiniTest::add('KBZ 响应:失败报文抛 business,带 code/msg;签名类错误码归 sign', static function (): void {
    $fail = json_encode(['Response' => ['result' => 'FAIL', 'code' => 'QUERYORDER_FAIL', 'msg' => 'Order does not exist', 'nonce_str' => 'n']]);
    try {
        KbzPayClient::parseResponse($fail, KBZ_TEST_APP_KEY);
        MiniTest::assertTrue(false, '应抛业务异常');
    } catch (KbzPayException $e) {
        MiniTest::assertSame(KbzPayException::KIND_BUSINESS, $e->kind());
        MiniTest::assertSame('QUERYORDER_FAIL', $e->kbzCode());
        MiniTest::assertSame('Order does not exist', $e->kbzMsg());
        MiniTest::assertTrue(KbzPayException::isOrderNotFound($e->kbzCode()), '查单失败视为订单不存在');
        MiniTest::assertTrue(KbzPayClient::isOrderNotFound('ORDER_NOT_EXIST'));
        MiniTest::assertTrue(! KbzPayClient::isOrderNotFound('SYSTEM_ERROR'));
    }

    $signFail = json_encode(['Response' => ['result' => 'FAIL', 'code' => 'SIGN_ERROR', 'msg' => 'Invalid sign']]);
    try {
        KbzPayClient::parseResponse($signFail, KBZ_TEST_APP_KEY);
        MiniTest::assertTrue(false, '应抛签名异常');
    } catch (KbzPayException $e) {
        MiniTest::assertSame(KbzPayException::KIND_SIGN, $e->kind());
    }

    foreach (['<html>502</html>', '{"foo":1}', ''] as $body) {
        try {
            KbzPayClient::parseResponse($body, KBZ_TEST_APP_KEY);
            MiniTest::assertTrue(false, '应抛协议异常');
        } catch (KbzPayException $e) {
            MiniTest::assertSame(KbzPayException::KIND_PROTOCOL, $e->kind());
        }
    }
});

// ------------------------------------------------------------------ 6. 客户端(替换 httpPost)

MiniTest::add('KBZ precreate:服务商模式附带 sub_merch_code/sub_appid,notify_url 在外层,金额规范化', static function (): void {
    $client = new FakeKbzPayClient(kbzSpConfig(), kbzSignedResponse(['result' => 'SUCCESS', 'code' => '0', 'prepay_id' => 'PP', 'qrCode' => 'QR']));
    $res = $client->precreate([
        'merch_order_id' => 'P261027120000123456',
        'total_amount' => '15000.00',
        'timeout_express' => '30m',
        'callback_info' => 'biz=order&no=1',
        'notify_url' => 'https://pay.example.com/api/v1/payment/callback/kbz-mmqr',
    ]);
    MiniTest::assertSame('QR', $res['qrCode']);

    MiniTest::assertSame(1, count($client->calls));
    $call = $client->calls[0];
    MiniTest::assertSame(KbzPayClient::PROD_PRECREATE_URL, $call['url']);
    MiniTest::assertSame(false, $call['mtls']);

    $req = json_decode($call['json'], true)['Request'];
    $biz = $req['biz_content'];
    MiniTest::assertSame('kbz.payment.precreate', $req['method']);
    MiniTest::assertSame('1.0', $req['version']);
    MiniTest::assertSame('https://pay.example.com/api/v1/payment/callback/kbz-mmqr', $req['notify_url']);
    MiniTest::assertSame('300001_SUB9', $biz['sub_merch_code']);
    MiniTest::assertSame('kp_sub_app_9', $biz['sub_appid']);
    MiniTest::assertSame('kp_sp_app', $biz['appid']);
    MiniTest::assertSame('PAY_BY_QRCODE', $biz['trade_type']);
    MiniTest::assertSame('15000', $biz['total_amount']);
    MiniTest::assertSame('MMK', $biz['trans_currency']);
    MiniTest::assertSame(rawurlencode('biz=order&no=1'), $biz['callback_info']);
    MiniTest::assertTrue(KbzSigner::verify(KbzSigner::flatten($req), KBZ_TEST_APP_KEY), '请求签名覆盖子商户字段');
    MiniTest::assertTrue(! str_contains($call['json'], KBZ_TEST_APP_KEY), '请求体不含 AppKey');
});

MiniTest::add('KBZ precreate:直连模式不带子商户字段;非法参数拒绝', static function (): void {
    $client = new FakeKbzPayClient(kbzDirectConfig(), kbzSignedResponse(['result' => 'SUCCESS', 'qrCode' => 'QR']));
    $client->precreate(['merch_order_id' => 'P1', 'total_amount' => 100]);
    $biz = json_decode($client->calls[0]['json'], true)['Request']['biz_content'];
    MiniTest::assertTrue(! isset($biz['sub_merch_code']) && ! isset($biz['sub_appid']));
    MiniTest::assertSame(KbzPayClient::UAT_PRECREATE_URL, $client->calls[0]['url']);

    MiniTest::assertThrows(InvalidArgumentException::class, static fn () => $client->precreate(['merch_order_id' => 'P-1', 'total_amount' => '1']), null, '单号含 -');
    MiniTest::assertThrows(InvalidArgumentException::class, static fn () => $client->precreate(['merch_order_id' => 'P1', 'total_amount' => '1.234']), null, '3 位小数');
    MiniTest::assertThrows(InvalidArgumentException::class, static fn () => $client->precreate(['merch_order_id' => 'P1', 'total_amount' => '0']), null, '金额 0');
    MiniTest::assertThrows(InvalidArgumentException::class, static fn () => $client->precreate(['merch_order_id' => 'P1', 'total_amount' => '1', 'timeout_express' => '121m']), null, '超时上限');
    MiniTest::assertThrows(InvalidArgumentException::class, static fn () => $client->precreate(['merch_order_id' => 'P1', 'total_amount' => '1', 'notify_url' => 'https://a.com/n?x=1']), null, 'notify 带 query');
});

MiniTest::add('KBZ queryOrder:version 3.0;业务失败抛 business 且可判定订单不存在', static function (): void {
    $client = new FakeKbzPayClient(kbzDirectConfig(), json_encode(['Response' => ['result' => 'FAIL', 'code' => 'QUERYORDER_FAIL', 'msg' => 'order not exist']]));
    try {
        $client->queryOrder('PTEST' . '0001');
        MiniTest::assertTrue(false, '应抛异常');
    } catch (KbzPayException $e) {
        MiniTest::assertSame(KbzPayException::KIND_BUSINESS, $e->kind());
        MiniTest::assertTrue(KbzPayClient::isOrderNotFound($e->kbzCode()));
    }
    $req = json_decode($client->calls[0]['json'], true)['Request'];
    MiniTest::assertSame('3.0', $req['version']);
    MiniTest::assertSame('kbz.payment.queryorder', $req['method']);
    MiniTest::assertSame(KbzPayClient::UAT_QUERY_ORDER_URL, $client->calls[0]['url']);
    MiniTest::assertTrue(! isset($req['notify_url']));
});

MiniTest::add('KBZ refund:缺证书抛 config;有证书走 mTLS 并带 refund_amount/is_last_refund', static function (): void {
    $noCert = new FakeKbzPayClient(kbzDirectConfig());
    try {
        $noCert->refund(['refund_request_no' => 'R1', 'merch_order_id' => 'P1', 'refund_reason' => 'x']);
        MiniTest::assertTrue(false, '应抛 config');
    } catch (KbzPayException $e) {
        MiniTest::assertSame(KbzPayException::KIND_CONFIG, $e->kind());
    }
    MiniTest::assertSame(0, count($noCert->calls), '缺证书不发请求');

    $cfg = new KbzAccountConfig('uat', 'kp_app_001', '200001', KBZ_TEST_APP_KEY, '', '', "-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----", "-----BEGIN PRIVATE KEY-----\nY\n-----END PRIVATE KEY-----", 'pwd');
    $client = new FakeKbzPayClient($cfg, kbzSignedResponse(['result' => 'SUCCESS', 'refund_status' => 'REFUND_SUCCESS', 'refund_order_id' => 'RF1']));
    $res = $client->refund(['refund_request_no' => 'R261027001', 'merch_order_id' => 'P1', 'refund_reason' => 'cancel', 'refund_amount' => '2500', 'is_last_refund' => 'y']);
    MiniTest::assertSame('REFUND_SUCCESS', $res['refund_status']);
    MiniTest::assertSame(true, $client->calls[0]['mtls']);
    MiniTest::assertSame(KbzPayClient::UAT_REFUND_URL, $client->calls[0]['url']);
    $biz = json_decode($client->calls[0]['json'], true)['Request']['biz_content'];
    MiniTest::assertSame('2500', $biz['refund_amount']);
    MiniTest::assertSame('Y', $biz['is_last_refund']);
    MiniTest::assertSame('R261027001', $biz['refund_request_no']);
    MiniTest::assertTrue(! str_contains($client->calls[0]['json'], 'PRIVATE KEY'), '请求体不含证书');

    MiniTest::assertThrows(InvalidArgumentException::class, static fn () => $client->refund(['refund_request_no' => 'R1', 'merch_order_id' => 'P1', 'refund_reason' => 'x', 'is_last_refund' => 'N']));
});

MiniTest::add('KBZ 配置:env 只接受 uat/prod;服务商判定', static function (): void {
    MiniTest::assertThrows(InvalidArgumentException::class, static fn () => new KbzAccountConfig('test', 'a', 'm', 'k'));
    MiniTest::assertTrue(! kbzDirectConfig()->isServiceProvider());
    MiniTest::assertTrue(kbzSpConfig()->isServiceProvider());
});
