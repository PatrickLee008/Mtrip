<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\Contract\ConfigInterface;
use Hyperf\Database\Query\Builder;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;

/**
 * 管理端控制器基类:入参读取 / 分页参数 / 站点数据隔离 / 加密字段助手
 */
abstract class AbstractController
{
    #[Inject]
    protected RequestInterface $request;

    #[Inject]
    protected ConfigInterface $config;

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

    protected function aesKey(): string
    {
        return (string) $this->config->get('mtrip.aes_key', '');
    }

    /** 加密敏感字段(手机号/身份证/银行账号) */
    protected function encryptField(string $plaintext): string
    {
        return $plaintext === '' ? '' : CryptoHelper::encrypt($plaintext, $this->aesKey());
    }

    /** 解密敏感字段,失败返回空串(兼容历史明文/空值) */
    protected function decryptField(string $ciphertext): string
    {
        if ($ciphertext === '') {
            return '';
        }
        try {
            return CryptoHelper::decrypt($ciphertext, $this->aesKey());
        } catch (\Throwable) {
            return '';
        }
    }
}
