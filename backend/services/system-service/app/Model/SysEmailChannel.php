<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/** SMTP channel configuration; username/password are AES encrypted. */
class SysEmailChannel extends BaseModel
{
    protected ?string $table = 'sys_email_channel';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'smtp_port' => 'integer',
        'code_expire_sec' => 'integer',
        'pin_length' => 'integer',
        'max_invalid_attempts' => 'integer',
        'status' => 'integer',
    ];
}
