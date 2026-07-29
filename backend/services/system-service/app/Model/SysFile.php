<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 文件库表(文档模块7)
 */
class SysFile extends BaseModel
{
    protected ?string $table = 'sys_file';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'storage_id' => 'integer',
        'file_type' => 'integer',
        'file_size' => 'integer',
        'uploader_id' => 'integer',
    ];
}
