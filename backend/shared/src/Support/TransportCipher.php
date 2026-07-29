<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * 传输层 AES-256-CBC 加解密:登录/注册等敏感接口请求体加密(前端 crypto-js 兼容)
 * 格式:base64(IV 16字节 + 密文);key = sha256(密钥串) 32字节
 * 注意:存储层加密请使用 CryptoHelper(AES-256-GCM),两者用途不同不可混用
 */
class TransportCipher
{
    private const CIPHER = 'aes-256-cbc';

    private const IV_LEN = 16;

    /** 加密,输出 base64(iv + ciphertext) */
    public static function encrypt(string $plaintext, string $secret): string
    {
        $key = hash('sha256', $secret, true);
        $iv = random_bytes(self::IV_LEN);
        $ciphertext = openssl_encrypt($plaintext, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);
        if ($ciphertext === false) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '数据加密失败');
        }
        return base64_encode($iv . $ciphertext);
    }

    /** 解密 base64(iv + ciphertext),失败按参数错误处理(客户端密文非法) */
    public static function decrypt(string $encoded, string $secret): string
    {
        $key = hash('sha256', $secret, true);
        $raw = base64_decode($encoded, true);
        if ($raw === false || strlen($raw) <= self::IV_LEN) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '加密数据格式错误');
        }
        $iv = substr($raw, 0, self::IV_LEN);
        $ciphertext = substr($raw, self::IV_LEN);
        $plaintext = openssl_decrypt($ciphertext, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);
        if ($plaintext === false) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '加密数据解密失败');
        }
        return $plaintext;
    }
}
