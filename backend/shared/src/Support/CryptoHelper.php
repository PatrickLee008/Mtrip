<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * AES-256-GCM 加解密工具:密钥类字段(存储AK/SK、支付密钥、短信密钥、地图Key、ClientSecret)
 * 数据库加密存储(对应文档 9.2 密钥数据安全规范)
 */
class CryptoHelper
{
    private const CIPHER = 'aes-256-gcm';

    /**
     * 加密,输出 base64(iv + tag + ciphertext)
     */
    public static function encrypt(string $plaintext, string $key): string
    {
        $key = hash('sha256', $key, true);
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($ciphertext === false) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '数据加密失败');
        }
        return base64_encode($iv . $tag . $ciphertext);
    }

    /**
     * 解密
     */
    public static function decrypt(string $encoded, string $key): string
    {
        $key = hash('sha256', $key, true);
        $raw = base64_decode($encoded, true);
        // 最短合法长度 = iv 12 + tag 16(空串明文密文段为 0 字节)
        if ($raw === false || strlen($raw) < 28) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '数据解密失败');
        }
        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $ciphertext = substr($raw, 28);
        $plaintext = openssl_decrypt($ciphertext, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($plaintext === false) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '数据解密失败');
        }
        return $plaintext;
    }
}
