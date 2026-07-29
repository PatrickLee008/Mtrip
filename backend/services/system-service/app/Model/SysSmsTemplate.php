<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 短信模板表(文档模块9,依附渠道+站点)
 */
class SysSmsTemplate extends BaseModel
{
    protected ?string $table = 'sys_sms_template';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'channel_id' => 'integer',
        'template_type' => 'integer',
        'variables' => 'array',
        'status' => 'integer',
    ];
}
