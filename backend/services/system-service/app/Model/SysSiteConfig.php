<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 站点差异化配置表(文档模块6)
 */
class SysSiteConfig extends BaseModel
{
    protected ?string $table = 'sys_site_config';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
    ];
}
