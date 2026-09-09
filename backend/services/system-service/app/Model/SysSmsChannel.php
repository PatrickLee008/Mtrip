<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 国际短信渠道表(文档模块9,api_key / api_secret 均 AES 加密存储)
 */
class SysSmsChannel extends BaseModel
{
    protected ?string $table = 'sys_sms_channel';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'region_whitelist' => 'array',
        'code_expire_sec' => 'integer',
        // SMSPoh Verify API 的两个可调参数(见 database/system/11-sms-smspoh.sql)
        'pin_length' => 'integer',
        'max_invalid_attempts' => 'integer',
        'status' => 'integer',
    ];
}
