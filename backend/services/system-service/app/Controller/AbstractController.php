<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * 控制器基类:入参读取 / 分页参数 / 客户端IP 等通用助手
 */
abstract class AbstractController
{
    #[Inject]
    protected RequestInterface $request;

    /** 读取入参(GET+POST 合并) */
    protected function input(string $key, mixed $default = null): mixed
    {
        return $this->request->input($key, $default);
    }

    protected function intInput(string $key, int $default = 0): int
    {
        return (int) $this->request->input($key, $default);
    }

    protected function strInput(string $key, string $default = ''): string
    {
        return trim((string) $this->request->input($key, $default));
    }

    /** 必填主键 id,缺失抛参数错误 */
    protected function requireId(string $key = 'id'): int
    {
        $id = $this->intInput($key);
        if ($id <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 不能为空");
        }
        return $id;
    }

    /** 必填字符串参数 */
    protected function requireStr(string $key): string
    {
        $value = $this->strInput($key);
        if ($value === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 不能为空");
        }
        return $value;
    }

    /**
     * 分页参数 [page, pageSize],pageSize 上限 200
     */
    protected function pageParams(): array
    {
        $page = max(1, $this->intInput('page', 1));
        $pageSize = min(200, max(1, $this->intInput('pageSize', 20)));
        return [$page, $pageSize];
    }

    /** 客户端真实IP(网关透传 X-Real-IP / X-Forwarded-For) */
    protected function clientIp(): string
    {
        $ip = $this->request->getHeaderLine('x-real-ip');
        if ($ip === '') {
            $forwarded = $this->request->getHeaderLine('x-forwarded-for');
            $ip = $forwarded !== '' ? trim(explode(',', $forwarded)[0]) : '';
        }
        if ($ip === '') {
            $ip = (string) ($this->request->getServerParams()['remote_addr'] ?? '');
        }
        return $ip;
    }
}
