<?php

declare(strict_types=1);

namespace Mtrip\Shared\Middleware;

use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Support\MaskHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;

/**
 * 全量请求日志中间件(排查模式):MTRIP_REQUEST_LOG=true 时启用,生产默认关闭
 * 记录每个请求的方法/路径/入参(脱敏)/响应/耗时;异常额外记录堆栈后原样抛出交给全局异常处理器
 * 输出 runtime/logs/request.log(compose 已挂载至宿主机 deploy/logs/<服务名>/)
 */
class RequestLogMiddleware implements MiddlewareInterface
{
    private const MAX_BODY_LEN = 4000;

    private bool $enabled;

    private LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->enabled = (bool) \Hyperf\Support\env('MTRIP_REQUEST_LOG', false);
        $this->logger = $loggerFactory->get('request', 'request');
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (! $this->enabled) {
            return $handler->handle($request);
        }

        $start = microtime(true);
        $method = strtoupper($request->getMethod());
        $path = $request->getUri()->getPath();
        $sensitive = str_contains($path, '/auth/') || str_contains($path, '/merchant/impersonate/') || str_contains($path, '/reset-2fa');

        try {
            $response = $handler->handle($request);
        } catch (\Throwable $e) {
            $this->logger->error(sprintf(
                '%s %s EXCEPTION %s: %s in %s:%d (%dms)',
                $method,
                $path,
                $e::class,
                $sensitive ? '[protected authentication error]' : $e->getMessage(),
                $e->getFile(),
                $e->getLine(),
                (int) round((microtime(true) - $start) * 1000)
            ), [
                'params' => $this->requestParams($request),
                'ip' => $this->clientIp($request),
                'trace' => $sensitive ? '[protected authentication trace]' : $e->getTraceAsString(),
            ]);
            throw $e;
        }

        $costMs = (int) round((microtime(true) - $start) * 1000);
        $status = $response->getStatusCode();
        $context = [
            'params' => $this->requestParams($request),
            'response' => $sensitive || str_ends_with($path, '/merchant/document/download') ? '[protected response]' : mb_substr((string) json_encode(MaskHelper::maskParams((array) json_decode((string) $response->getBody(), true)), JSON_UNESCAPED_UNICODE), 0, self::MAX_BODY_LEN),
            'ip' => $this->clientIp($request),
        ];

        // 业务成功记 info,HTTP 4xx/5xx 记 warning 便于 grep 定位
        if ($status >= 400) {
            $this->logger->warning(sprintf('%s %s -> %d (%dms)', $method, $path, $status, $costMs), $context);
        } else {
            $this->logger->info(sprintf('%s %s -> %d (%dms)', $method, $path, $status, $costMs), $context);
        }

        return $response;
    }

    /** 合并 query 与 body 参数并脱敏截断;body 非 JSON 时回退原始串 */
    private function requestParams(ServerRequestInterface $request): string
    {
        if (str_contains($request->getUri()->getPath(), '/auth/') || str_contains($request->getUri()->getPath(), '/merchant/impersonate/')) return '[protected authentication params]';
        $params = array_merge(
            (array) $request->getQueryParams(),
            (array) $request->getParsedBody()
        );
        if ($params === []) {
            $raw = (string) $request->getBody();
            return $raw === '' ? '' : '[unparsed body omitted]';
        }
        return mb_substr(
            (string) json_encode(MaskHelper::maskParams($params), JSON_UNESCAPED_UNICODE),
            0,
            self::MAX_BODY_LEN
        );
    }

    private function clientIp(ServerRequestInterface $request): string
    {
        $ip = $request->getHeaderLine('x-real-ip');
        if ($ip === '') {
            $ip = (string) ($request->getServerParams()['remote_addr'] ?? '');
        }
        return $ip;
    }
}
