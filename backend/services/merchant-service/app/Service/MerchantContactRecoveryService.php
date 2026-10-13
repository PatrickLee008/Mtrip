<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;

use function Hyperf\Config\config;

/** Human-reviewed contact correction never establishes an OTP verification proof. */
final class MerchantContactRecoveryService
{
    public function correct(int $merchantId, string $phone, string $email, string $reason): array
    {
        if (! AdminContext::isSuper()) throw new BusinessException(ErrorCode::FORBIDDEN);
        if (mb_strlen(trim($reason)) < 10 || mb_strlen($reason) > 500) throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写至少 10 字的身份核验依据和换绑原因');
        $account = Db::table('merchant_admin')->where('merchant_id', $merchantId)->where('account_type', 2)
            ->where('is_owner', 1)->whereNull('deleted_at')->first();
        if (! $account || ! Db::table('merchant_info')->where('id', $merchantId)->where('site_id', $account->site_id)->whereNull('deleted_at')->exists()) {
            throw new BusinessException(ErrorCode::NOT_FOUND);
        }
        $phone = preg_replace('/[\s().-]+/', '', trim($phone)) ?? '';
        $email = strtolower(trim($email));
        if (! preg_match('/^\+[1-9]\d{6,14}$/D', $phone) || strlen($email) > 100 || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请提供完整 E.164 手机号和有效邮箱');
        }
        $aes = (string) config('mtrip.aes_key');
        $phoneHash = hash_hmac('sha256', 'merchant-registration-phone-v1:' . $phone, $aes);
        $emailHash = hash_hmac('sha256', 'merchant-registration-email-v1:' . $email, $aes);
        return MerchantPhoneIdentityService::changeTransaction([(string) $account->email_index, $emailHash], [(string) $account->mobile_index, $phoneHash], function () use ($account, $phone, $email, $phoneHash, $emailHash, $reason, $aes): array {
            $current = Db::table('merchant_admin')->where('id', $account->id)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $current || $current->email_index !== $account->email_index || $current->mobile_index !== $account->mobile_index) throw new BusinessException(ErrorCode::DATA_CONFLICT, '联系方式已变更，请刷新重试');
            $app = Db::table('merchant_application')->where('merchant_id', $current->merchant_id)->where('site_id', $current->site_id)->lockForUpdate()->first();
            if (! $app) throw new BusinessException(ErrorCode::DATA_CONFLICT, '缺少关联入驻申请');
            MerchantEmailIdentityService::assertAvailable($emailHash, (int) $app->id, (int) $current->id);
            MerchantPhoneIdentityService::assertAvailable($phoneHash, (int) $app->id, (int) $current->id);
            $changes = []; $appChanges = []; $now = gmdate('Y-m-d H:i:s');
            foreach ([['email', 'registration_email', $email, $emailHash], ['mobile', 'registration_phone', $phone, $phoneHash]] as [$field, $applicationField, $value, $hash]) {
                if (hash_equals((string) $current->{$field . '_index'}, $hash) && ! $current->{$field . '_released_at'}) continue;
                Db::table('merchant_contact_identity_history')->insert([
                    'site_id' => $current->site_id, 'account_id' => $current->id, 'channel' => $field === 'email' ? 'email' : 'sms',
                    'contact_ciphertext' => $current->{$field}, 'contact_hash' => $current->{$field . '_index'},
                    'released_at' => $now, 'reason' => 'administrator_identity_review',
                ]);
                $encrypted = CryptoHelper::encrypt($value, $aes);
                $changes[$field] = $encrypted; $changes[$field . '_index'] = $hash;
                $changes[$field === 'email' ? 'verified_email_at' : 'verified_mobile_at'] = null;
                $changes[$field === 'email' ? 'test_verified_email_at' : 'test_verified_mobile_at'] = null;
                $changes[$field . '_verification_source'] = 'admin'; $changes[$field . '_released_at'] = null;
                $appChanges[$applicationField] = $encrypted; $appChanges[$applicationField . '_index'] = $hash;
                $appChanges[$applicationField . '_released_at'] = null;
                $appChanges[$field === 'email' ? 'registration_verified_email_at' : 'registration_verified_mobile_at'] = null;
            }
            if ($changes === []) throw new BusinessException(ErrorCode::PARAM_ERROR, '联系方式未变化');
            Db::table('merchant_admin')->where('id', $current->id)->update($changes + [
                'auth_version' => Db::raw('auth_version + 1'), 'challenge_hash' => null, 'challenge_expires_at' => null,
                'credential_expires_at' => (int) $current->status === 2 ? gmdate('Y-m-d H:i:s', time() - 1) : $current->credential_expires_at,
            ]);
            Db::table('merchant_application')->where('id', $app->id)->update($appChanges);
            Db::table('merchant_auth_challenge')->where('account_id', $current->id)->whereIn('status', ['pending', 'verified'])->update(['status' => 'expired']);
            Db::table('merchant_verify_timeline')->insert([
                'site_id' => $current->site_id, 'merchant_id' => $current->merchant_id, 'application_id' => $app->id,
                'action' => 'contact_corrected_after_identity_review', 'actor_type' => 2, 'operator_id' => AdminContext::adminId(),
                'operator_name' => AdminContext::adminName(), 'note' => trim($reason), 'is_exception' => 1,
            ]);
            Db::table('merchant_activity_log')->insert([
                'site_id' => $current->site_id, 'merchant_id' => $current->merchant_id, 'activity_type' => 'account_change',
                'description' => 'admin_contact_correction_sessions_revoked', 'performed_by' => AdminContext::adminName(),
                'performed_by_id' => AdminContext::adminId(), 'actor_type' => 'admin', 'target_account_id' => $current->id,
                'entity_type' => 'account', 'entity_id' => $current->id,
            ]);
            return ['accountId' => (int) $current->id, 'verificationRequired' => true];
        });
    }
}
