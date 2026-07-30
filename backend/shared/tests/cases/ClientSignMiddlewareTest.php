<?php

declare(strict_types=1);

/**
 * ClientSignMiddleware 签名鉴权单测:PSR/Redis/env 桩,覆盖头缺失、客户端状态、
 * 时间窗过期、Nonce 重放、签名错误等失败分支与合法放行分支
 */

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\ClientContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Middleware\ClientSignMiddleware;
use Mtrip\Shared\Support\ClientSecretResolver;

// ---------- Hyperf env() 函数桩(无 vendor 环境) ----------
if (! function_exists('Hyperf\Support\env')) {
    eval(<<<'PHP'
    namespace Hyperf\Support;

    function env(string $key, mixed $default = null): mixed
    {
        $value = getenv($key);
        return $value === false ? $default : $value;
    }
    PHP);
}

// ---------- Hyperf Redis 桩(数组模拟 set nx/ex、get、del、incr、expire、eval;与 RedisLockTest 共用同一份定义) ----------
if (! class_exists(Hyperf\Redis\Redis::class)) {
    eval(<<<'PHP'
    namespace Hyperf\Redis;

    class Redis
    {
        public array $store = [];

        public function set(string $key, string $value, array $options = []): bool
        {
            if (in_array('nx', $options, true) && array_key_exists($key, $this->store)) {
                return false;
            }
            $this->store[$key] = $value;
            return true;
        }

        public function get(string $key): string|false
        {
            return $this->store[$key] ?? false;
        }

        public function del(string $key): int
        {
            if (array_key_exists($key, $this->store)) {
                unset($this->store[$key]);
                return 1;
            }
            return 0;
        }

        public function incr(string $key): int
        {
            $this->store[$key] = (string) ((int) ($this->store[$key] ?? 0) + 1);
            return (int) $this->store[$key];
        }

        public function expire(string $key, int $seconds): bool
        {
            return true;
        }

        /** 模拟"令牌一致才删除"的 Lua 原子释放脚本 */
        public function eval(string $script, array $args = [], int $numKeys = 0): int
        {
            [$key, $token] = [$args[0], $args[1]];
            if (($this->store[$key] ?? null) === $token) {
                unset($this->store[$key]);
                return 1;
            }
            return 0;
        }
    }
    PHP);
}

// ---------- PSR-7/PSR-15 接口桩(psr 扩展缺失的环境下兜底;本机 psr 扩展已内建真实接口) ----------
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

// ---------- 测试替身:请求 / 响应 / 处理器 / 密钥解析器 ----------
// 参数不带类型以兼容 psr 扩展内建接口签名;中间件仅使用 getUri/getHeaderLine/getMethod/getServerParams
final class SignTestRequest implements Psr\Http\Message\ServerRequestInterface
{
    public function __construct(
        private string $method,
        private string $path,
        private array $headers = [],
        private array $serverParams = ['remote_addr' => '203.0.113.9'],
    ) {
    }

    public function getUri()
    {
        return new class($this->path) {
            public function __construct(private string $path)
            {
            }

            public function getPath(): string
            {
                return $this->path;
            }
        };
    }

    public function getHeaderLine($name)
    {
        return (string) ($this->headers[$name] ?? '');
    }

    public function getMethod()
    {
        return $this->method;
    }

    public function getServerParams()
    {
        return $this->serverParams;
    }

    /* ---- 以下接口方法测试未涉及 ---- */
    public function getProtocolVersion() { throw new BadMethodCallException('测试未使用'); }
    public function withProtocolVersion($version) { throw new BadMethodCallException('测试未使用'); }
    public function getHeaders() { throw new BadMethodCallException('测试未使用'); }
    public function hasHeader($name) { throw new BadMethodCallException('测试未使用'); }
    public function getHeader($name) { throw new BadMethodCallException('测试未使用'); }
    public function withHeader($name, $value) { throw new BadMethodCallException('测试未使用'); }
    public function withAddedHeader($name, $value) { throw new BadMethodCallException('测试未使用'); }
    public function withoutHeader($name) { throw new BadMethodCallException('测试未使用'); }
    public function getBody() { throw new BadMethodCallException('测试未使用'); }
    public function withBody($body) { throw new BadMethodCallException('测试未使用'); }
    public function getRequestTarget() { throw new BadMethodCallException('测试未使用'); }
    public function withRequestTarget($requestTarget) { throw new BadMethodCallException('测试未使用'); }
    public function withMethod($method) { throw new BadMethodCallException('测试未使用'); }
    public function withUri($uri, $preserveHost = false) { throw new BadMethodCallException('测试未使用'); }
    public function getCookieParams() { throw new BadMethodCallException('测试未使用'); }
    public function withCookieParams($cookies) { throw new BadMethodCallException('测试未使用'); }
    public function getQueryParams() { throw new BadMethodCallException('测试未使用'); }
    public function withQueryParams($query) { throw new BadMethodCallException('测试未使用'); }
    public function getUploadedFiles() { throw new BadMethodCallException('测试未使用'); }
    public function withUploadedFiles($uploadedFiles) { throw new BadMethodCallException('测试未使用'); }
    public function getParsedBody() { throw new BadMethodCallException('测试未使用'); }
    public function withParsedBody($parsedBody) { throw new BadMethodCallException('测试未使用'); }
    public function getAttributes() { throw new BadMethodCallException('测试未使用'); }
    public function getAttribute($name, $default = null) { throw new BadMethodCallException('测试未使用'); }
    public function withAttribute($name, $value) { throw new BadMethodCallException('测试未使用'); }
    public function withoutAttribute($name) { throw new BadMethodCallException('测试未使用'); }
}

final class SignTestResponse implements Psr\Http\Message\ResponseInterface
{
    public function getStatusCode() { return 200; }
    public function withStatus($code, $reasonPhrase = '') { return $this; }
    public function getReasonPhrase() { return 'OK'; }
    public function getProtocolVersion() { throw new BadMethodCallException('测试未使用'); }
    public function withProtocolVersion($version) { throw new BadMethodCallException('测试未使用'); }
    public function getHeaders() { throw new BadMethodCallException('测试未使用'); }
    public function hasHeader($name) { throw new BadMethodCallException('测试未使用'); }
    public function getHeader($name) { throw new BadMethodCallException('测试未使用'); }
    public function getHeaderLine($name) { throw new BadMethodCallException('测试未使用'); }
    public function withHeader($name, $value) { throw new BadMethodCallException('测试未使用'); }
    public function withAddedHeader($name, $value) { throw new BadMethodCallException('测试未使用'); }
    public function withoutHeader($name) { throw new BadMethodCallException('测试未使用'); }
    public function getBody() { throw new BadMethodCallException('测试未使用'); }
    public function withBody($body) { throw new BadMethodCallException('测试未使用'); }
}

final class SignTestHandler implements Psr\Http\Server\RequestHandlerInterface
{
    public bool $called = false;

    public function handle($request): Psr\Http\Message\ResponseInterface
    {
        $this->called = true;
        return new SignTestResponse();
    }
}

/** 密钥解析器桩:绕过 Db,直接返回预置客户端与明文密钥 */
final class SignTestResolver extends ClientSecretResolver
{
    public function __construct(private ?array $client, private string $secret)
    {
    }

    public function findClient(string $clientId): ?array
    {
        return $this->client;
    }

    public function plainSecret(array $client): string
    {
        return $this->secret;
    }
}

/** 用例工具:预置客户端、构造中间件与合法签名头 */
final class SignTestKit
{
    public const SECRET = 'sk-test-secret';

    public const CLIENT_ID = 'CIDTEST0000000000001';

    public const PATH = '/api/v1/app/user/profile';

    public static function client(array $overrides = []): array
    {
        return array_merge([
            'id' => 1,
            'client_id' => self::CLIENT_ID,
            'client_name' => '测试客户端',
            'client_type' => 1,
            'site_id' => 1,
            'status' => 1,
            'expire_at' => null,
            'ip_whitelist' => '',
            'qps_limit' => 0,
            'perm_template_id' => 0,
        ], $overrides);
    }

    public static function middleware(Hyperf\Redis\Redis $redis, ?array $client): ClientSignMiddleware
    {
        return new ClientSignMiddleware($redis, new SignTestResolver($client, self::SECRET));
    }

    /** 构造合法签名头,可覆盖时间戳/Nonce/签名以制造失败分支 */
    public static function headers(?int $ts = null, ?string $nonce = null, ?string $sign = null, string $method = 'GET'): array
    {
        $ts = $ts ?? time();
        $nonce = $nonce ?? bin2hex(random_bytes(8));
        return [
            'X-Client-Id' => self::CLIENT_ID,
            'X-Timestamp' => (string) $ts,
            'X-Nonce' => $nonce,
            'X-Sign' => $sign ?? hash_hmac('sha256', self::CLIENT_ID . strtoupper($method) . self::PATH . $ts . $nonce, self::SECRET),
        ];
    }

    /** 断言鉴权失败且命中指定分支文案 */
    public static function assertAuthFail(ClientSignMiddleware $mw, SignTestRequest $req, string $messagePart, string $hint): void
    {
        try {
            $mw->process($req, new SignTestHandler());
        } catch (BusinessException $e) {
            MiniTest::assertSame(ErrorCode::CLIENT_AUTH_FAIL, $e->getCode(), $hint . ':错误码');
            MiniTest::assertTrue(
                $messagePart === '' || str_contains($e->getMessage(), $messagePart),
                $hint . ':应命中文案"' . $messagePart . '",实际"' . $e->getMessage() . '"'
            );
            return;
        }
        throw new AssertionError($hint . ':期望抛出鉴权失败,实际未抛异常');
    }
}

MiniTest::add('ClientSign:非 app 路径直接放行不校验签名', static function (): void {
    $mw = SignTestKit::middleware(new Hyperf\Redis\Redis(), null);
    $handler = new SignTestHandler();
    $mw->process(new SignTestRequest('GET', '/api/v1/admin/user/list'), $handler);
    MiniTest::assertTrue($handler->called, '非 /api/v1/app/ 路径应直接透传');
});

MiniTest::add('ClientSign:缺少签名请求头拒绝', static function (): void {
    $mw = SignTestKit::middleware(new Hyperf\Redis\Redis(), SignTestKit::client());
    SignTestKit::assertAuthFail($mw, new SignTestRequest('GET', SignTestKit::PATH), '', '缺少签名头');
});

MiniTest::add('ClientSign:客户端不存在/禁用/过期拒绝', static function (): void {
    $req = new SignTestRequest('GET', SignTestKit::PATH, SignTestKit::headers());
    SignTestKit::assertAuthFail(
        SignTestKit::middleware(new Hyperf\Redis\Redis(), null),
        $req,
        '',
        '客户端不存在'
    );
    SignTestKit::assertAuthFail(
        SignTestKit::middleware(new Hyperf\Redis\Redis(), SignTestKit::client(['status' => 2])),
        $req,
        '客户端已禁用',
        '客户端禁用'
    );
    SignTestKit::assertAuthFail(
        SignTestKit::middleware(new Hyperf\Redis\Redis(), SignTestKit::client(['expire_at' => '2000-01-01 00:00:00'])),
        $req,
        '客户端已过期',
        '客户端过期'
    );
});

MiniTest::add('ClientSign:时间窗过期拒绝(防重放)', static function (): void {
    $mw = SignTestKit::middleware(new Hyperf\Redis\Redis(), SignTestKit::client());
    // 默认窗口 3600 秒,时间戳偏移 4000 秒应被拒绝(签名本身合法)
    $req = new SignTestRequest('GET', SignTestKit::PATH, SignTestKit::headers(time() - 4000));
    SignTestKit::assertAuthFail($mw, $req, '请求已过期', '时间窗过期');
});

MiniTest::add('ClientSign:Nonce 重放拒绝', static function (): void {
    $redis = new Hyperf\Redis\Redis();
    $mw = SignTestKit::middleware($redis, SignTestKit::client());
    $headers = SignTestKit::headers();
    $req = new SignTestRequest('GET', SignTestKit::PATH, $headers);

    $handler = new SignTestHandler();
    $mw->process($req, $handler);
    MiniTest::assertTrue($handler->called, '首次合法请求应放行');

    // 原样重放同一请求:Nonce 已占用,应拒绝
    SignTestKit::assertAuthFail($mw, $req, '重复请求', 'Nonce 重放');
});

MiniTest::add('ClientSign:签名错误拒绝', static function (): void {
    $mw = SignTestKit::middleware(new Hyperf\Redis\Redis(), SignTestKit::client());
    $bad = SignTestKit::headers(null, null, str_repeat('0', 64));
    SignTestKit::assertAuthFail($mw, new SignTestRequest('GET', SignTestKit::PATH, $bad), '签名错误', '签名错误');

    // 方法参与签名:用 GET 签名发 POST 请求同样拒绝
    $mw2 = SignTestKit::middleware(new Hyperf\Redis\Redis(), SignTestKit::client());
    $getSigned = SignTestKit::headers(null, null, null, 'GET');
    SignTestKit::assertAuthFail($mw2, new SignTestRequest('POST', SignTestKit::PATH, $getSigned), '签名错误', '方法不匹配');
});

MiniTest::add('ClientSign:合法签名放行并注入客户端上下文', static function (): void {
    $mw = SignTestKit::middleware(new Hyperf\Redis\Redis(), SignTestKit::client());
    $handler = new SignTestHandler();
    $mw->process(new SignTestRequest('GET', SignTestKit::PATH, SignTestKit::headers()), $handler);
    MiniTest::assertTrue($handler->called, '合法请求应放行');
    MiniTest::assertSame(SignTestKit::CLIENT_ID, ClientContext::clientId(), '上下文 clientId');
    MiniTest::assertSame(1, ClientContext::siteId(), '上下文 siteId');
    MiniTest::assertSame('203.0.113.9', ClientContext::ip(), '上下文 ip 取 remote_addr');
});
