<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 全局系统配置表(文档模块5,平台级 key-value,不做站点隔离)
 */
class SysConfig extends BaseModel
{
    protected ?string $table = 'sys_config';

    protected bool $siteIsolated = false;

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'value_type' => 'integer',
    ];
}
