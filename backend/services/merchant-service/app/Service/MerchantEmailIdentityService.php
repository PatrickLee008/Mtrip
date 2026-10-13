<?php

declare(strict_types=1);

namespace App\Service;

use Closure;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/** Global email identity shared by onboarding applications and login accounts. */
final class MerchantEmailIdentityService
{
    public static function transaction(string $emailHash, Closure $callback): mixed
    {
        self::assertHash($emailHash);
        try {
            return Db::transaction(function () use ($emailHash, $callback): mixed {
                // Upsert takes an exclusive lock without upgrading INSERT IGNORE's shared lock.
                Db::statement('INSERT INTO merchant_email_identity_lock (email_hash) VALUES (?) '
                    . 'ON DUPLICATE KEY UPDATE email_hash = VALUES(email_hash)', [$emailHash]);
                return $callback();
            });
        } catch (\PDOException $e) {
            if ((string) $e->getCode() === '23000' && (str_contains($e->getMessage(), 'uk_registration_email_identity')
                || str_contains($e->getMessage(), 'uk_merchant_account_email_identity'))) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该邮箱已被占用，请联系管理员');
            }
            throw $e;
        }
    }

    public static function assertAvailable(string $emailHash, int $applicationId = 0, int $accountId = 0): void
    {
        self::assertHash($emailHash);
        $application = Db::table('merchant_application')->where('registration_email_identity_key', $emailHash)
            ->whereNull('registration_email_released_at')->where('id', '<>', $applicationId)
            ->first(['id']);
        $account = Db::table('merchant_admin')->where('email_identity_key', $emailHash)
            ->whereNull('email_released_at')->where('id', '<>', $accountId)
            ->first(['id']);
        if ($application || $account) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该邮箱无法用于新商户注册，请登录、恢复原申请或联系管理员');
        }
    }

    public static function assertRegistrationContacts(int $siteId, string $phoneHash, string $emailHash): void
    {
        $existing = Db::table('merchant_application')->where('site_id', $siteId)
            ->where('registration_phone_index', $phoneHash)->where('registration_email_index', $emailHash)
            ->where('merchant_id', 0)->whereNull('deleted_at')->whereNull('registration_email_released_at')
            ->whereNull('registration_phone_released_at')->first(['id']);
        self::assertAvailable($emailHash, $existing ? (int) $existing->id : 0);
        MerchantPhoneIdentityService::assertAvailable($phoneHash, $existing ? (int) $existing->id : 0);
    }

    private static function assertHash(string $emailHash): void
    {
        if (! preg_match('/^[a-f0-9]{64}$/D', $emailHash)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '注册邮箱检索信息不完整，请联系管理员');
        }
    }
}
