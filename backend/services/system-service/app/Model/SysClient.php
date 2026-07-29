<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 客户端密钥表(文档模块12,client_secret AES加密存储)
 */
class SysClient extends BaseModel
{
    protected ?string $table = 'sys_client';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'client_type' => 'integer',
        'perm_template_id' => 'integer',
        'qps_limit' => 'integer',
        'status' => 'integer',
    ];
}
