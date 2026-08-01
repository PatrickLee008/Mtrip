<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 动态 App 主题(mtrip_system.app_theme)
 * 生效判定见 ThemeController::active;站点隔离由查询显式处理,模型不自动裁剪
 */
class SysTheme extends BaseModel
{
    protected ?string $table = 'app_theme';

    protected bool $siteIsolated = false;

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'is_default' => 'integer',
        'priority' => 'integer',
        'status' => 'integer',
        'assets' => 'array',
    ];
}
