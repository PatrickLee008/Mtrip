<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Exception\BusinessException;

/**
 * C端控制器基类(marketing-service):入参读取 / 分页 / 站点ID
 * 与 admin 侧 AbstractController(AdminContext,pageSize 200)区分;C端以 UserContext 为准
 */
abstract class AppAbstractController
{
    #[Inject]
    protected RequestInterface $request;

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

    protected function floatInput(string $key, float $default = 0.0): float
    {
        return (float) $this->request->input($key, $default);
    }

    protected function requireId(string $key = 'id'): int
    {
        $id = $this->intInput($key);
        if ($id <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 不能为空");
        }
        return $id;
    }

    /** 分页参数 [page, pageSize],pageSize 上限 50(C端) */
    protected function pageParams(): array
    {
        $page = max(1, $this->intInput('page', 1));
        $pageSize = min(50, max(1, $this->intInput('pageSize', 10)));
        return [$page, $pageSize];
    }

    /** 当前站点ID:登录态优先取 Token,游客取 X-Site-Id 请求头 */
    protected function siteId(): int
    {
        $siteId = UserContext::siteId();
        if ($siteId > 0) {
            return $siteId;
        }
        return (int) $this->request->getHeaderLine('x-site-id');
    }

    protected function requireSiteId(): int
    {
        $siteId = $this->siteId();
        if ($siteId <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '缺少站点标识 X-Site-Id');
        }
        return $siteId;
    }
}
