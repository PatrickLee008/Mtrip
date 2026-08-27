<?php
declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/** 仅完整号码精确检索；不推测国家区号，不存储明文或无密钥摘要。 */
final class MerchantPhoneIndex
{
    public static function hash(string $phone, string $key): ?string
    {
        $phone = preg_replace('/[\s().-]+/', '', trim($phone));
        if (! preg_match('/^\+?[0-9]{7,17}$/D', $phone)) {
            return null;
        }
        $phone = ltrim($phone, '+');
        if (str_starts_with($phone, '00')) {
            $phone = substr($phone, 2);
        }
        if (strlen($phone) < 7 || strlen($phone) > 15) {
            return null;
        }
        if ($key === '') {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '手机号检索密钥未配置');
        }
        return hash_hmac('sha256', 'm12-phone-v1:' . $phone, $key);
    }
}
