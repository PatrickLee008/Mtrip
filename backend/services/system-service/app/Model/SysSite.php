<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 站点表(文档模块6,树形层级;主键即站点ID,无 site_id 列)
 */
class SysSite extends BaseModel
{
    protected ?string $table = 'sys_site';

    protected bool $siteIsolated = false;

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'parent_id' => 'integer',
        'site_type' => 'integer',
        'status' => 'integer',
        'sort' => 'integer',
    ];
}
