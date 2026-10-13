<?php

declare(strict_types=1);

namespace App\Service;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;

use function Hyperf\Config\config;

/** Registration contacts confirmed by an administrator, independently of OTP. */
class OnboardingAdminContactService
{
    public function fields(int $siteId, string $phone, string $email, int $applicationId = 0): array
    {
        $phone = preg_replace('/[\s().-]+/', '', trim($phone)) ?? '';
        $email = strtolower(trim($email));
        if (! preg_match('/^\+[1-9]\d{6,14}$/D', $phone)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '注册手机号必须包含国际区号，使用 E.164 格式');
        }
        if (strlen($email) > 100 || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '注册邮箱格式不正确');
        }
        $key = (string) config('mtrip.aes_key');
        if ($key === '') throw new BusinessException(ErrorCode::SERVER_ERROR, '数据加密密钥未配置');
        $phoneHash = hash_hmac('sha256', 'merchant-registration-phone-v1:' . $phone, $key);
        $emailHash = hash_hmac('sha256', 'merchant-registration-email-v1:' . $email, $key);
        (new MerchantDraftExpiryService())->expireContacts($emailHash, $phoneHash);
        MerchantEmailIdentityService::assertAvailable($emailHash, $applicationId);
        MerchantPhoneIdentityService::assertAvailable($phoneHash, $applicationId);
        return [
            'registration_channel' => 'admin',
            'registration_otp_source' => 'admin',
            'registration_contact_hash' => $emailHash,
            'registration_phone' => CryptoHelper::encrypt($phone, $key),
            'registration_phone_index' => $phoneHash,
            'registration_email' => CryptoHelper::encrypt($email, $key),
            'registration_email_index' => $emailHash,
            'contact_data_status' => 0,
        ];
    }
}
