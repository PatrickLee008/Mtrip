<?php

declare(strict_types=1);

namespace Mtrip\Shared\Middleware;

use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\RedisLock;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * 提交防重中间件:管理端 + 移动端所有写操作(POST/PUT/PATCH/DELETE)统一并发控制
 *
 * 两种模式(自动选择):
 * 1. FormId 幂等(请求头带 X-Form-Id):同一提交身份 + FormId 只允许成功提交一次,
 *    业务失败自动回收 FormId 允许重试;适合下单/支付等强幂等场景
 * 2. 并发互斥锁(默认):同一提交身份对同一接口同时只允许一个在途请求,
 *    业务完成(finally)即释放锁,TTL 兜底防死锁;拦截双击/连点/并发重放
 *
 * 提交身份识别(依序):Authorization Token 摘要 → X-Client-Id + IP → IP + User-Agent
 * 开关:MTRIP_SUBMIT_LOCK(默认 true);锁 TTL:MTRIP_SUBMIT_LOCK_TTL(默认 10 秒);
 * FormId 幂等窗口:MTRIP_FORM_ID_TTL(默认 300 秒)
 */
class SubmitLockMiddleware implements MiddlewareInterface
{
    /** 需要防重控制的写方法 */
    private const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

    private bool $enabled;

    private int $lockTtl;

    private int $formIdTtl;

    public function __construct(protected Redis $redis, protected RedisLock $lock)
    {
        $this->enabled = (bool) \Hyperf\Support\env('MTRIP_SUBMIT_LOCK', true);
        $this->lockTtl = max(1, (int) \Hyperf\Support\env('MTRIP_SUBMIT_LOCK_TTL', 10));
        $this->formIdTtl = max(10, (int) \Hyperf\Support\env('MTRIP_FORM_ID_TTL', 300));
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $method = strtoupper($request->getMethod());
        $path = $request->getUri()->getPath();
        if (! $this->enabled || ! in_array($method, self::WRITE_METHODS, true) || ! str_starts_with($path, '/api/')) {
            return $handler->handle($request);
        }

        $identity = $this->identity($request);

        // 模式1:FormId 幂等(客户端进入表单页时生成,重试复用同一 FormId)
        $formId = trim($request->getHeaderLine('X-Form-Id'));
        if ($formId !== '') {
            return $this->handleWithFormId($request, $handler, $identity, $formId);
        }

        // 模式2:并发互斥锁(同身份同接口串行,完成即释放)
        $lockKey = 'mtrip:submit:lock:' . md5($identity . '|' . $method . '|' . $path);
        return $this->lock->run($lockKey, $this->lockTtl, static fn () => $handler->handle($request));
    }

    /**
     * FormId 幂等:SETNX 占位成功才放行;业务异常回收占位允许重试,成功则保留至窗口过期
     */
    private function handleWithFormId(
        ServerRequestInterface $request,
        RequestHandlerInterface $handler,
        string $identity,
        string $formId
    ): ResponseInterface {
        $formKey = 'mtrip:submit:form:' . md5($identity . '|' . $formId);
        if (! $this->redis->set($formKey, '1', ['nx', 'ex' => $this->formIdTtl])) {
            throw new BusinessException(ErrorCode::REPEAT_SUBMIT, '该表单已提交,请勿重复操作');
        }
        try {
            $response = $handler->handle($request);
        } catch (\Throwable $e) {
            // 业务失败回收 FormId,客户端可携带同一 FormId 重试
            $this->redis->del($formKey);
            throw $e;
        }
        if ($response->getStatusCode() >= 400) {
            $this->redis->del($formKey);
        }
        return $response;
    }

    /**
     * 提交身份:优先登录态 Token(管理员/C端用户),其次客户端标识,最后 IP+UA(游客)
     */
    private function identity(ServerRequestInterface $request): string
    {
        $authorization = $request->getHeaderLine('Authorization');
        if (str_starts_with($authorization, 'Bearer ') && strlen($authorization) > 7) {
            return 'tk:' . md5($authorization);
        }
        $clientId = $request->getHeaderLine('X-Client-Id');
        if ($clientId !== '') {
            return 'client:' . $clientId . ':' . $this->clientIp($request);
        }
        return 'anon:' . md5($this->clientIp($request) . '|' . $request->getHeaderLine('User-Agent'));
    }

    private function clientIp(ServerRequestInterface $request): string
    {
        $xff = $request->getHeaderLine('X-Forwarded-For');
        if ($xff !== '') {
            return trim(explode(',', $xff)[0]);
        }
        $real = $request->getHeaderLine('X-Real-IP');
        if ($real !== '') {
            return $real;
        }
        return (string) ($request->getServerParams()['remote_addr'] ?? '');
    }
}
