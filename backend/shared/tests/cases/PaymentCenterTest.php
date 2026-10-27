<?php

declare(strict_types=1);

/**
 * 支付中心内部通道单测:InternalAuthMiddleware(放行/拒绝判定 + process 链路)
 * 与 PaymentCenterClient(成功解包 / code≠0 透传 / 网络失败转换 / 请求头与路径)。
 */

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Middleware\InternalAuthMiddleware;
use Mtrip\Shared\Payment\PaymentCenterClient;

// ---------- PSR 接口桩(无 vendor 环境;与 ClientSignMiddlewareTest 同为空接口,谁先加载谁定义) ----------
if (! interface_exists(Psr\Http\Message\ServerRequestInterface::class)) {
    eval(<<<'PHP'
    namespace Psr\Http\Message {
        interface ServerRequestInterface {}
        interface ResponseInterface {}
    }
    namespace Psr\Http\Server {
        interface MiddlewareInterface {}
        interface RequestHandlerInterface {}
    }
    PHP);
}

final class InternalTestUri
{
    public function __construct(private string $path)
    {
    }

    public function getPath(): string
    {
        return $this->path;
    }
}

final class InternalTestRequest implements Psr\Http\Message\ServerRequestInterface
{
    public function __construct(private string $path, private array $headers = [], private string $ip = '172.18.0.5')
    {
    }

    public function getUri(): InternalTestUri
    {
        return new InternalTestUri($this->path);
    }

    public function getHeaderLine(string $name): string
    {
        return (string) ($this->headers[$name] ?? '');
    }

    public function getServerParams(): array
    {
        return ['remote_addr' => $this->ip];
    }
}

final class InternalTestResponse implements Psr\Http\Message\ResponseInterface
{
}

final class InternalTestHandler implements Psr\Http\Server\RequestHandlerInterface
{
    public int $calls = 0;

    public function handle(Psr\Http\Message\ServerRequestInterface $request): Psr\Http\Message\ResponseInterface
    {
        ++$this->calls;
        return new InternalTestResponse();
    }
}

/** 覆写 httpPost:记录请求并返回预置响应 */
final class FakePaymentCenterClient extends PaymentCenterClient
{
    public array $requests = [];

    public function __construct(private array $response, ?string $baseUrl = 'http://pay.test:9508/', ?string $token = 'tok-123')
    {
        parent::__construct($baseUrl, $token);
    }

    protected function httpPost(string $url, string $json, array $headers): array
    {
        $this->requests[] = ['url' => $url, 'json' => $json, 'headers' => $headers];
        return $this->response;
    }
}

// ---------- InternalAuthMiddleware:纯函数 ----------

MiniTest::add('InternalAuth:非 /internal/ 路径直接放行(无 token、公网 IP 也放行)', static function (): void {
    MiniTest::assertTrue(InternalAuthMiddleware::isAllowed('/api/v1/payment/callback/kbz-mmqr', '', '', '8.8.8.8'));
    MiniTest::assertTrue(InternalAuthMiddleware::isAllowed('/internalx/v1', '', 'secret', '8.8.8.8'), '前缀须含结尾斜杠');
});

MiniTest::add('InternalAuth:env token 为空时一律拒绝(fail-closed)', static function (): void {
    MiniTest::assertSame('not_configured', InternalAuthMiddleware::denyReason('/internal/v1/payment/create', '', '', '10.0.0.2'));
    MiniTest::assertSame('not_configured', InternalAuthMiddleware::denyReason('/internal/v1/payment/create', 'any', '', '10.0.0.2'));
});

MiniTest::add('InternalAuth:缺 token / 错 token 拒绝', static function (): void {
    MiniTest::assertSame('bad_token', InternalAuthMiddleware::denyReason('/internal/v1/payment/create', '', 'secret', '10.0.0.2'));
    MiniTest::assertSame('bad_token', InternalAuthMiddleware::denyReason('/internal/v1/payment/create', 'secreT', 'secret', '10.0.0.2'));
    MiniTest::assertSame('bad_token', InternalAuthMiddleware::denyReason('/internal/v1/payment/create', 'secret ', 'secret', '10.0.0.2'));
});

MiniTest::add('InternalAuth:公网来源即使 token 正确也拒绝', static function (): void {
    foreach (['8.8.8.8', '172.32.0.1', '172.15.255.255', '192.169.0.1', '11.0.0.1', '2001:db8::1', '', 'not-an-ip'] as $ip) {
        MiniTest::assertSame('bad_source', InternalAuthMiddleware::denyReason('/internal/v1/x', 'secret', 'secret', $ip), $ip);
    }
});

MiniTest::add('InternalAuth:私网/回环 + 正确 token 放行', static function (): void {
    foreach (['10.1.2.3', '172.16.0.1', '172.31.255.254', '192.168.1.10', '127.0.0.1', '::1', '::ffff:172.18.0.3'] as $ip) {
        MiniTest::assertTrue(InternalAuthMiddleware::isAllowed('/internal/v1/x', 'secret', 'secret', $ip), $ip);
    }
});

// ---------- InternalAuthMiddleware:process 链路 ----------

MiniTest::add('InternalAuth:process 正确 token 调用下游,错误 token 抛 40301', static function (): void {
    // 本机 PHP 禁用了 putenv,期望 token 走构造注入(生产无参构造时实时读 env)
    $mw = new InternalAuthMiddleware('env-secret');
    $handler = new InternalTestHandler();
    $mw->process(new InternalTestRequest('/internal/v1/channel/test', ['X-Internal-Token' => 'env-secret']), $handler);
    MiniTest::assertSame(1, $handler->calls);

    MiniTest::assertThrows(BusinessException::class, static fn () => $mw->process(
        new InternalTestRequest('/internal/v1/channel/test', ['X-Internal-Token' => 'wrong']),
        $handler
    ), ErrorCode::FORBIDDEN);
    MiniTest::assertThrows(BusinessException::class, static fn () => $mw->process(
        new InternalTestRequest('/internal/v1/channel/test', ['X-Internal-Token' => 'env-secret'], '203.0.113.9'),
        $handler
    ), ErrorCode::FORBIDDEN);
    MiniTest::assertSame(1, $handler->calls, '拒绝时不得进入下游');
    MiniTest::assertSame(403, ErrorCode::httpStatus(ErrorCode::FORBIDDEN));
});

MiniTest::add('InternalAuth:process env 未配置时拒绝 internal、放行其他路径', static function (): void {
    $mw = new InternalAuthMiddleware('');
    $handler = new InternalTestHandler();
    MiniTest::assertThrows(BusinessException::class, static fn () => $mw->process(
        new InternalTestRequest('/internal/v1/payment/query', ['X-Internal-Token' => '']),
        $handler
    ), ErrorCode::FORBIDDEN);
    $mw->process(new InternalTestRequest('/api/v1/payment/callback/kbz-mmqr', [], '8.8.8.8'), $handler);
    MiniTest::assertSame(1, $handler->calls);
});

// ---------- PaymentCenterClient ----------

MiniTest::add('PaymentCenter:成功解包 data,路径/请求头/驼峰入参正确', static function (): void {
    $client = new FakePaymentCenterClient(['status' => 200, 'body' => json_encode([
        'code' => 0, 'message' => 'success', 'data' => ['payNo' => 'P1', 'qrCode' => 'QR', 'status' => 'pending'],
    ])]);
    $data = $client->createPayment(['bizNo' => 'O1', 'amount' => '1000.00']);
    MiniTest::assertSame(['payNo' => 'P1', 'qrCode' => 'QR', 'status' => 'pending'], $data);
    $req = $client->requests[0];
    MiniTest::assertSame('http://pay.test:9508/internal/v1/payment/create', $req['url'], '去掉 baseUrl 尾斜杠');
    MiniTest::assertSame(['bizNo' => 'O1', 'amount' => '1000.00'], json_decode($req['json'], true));
    MiniTest::assertTrue(in_array('X-Internal-Token: tok-123', $req['headers'], true), '须带内部 token 头');
    MiniTest::assertTrue(in_array('Content-Type: application/json', $req['headers'], true));
});

MiniTest::add('PaymentCenter:各方法路径映射', static function (): void {
    $ok = ['status' => 200, 'body' => '{"code":0,"message":"success","data":{}}'];
    $client = new FakePaymentCenterClient($ok);
    $client->queryPayment(['payNo' => 'P1']);
    $client->renotify(['payNo' => 'P1']);
    $client->createRefund(['payNo' => 'P1', 'refundNo' => 'R1']);
    $client->queryRefund('R1');
    $client->channelTest(7);
    MiniTest::assertSame([
        'http://pay.test:9508/internal/v1/payment/query',
        'http://pay.test:9508/internal/v1/payment/renotify',
        'http://pay.test:9508/internal/v1/refund/create',
        'http://pay.test:9508/internal/v1/refund/query',
        'http://pay.test:9508/internal/v1/channel/test',
    ], array_column($client->requests, 'url'));
    MiniTest::assertSame(['refundNo' => 'R1'], json_decode($client->requests[3]['json'], true));
    MiniTest::assertSame(['accountId' => 7], json_decode($client->requests[4]['json'], true));
});

MiniTest::add('PaymentCenter:data 为 null 时返回空数组', static function (): void {
    $client = new FakePaymentCenterClient(['status' => 200, 'body' => '{"code":0,"message":"success","data":null}']);
    MiniTest::assertSame([], $client->renotify(['refundNo' => 'R1']));
});

MiniTest::add('PaymentCenter:code≠0 原样透传 code 与 message(无视 HTTP 状态)', static function (): void {
    $client = new FakePaymentCenterClient(['status' => 409, 'body' => json_encode([
        'code' => ErrorCode::DATA_CONFLICT, 'message' => '流水已关闭', 'data' => null,
    ], JSON_UNESCAPED_UNICODE)]);
    try {
        $client->queryPayment(['payNo' => 'P1']);
        throw new AssertionError('应抛 BusinessException');
    } catch (BusinessException $e) {
        MiniTest::assertSame(ErrorCode::DATA_CONFLICT, $e->getCode());
        MiniTest::assertSame('流水已关闭', $e->getMessage());
    }
    $denied = new FakePaymentCenterClient(['status' => 403, 'body' => '{"code":40301,"message":"内部接口拒绝访问","data":null}']);
    MiniTest::assertThrows(BusinessException::class, static fn () => $denied->channelTest(1), ErrorCode::FORBIDDEN);
});

MiniTest::add('PaymentCenter:网络失败 / 非 JSON / 缺 code 统一转为支付中心不可用', static function (): void {
    $cases = [
        ['status' => 0, 'body' => ''],
        ['status' => 502, 'body' => '<html>Bad Gateway</html>'],
        ['status' => 200, 'body' => '{"message":"x"}'],
        ['status' => 200, 'body' => '[1,2]'],
    ];
    foreach ($cases as $i => $resp) {
        $client = new FakePaymentCenterClient($resp);
        try {
            $client->channelTest(1);
            throw new AssertionError("case {$i} 应抛异常");
        } catch (BusinessException $e) {
            MiniTest::assertSame(PaymentCenterClient::UNAVAILABLE_CODE, $e->getCode(), "case {$i}");
            MiniTest::assertSame(PaymentCenterClient::UNAVAILABLE_MESSAGE, $e->getMessage(), "case {$i}");
        }
    }
    MiniTest::assertSame(ErrorCode::THIRD_PARTY_ERROR, PaymentCenterClient::UNAVAILABLE_CODE);
});

MiniTest::add('PaymentCenter:未传 baseUrl 且无 PAYMENT_CENTER_URL 时缺省 payment-service:9508', static function (): void {
    // 本机 PHP 禁用了 putenv,只在该 env 本就未设置时断言缺省值
    if (getenv('PAYMENT_CENTER_URL') !== false) {
        MiniTest::assertTrue(true);
        return;
    }
    $client = new FakePaymentCenterClient(['status' => 200, 'body' => '{"code":0,"data":{}}'], null, 'tok');
    $client->channelTest(1);
    MiniTest::assertSame('http://payment-service:9508/internal/v1/channel/test', $client->requests[0]['url']);
});
