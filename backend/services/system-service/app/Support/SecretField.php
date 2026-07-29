<?php

declare(strict_types=1);

namespace App\Support;

use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;

use function Hyperf\Config\config;

/**
 * 密钥字段处理:AES 加密入库 / 解密后脱敏回显(文档 9.2 密钥数据安全规范)
 */
class SecretField
{
    /**
     * 保存密钥:入参为空或为脱敏回显值(含*)时保留原密文,否则加密新值
     */
    public static function keep(string $input, string $currentEncrypted): string
    {
        if ($input === '' || str_contains($input, '*')) {
            return $currentEncrypted;
        }
        return CryptoHelper::encrypt($input, (string) config('mtrip.aes_key'));
    }

    /**
     * 回显密钥:解密后脱敏(保留前3后4),解密失败返回占位
     */
    public static function mask(string $encrypted): string
    {
        if ($encrypted === '') {
            return '';
        }
        try {
            return MaskHelper::secret(CryptoHelper::decrypt($encrypted, (string) config('mtrip.aes_key')));
        } catch (\Throwable) {
            return '******';
        }
    }
}
