<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 文件存储配置表(文档模块7,AK/SK AES加密存储)
 */
class SysStorage extends BaseModel
{
    protected ?string $table = 'sys_storage';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'expire_days' => 'integer',
        'is_default' => 'integer',
        'status' => 'integer',
    ];
}
