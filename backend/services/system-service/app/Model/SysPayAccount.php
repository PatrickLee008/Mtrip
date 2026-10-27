<?php

declare(strict_types=1);

namespace App\Model;

use Mtrip\Shared\Model\BaseModel;

/**
 * 收款账户表(方案22 §5.1,KBZPay MMQR 直连/服务商凭据;site_id=0 为平台共享)
 * app_key / cert_pem / key_pem / key_pwd / ca_pem 均为 AES 密文:
 * 一律 hidden,禁止 toArray() 直出,回显只能走 SecretField::mask 或布尔 has_* 标记。
 */
class SysPayAccount extends BaseModel
{
    public const MODE_DIRECT = 1;

    public const MODE_ISV = 2;

    public const ENVS = ['uat', 'prod'];

    /** 密文列(禁止直出) */
    public const SECRET_COLUMNS = ['app_key', 'cert_pem', 'key_pem', 'key_pwd', 'ca_pem'];

    protected ?string $table = 'sys_pay_account';

    protected array $guarded = ['id'];

    protected array $hidden = ['deleted_at', 'app_key', 'cert_pem', 'key_pem', 'key_pwd', 'ca_pem'];

    protected array $casts = [
        'site_id' => 'integer',
        'mode' => 'integer',
        'status' => 'integer',
    ];
}
