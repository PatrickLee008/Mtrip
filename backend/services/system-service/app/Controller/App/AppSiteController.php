<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use App\Model\SysSite;
use App\Model\SysSiteConfig;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端公开站点接口(/api/v1/app/site/*,无需登录):
 * App 启动时拉取可用站点与站点公开配置(货币/时区/语言等)
 */
class AppSiteController extends AbstractController
{
    /** 启用中的站点列表(仅公开字段) */
    public function list(): array
    {
        $list = SysSite::query()
            ->where('status', 1)
            ->orderBy('sort')->orderBy('id')
            ->get(['id', 'parent_id', 'site_name', 'site_type', 'site_domain',
                'country_code', 'timezone', 'currency', 'language', 'sort'])
            ->toArray();
        return Result::success($list);
    }

    /** 站点公开配置:基础信息 + config_group=app 的差异化配置 */
    public function config(): array
    {
        $siteId = $this->intInput('siteId');
        if ($siteId <= 0) {
            $siteId = (int) $this->request->getHeaderLine('x-site-id');
        }
        if ($siteId <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '缺少站点标识 X-Site-Id');
        }
        $site = SysSite::query()->where('status', 1)->find($siteId, [
            'id', 'site_name', 'site_type', 'site_domain',
            'country_code', 'timezone', 'currency', 'language',
        ]);
        if ($site === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '站点不存在或已停用');
        }

        // 仅下发 app 组公开配置,其余分组(支付密钥等)不对 C端暴露
        $configs = SysSiteConfig::query()
            ->where('site_id', $siteId)
            ->where('config_group', 'app')
            ->pluck('config_value', 'config_key')
            ->toArray();

        return Result::success([
            'site' => $site->toArray(),
            'configs' => $configs,
        ]);
    }
}
