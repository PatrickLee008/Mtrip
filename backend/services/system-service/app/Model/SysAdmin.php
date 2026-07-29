<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 管理员账号表(文档模块1)
 */
class SysAdmin extends BaseModel
{
    protected ?string $table = 'sys_admin';

    protected array $guarded = ['id'];

    protected array $hidden = ['password', 'deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'is_super' => 'integer',
        'status' => 'integer',
        'login_fail_count' => 'integer',
    ];
}
