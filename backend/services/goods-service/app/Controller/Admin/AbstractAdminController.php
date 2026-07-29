<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\Database\Query\Builder;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;

/**
 * 管理端控制器基类:入参读取 / 分页参数(上限200) / 站点数据隔离
 * (C端基类见 App\Controller\AbstractController,分页上限 50,勿混用)
 */
abstract class AbstractAdminController
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

    protected function floatInput(string $key, float $default = 0.0): float
    {
        return (float) $this->request->input($key, $default);
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
     * 分页参数 [page, pageSize],pageSize 上限 200(管理端)
     */
    protected function pageParams(): array
    {
        $page = max(1, $this->intInput('page', 1));
        $pageSize = min(200, max(1, $this->intInput('pageSize', 20)));
        return [$page, $pageSize];
    }

    /**
     * 站点数据隔离:非超管强制过滤自身站点;超管可按入参 siteId 过滤(0=全部)
     */
    protected function applySiteScope(Builder $query, string $column = 'site_id'): Builder
    {
        $siteId = AdminContext::scopeSiteId($this->intInput('siteId'));
        if ($siteId !== null && $siteId > 0) {
            $query->where($column, $siteId);
        }
        return $query;
    }

    /** 站点数据权限校验:非超管仅可操作自身站点数据 */
    protected function assertSiteScope(int $rowSiteId): void
    {
        if (! AdminContext::isSuper() && $rowSiteId !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
    }

    /** JSON 列解码为数组(兼容 null/已解码) */
    protected function jsonDecode(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : [];
        }
        return [];
    }

    /** 校验日期参数格式 Y-m-d */
    protected function requireDate(string $key): string
    {
        $value = $this->requireStr($key);
        $ts = strtotime($value);
        if ($ts === false || date('Y-m-d', $ts) !== $value) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 须为 Y-m-d 格式日期");
        }
        return $value;
    }
}
