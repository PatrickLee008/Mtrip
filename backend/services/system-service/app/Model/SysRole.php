<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 角色表(文档模块2)
 */
class SysRole extends BaseModel
{
    protected ?string $table = 'sys_role';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'role_type' => 'integer',
        'status' => 'integer',
    ];
}
