<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;

/**
 * C端控制器基类:入参读取 / 分页参数 / 站点ID / 客户端类型等通用助手
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

    /** Numeric filter inputs used by hotel price/rating/distance queries. */
    protected function floatInput(string $key, float $default = 0.0): float
    {
        $value = $this->request->input($key, $default);
        if (! is_numeric($value) || ! is_finite((float) $value)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 必须为有效数值");
        }
        return (float) $value;
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
     * 分页参数 [page, pageSize],pageSize 上限 50(C端)
     */
    protected function pageParams(): array
    {
        $page = max(1, $this->intInput('page', 1));
        $pageSize = min(50, max(1, $this->intInput('pageSize', 10)));
        return [$page, $pageSize];
    }

    /**
     * 当前站点ID(多站点隔离核心):登录态优先取 Token,游客取 X-Site-Id 请求头
     */
    protected function siteId(): int
    {
        $siteId = UserContext::siteId();
        if ($siteId > 0) {
            return $siteId;
        }
        return (int) $this->request->getHeaderLine('x-site-id');
    }

    /** 必填站点ID,缺失抛参数错误 */
    protected function requireSiteId(): int
    {
        $siteId = $this->siteId();
        if ($siteId <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '缺少站点标识 X-Site-Id');
        }
        return $siteId;
    }

    /** 客户端类型:app-ios / app-android / app-h5,映射注册来源 1Android 2iOS 3H5 */
    protected function registerSource(): int
    {
        return match ($this->request->getHeaderLine('x-client-type')) {
            'app-android' => 1,
            'app-ios' => 2,
            default => 3,
        };
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
