<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use App\Model\SysConfig;
use App\Model\SysSite;
use App\Model\SysSiteConfig;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\AppVersion;
use Mtrip\Shared\Support\Result;

/**
 * C端公开站点接口(/api/v1/app/site/*,无需登录):
 * App 启动时拉取可用站点与站点公开配置(货币/时区/语言等),以及 App 版本检查(强制 / 可选更新)
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

    /**
     * App 版本检查(Consumer App PRD 19.1,公开):?platform=android|ios&version=1.2.3
     * 配置取全局配置 app_version 组(后台维护,改完即生效,无需发新包);
     * forceUpdate = 已装 < 最低支持版本(须更新才能继续),hasUpdate = 已装 < 最新版本。
     */
    public function versionCheck(): array
    {
        $platform = strtolower($this->strInput('platform'));
        if (! in_array($platform, ['android', 'ios'], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'platform 仅支持 android / ios');
        }
        $version = $this->strInput('version');

        $prefix = 'app_' . $platform . '_';
        $configs = SysConfig::query()
            ->whereIn('config_key', [
                $prefix . 'min_version', $prefix . 'latest_version', $prefix . 'store_url', 'app_update_notes',
            ])
            ->pluck('config_value', 'config_key')
            ->toArray();
        $minVersion = trim((string) ($configs[$prefix . 'min_version'] ?? ''));
        $latestVersion = trim((string) ($configs[$prefix . 'latest_version'] ?? ''));
        // 最新版本未配置或低于最低支持版本时以最低支持版本为准,前端展示的目标版本不倒挂
        if (AppVersion::isValid($minVersion) && (AppVersion::compare($latestVersion, $minVersion) ?? -1) < 0) {
            $latestVersion = $minVersion;
        }

        return Result::success(AppVersion::evaluate($version, $minVersion, $latestVersion) + [
            'platform' => $platform,
            'currentVersion' => $version,
            'latestVersion' => $latestVersion,
            'minVersion' => $minVersion,
            'storeUrl' => trim((string) ($configs[$prefix . 'store_url'] ?? '')),
            'notes' => (string) ($configs['app_update_notes'] ?? ''),
        ]);
    }
}
