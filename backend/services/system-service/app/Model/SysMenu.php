<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 菜单按钮权限树表(文档模块3,系统全局表不做站点隔离)
 */
class SysMenu extends BaseModel
{
    protected ?string $table = 'sys_menu';

    protected bool $siteIsolated = false;

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'parent_id' => 'integer',
        'menu_type' => 'integer',
        'sort' => 'integer',
        'status' => 'integer',
    ];
}
