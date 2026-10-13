<?php

declare(strict_types=1);

namespace App\Service;

use Closure;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/** Only owner login identities reserve phones; ordinary contact numbers do not. */
final class MerchantPhoneIdentityService
{
    public static function phoneTransaction(string $phoneHash, Closure $callback): mixed
    {
        self::assertHash($phoneHash);
        try {
            return Db::transaction(function () use ($phoneHash, $callback): mixed {
                Db::statement('INSERT INTO merchant_phone_identity_lock (phone_hash) VALUES (?) '
                    . 'ON DUPLICATE KEY UPDATE phone_hash = VALUES(phone_hash)', [$phoneHash]);
                return $callback();
            });
        } catch (\PDOException $e) {
            if ((string) $e->getCode() === '23000' && str_contains($e->getMessage(), 'uk_merchant_account_mobile_identity')) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该手机号已被占用，请联系管理员');
            }
            throw $e;
        }
    }

    public static function transaction(string $emailHash, string $phoneHash, Closure $callback): mixed
    {
        self::assertHash($phoneHash);
        return MerchantEmailIdentityService::transaction($emailHash, function () use ($phoneHash, $callback): mixed {
            try {
                Db::statement('INSERT INTO merchant_phone_identity_lock (phone_hash) VALUES (?) '
                    . 'ON DUPLICATE KEY UPDATE phone_hash = VALUES(phone_hash)', [$phoneHash]);
                return $callback();
            } catch (\PDOException $e) {
                if ((string) $e->getCode() === '23000' && (str_contains($e->getMessage(), 'uk_registration_phone_identity')
                    || str_contains($e->getMessage(), 'uk_merchant_account_mobile_identity'))) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '该手机号已被占用，请联系管理员');
                }
                throw $e;
            }
        });
    }

    /** Lock all old/new emails first, then all phones, in deterministic order. */
    public static function changeTransaction(array $emails, array $phones, Closure $callback): mixed
    {
        $emails = array_values(array_unique($emails)); sort($emails);
        $phones = array_values(array_unique($phones)); sort($phones);
        foreach ($phones as $phone) self::assertHash($phone);
        $lockEmails = function (int $index) use (&$lockEmails, $emails, $phones, $callback): mixed {
            if (isset($emails[$index])) return MerchantEmailIdentityService::transaction($emails[$index], fn () => $lockEmails($index + 1));
            foreach ($phones as $phone) Db::statement('INSERT INTO merchant_phone_identity_lock (phone_hash) VALUES (?) '
                . 'ON DUPLICATE KEY UPDATE phone_hash = VALUES(phone_hash)', [$phone]);
            return $callback();
        };
        return $lockEmails(0);
    }

    public static function assertAvailable(string $hash, int $applicationId = 0, int $accountId = 0): void
    {
        self::assertHash($hash);
        if (Db::table('merchant_application')->where('registration_phone_index', $hash)
            ->whereNull('registration_phone_released_at')->where('id', '<>', $applicationId)->exists()
            || Db::table('merchant_admin')->where('mobile_index', $hash)->where('account_type', 2)->where('is_owner', 1)
            ->whereNull('mobile_released_at')->where('id', '<>', $accountId)->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该手机号无法用于新商户注册，请登录、恢复原申请或联系管理员');
        }
    }

    private static function assertHash(string $hash): void
    {
        if (! preg_match('/^[a-f0-9]{64}$/D', $hash)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '注册手机号检索信息不完整，请联系管理员');
        }
    }
}
