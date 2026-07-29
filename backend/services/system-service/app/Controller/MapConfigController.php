<?php

declare(strict_types=1);

namespace App\Controller;

use App\Model\SysMapConfig;
use App\Support\SecretField;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Support\Result;

/**
 * 模块10 地图服务配置:Google Maps 分站点配置,API Key AES加密、返回脱敏
 */
class MapConfigController extends AbstractController
{
    public function index(): array
    {
        $list = (new SysMapConfig())->newSiteQuery($this->intInput('siteId') ?: null)
            ->orderBy('site_id')->get()
            ->map(static function (SysMapConfig $config) {
                $row = $config->toArray();
                $row['api_key'] = SecretField::mask((string) $config->api_key);
                return $row;
            })->toArray();
        return Result::success($list);
    }

    /** 保存(按站点 upsert,一个站点一条 Google Maps 配置) */
    #[Permission('config:map:edit')]
    public function save(): array
    {
        $siteId = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
        /** @var SysMapConfig $config */
        $config = SysMapConfig::query()->where('site_id', $siteId)->where('provider', 'google')->first()
            ?? new SysMapConfig(['site_id' => $siteId, 'provider' => 'google']);
        $config->api_key = SecretField::keep($this->strInput('apiKey'), (string) $config->api_key);
        $config->map_language = $this->strInput('mapLanguage', (string) ($config->map_language ?? 'en'));
        $config->default_zoom = min(20, max(1, $this->intInput('defaultZoom', (int) ($config->default_zoom ?? 12))));
        $config->geocode_enabled = $this->intInput('geocodeEnabled', (int) ($config->geocode_enabled ?? 1)) === 1 ? 1 : 0;
        $config->locate_enabled = $this->intInput('locateEnabled', (int) ($config->locate_enabled ?? 1)) === 1 ? 1 : 0;
        $regionLimit = $this->input('regionLimit');
        if (is_array($regionLimit)) {
            $config->region_limit = array_values(array_map('strval', $regionLimit));
        }
        $status = $this->intInput('status', (int) ($config->status ?? 1));
        $config->status = in_array($status, [1, 2], true) ? $status : 1;
        $config->save();
        return Result::success(['id' => (int) $config->id], '地图配置保存成功');
    }
}
