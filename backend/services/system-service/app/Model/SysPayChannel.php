<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 支付渠道表(文档模块8,api_key AES加密存储;kbz_mmqr 行经 account_id 绑定 sys_pay_account)
 */
class SysPayChannel extends BaseModel
{
    protected ?string $table = 'sys_pay_channel';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at'];

    protected array $casts = [
        'site_id' => 'integer',
        'fee_rate' => 'string',
        'min_amount' => 'string',
        'max_amount' => 'string',
        'currencies' => 'array',
        'split_enabled' => 'integer',
        'status' => 'integer',
        'account_id' => 'integer',
        'sort' => 'integer',
    ];
}
