<?php

declare(strict_types=1);

namespace Mtrip\Shared\Middleware;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\ClientContext;
use Mtrip\Shared\Support\MaskHelper;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 接口调用日志中间件(文档模块14):移动端 API 全量请求日志
 * 敏感参数自动脱敏,永久存储不可手动删除,仅定时任务按配置归档
 */
class ApiAccessLogMiddleware implements MiddlewareInterface
{
    private const MAX_BODY_LEN = 2000;

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $start = microtime(true);
        $response = $handler->handle($request);
        $costMs = (int) round((microtime(true) - $start) * 1000);

        try {
            $client = ClientContext::get();
            $params = array_merge(
                (array) $request->getQueryParams(),
                (array) $request->getParsedBody()
            );
            $respBody = (string) $response->getBody();
            $respMasked = json_decode($respBody, true);
            $respMasked = is_array($respMasked)
                ? json_encode(MaskHelper::maskParams($respMasked), JSON_UNESCAPED_UNICODE)
                : mb_substr($respBody, 0, self::MAX_BODY_LEN);

            Db::connection('system')->table('sys_api_access_log')->insert([
                'site_id' => (int) ($client['site_id'] ?? 0),
                'client_pk_id' => (int) ($client['id'] ?? 0),
                'client_id' => (string) ($client['client_id'] ?? ''),
                'client_name' => (string) ($client['client_name'] ?? ''),
                'client_type' => (int) ($client['client_type'] ?? 0),
                'api_path' => $request->getUri()->getPath(),
                'request_method' => strtoupper($request->getMethod()),
                'request_headers' => json_encode(MaskHelper::maskParams($this->pickHeaders($request)), JSON_UNESCAPED_UNICODE),
                'request_params' => mb_substr(json_encode(MaskHelper::maskParams($params), JSON_UNESCAPED_UNICODE), 0, self::MAX_BODY_LEN),
                'response_code' => $response->getStatusCode(),
                'response_body' => mb_substr((string) $respMasked, 0, self::MAX_BODY_LEN),
                'cost_ms' => $costMs,
                'device_info' => mb_substr($request->getHeaderLine('User-Agent'), 0, 255),
                'client_ip' => (string) ($client['ip'] ?? ''),
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable) {
            // 日志写入失败不影响业务响应
        }

        return $response;
    }

    private function pickHeaders(ServerRequestInterface $request): array
    {
        $picked = [];
        foreach (['x-client-id', 'x-timestamp', 'content-type', 'accept-language'] as $name) {
            $value = $request->getHeaderLine($name);
            if ($value !== '') {
                $picked[$name] = $value;
            }
        }
        return $picked;
    }
}
