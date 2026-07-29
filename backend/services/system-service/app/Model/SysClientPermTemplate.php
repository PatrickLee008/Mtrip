<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 客户端接口权限模板表(文档模块13)
 */
class SysClientPermTemplate extends BaseModel
{
    protected ?string $table = 'sys_client_perm_template';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'template_type' => 'integer',
        'rule_mode' => 'integer',
        'api_list' => 'array',
        'status' => 'integer',
    ];
}
