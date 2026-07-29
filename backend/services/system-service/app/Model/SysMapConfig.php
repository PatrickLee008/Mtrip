<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 地图服务配置表(文档模块10,api_key AES加密存储)
 */
class SysMapConfig extends BaseModel
{
    protected ?string $table = 'sys_map_config';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'default_zoom' => 'integer',
        'geocode_enabled' => 'integer',
        'locate_enabled' => 'integer',
        'region_limit' => 'array',
        'status' => 'integer',
    ];
}
