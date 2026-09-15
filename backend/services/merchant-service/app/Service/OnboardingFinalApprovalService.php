<?php

declare(strict_types=1);

namespace App\Service;

use App\Support\PasswordGenerator;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;

use function Hyperf\Config\config;

/** Converts one approved onboarding application into its formal entities. */
class OnboardingFinalApprovalService
{
    public function __construct(
        private readonly OnboardingKycService $kyc,
        private readonly OnboardingCredentialDeliveryService $delivery
    ) {
    }

    /** @param list<string> $channels */
    public function approve(int $applicationId, string $requestId, array $channels): array
    {
        if (! AdminContext::isSuper()) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅超级管理员可执行最终批准');
        }
        if (! preg_match('/^[A-Za-z0-9_-]{8,80}$/D', $requestId)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '缺少有效 requestId');
        }

        $result = Db::transaction(function () use ($applicationId, $requestId, $channels): array {
            $app = Db::table('merchant_application')->where('id', $applicationId)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $app) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '入驻申请不存在');
            }
            $app = (array) $app;
            if ((int) ($app['state_model_version'] ?? 0) < 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '旧入驻申请不能使用新最终批准流程');
            }
            if ((string) ($app['final_approval_request_id'] ?? '') !== '') {
                if (! hash_equals((string) $app['final_approval_request_id'], $requestId)) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '该申请已由其他最终批准请求完成');
                }
                return $this->result($app);
            }
            if ((int) $app['merchant_id'] > 0 || (int) $app['account_status'] !== 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '申请已存在正式实体或账号状态异常');
            }
            if ((int) $app['contact_data_status'] !== 0
                || (string) $app['registration_phone'] === '' || (string) $app['registration_email'] === '') {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '最终批准前必须完成手机号和邮箱验证');
            }

            $businesses = Db::table('merchant_application_business')->where('application_id', $applicationId)
                ->orderBy('id')->lockForUpdate()->get()->map(static fn ($row) => (array) $row)->all();
            Db::table('merchant_verify_document')->where('application_id', $applicationId)->whereNull('deleted_at')->lockForUpdate()->get();
            $readiness = $this->kyc->readiness($app);
            if (! $readiness['ready']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '最终批准门禁未通过：' . implode(',', $readiness['reasons']));
            }
            if ($businesses === []) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '申请没有首批物业');
            }
            foreach ($businesses as $business) {
                if ((int) $business['site_id'] !== (int) $app['site_id'] || (int) $business['kyc_status'] !== 5) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '首批物业站点或 KYC 状态不一致');
                }
                if (Db::table('merchant_store')->where('source_business_id', $business['id'])->exists()) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '首批物业已经转换');
                }
            }

            $channels = $this->channels($app, $channels);
            $now = gmdate('Y-m-d H:i:s');
            $merchantCode = $this->merchantCode((string) ($app['merchant_code'] ?? ''));
            $accessCode = $this->accessCode((string) $app['primary_business_type']);
            $firstBusiness = $businesses[0];
            $merchantId = (int) Db::table('merchant_info')->insertGetId([
                'merchant_code' => $merchantCode,
                'site_id' => (int) $app['site_id'],
                'merchant_name' => (string) ($app['merchant_name'] ?: $app['company_name']),
                'merchant_short_name' => (string) ($app['merchant_name'] ?: $app['company_name']),
                'merchant_type' => (string) $app['primary_business_type'] === 'hotel' ? 1 : 3,
                'credit_code' => (string) $app['reg_number'],
                'legal_person' => '',
                'contact_name' => (string) $firstBusiness['contact_name'],
                'contact_phone' => (string) $app['registration_phone'],
                'contact_phone_index' => $app['registration_phone_index'],
                'contact_email' => $this->decrypt((string) $app['registration_email']),
                'address' => (string) $app['address'],
                'status' => 1,
                'audit_remark' => '入驻最终批准',
                'audit_by' => AdminContext::adminId(),
                'audit_time' => $now,
                'access_code' => $accessCode,
                'credential_channels' => implode(',', $channels),
            ]);
            $username = $this->username($merchantId);
            $temporaryPassword = PasswordGenerator::random();
            $accountId = (int) Db::table('merchant_admin')->insertGetId([
                'site_id' => (int) $app['site_id'], 'account_type' => 2, 'merchant_id' => $merchantId,
                'username' => $username, 'password' => password_hash($temporaryPassword, PASSWORD_BCRYPT),
                'real_name' => (string) $firstBusiness['contact_name'],
                'mobile' => (string) $app['registration_phone'], 'mobile_index' => $app['registration_phone_index'],
                'email' => (string) $app['registration_email'], 'email_index' => $app['registration_email_index'],
                'is_owner' => 1, 'status' => 2,
            ]);

            $propertyIds = [];
            foreach ($businesses as $index => $business) {
                $propertyId = (int) Db::table('merchant_store')->insertGetId([
                    'site_id' => (int) $app['site_id'], 'merchant_id' => $merchantId,
                    'store_name' => (string) $business['business_name'], 'business_type' => (string) $business['business_type'],
                    'source_business_id' => (int) $business['id'], 'contact_name' => (string) $business['contact_name'],
                    'contact_phone' => (string) $business['contact_phone'], 'address' => (string) $business['address'],
                    'country_code' => (string) $business['country_code'], 'city_key' => (string) $business['city_key'],
                    'is_main' => $index === 0 ? 1 : 0, 'status' => 2,
                    'kyc_status' => 1, 'kyc_template_id' => (int) $business['kyc_template_id'],
                    'kyc_version' => (int) $business['kyc_version'], 'kyc_submitted_at' => $business['kyc_submitted_at'],
                    'kyc_approved_at' => $business['kyc_approved_at'] ?: $now, 'kyc_reject_reason' => '',
                    'display_enabled' => 0, 'mapping_version' => 1, 'operating_status' => 2,
                ]);
                $propertyIds[(int) $business['id']] = $propertyId;
            }
            $this->attachDocuments($applicationId, $merchantId, $propertyIds);
            Db::table('merchant_verify_timeline')->where('application_id', $applicationId)->update(['merchant_id' => $merchantId]);
            Db::table('merchant_application')->where('id', $applicationId)->update([
                'merchant_id' => $merchantId, 'merchant_code' => $merchantCode, 'account_status' => 1,
                'stage' => 5, 'final_approval_request_id' => $requestId, 'final_approved_at' => $now,
                'last_updated_at' => $now,
            ]);
            Db::table('merchant_verify_timeline')->insert([
                'site_id' => (int) $app['site_id'], 'merchant_id' => $merchantId, 'application_id' => $applicationId,
                'action' => 'final_approved', 'actor_type' => 2, 'operator_id' => AdminContext::adminId(),
                'operator_name' => AdminContext::adminName(), 'note' => '已创建正式商户、主账号和' . count($propertyIds) . '家首批物业',
                'is_exception' => 0,
            ]);
            $this->delivery->create($app, $merchantId, $accountId, $requestId, $channels, [
                'accessCode' => $accessCode, 'username' => $username, 'temporaryPassword' => $temporaryPassword,
            ]);
            return [
                'applicationId' => $applicationId, 'merchantId' => $merchantId, 'accountId' => $accountId,
                'propertyIds' => array_values($propertyIds), 'accessCode' => $accessCode,
                'accountStatus' => 'pending_activation', 'finalApprovedAt' => $now,
                'testMode' => MerchantAuthTestMode::enabled(),
            ];
        });

        $result['deliveries'] = $this->delivery->deliverApplication($applicationId);
        return $result;
    }

    public function status(int $applicationId): ?array
    {
        $app = Db::table('merchant_application')->where('id', $applicationId)->whereNull('deleted_at')->first();
        if (! $app || (int) $app->merchant_id <= 0 || ! $app->final_approved_at) {
            return null;
        }
        $this->assertSite((int) $app->site_id);
        return $this->result((array) $app);
    }

    private function result(array $app): array
    {
        $merchant = Db::table('merchant_info')->where('id', $app['merchant_id'])->where('site_id', $app['site_id'])->first();
        $account = Db::table('merchant_admin')->where('merchant_id', $app['merchant_id'])->where('account_type', 2)
            ->where('is_owner', 1)->whereNull('deleted_at')->first();
        if (! $merchant || ! $account) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '最终批准结果不完整');
        }
        return [
            'applicationId' => (int) $app['id'], 'merchantId' => (int) $merchant->id, 'accountId' => (int) $account->id,
            'propertyIds' => Db::table('merchant_store')->where('merchant_id', $merchant->id)->whereNotNull('source_business_id')->orderBy('id')->pluck('id')->map('intval')->all(),
            'accessCode' => (string) $merchant->access_code,
            'accountStatus' => (int) $app['account_status'] === 1 ? 'pending_activation' : 'active',
            'finalApprovedAt' => (string) $app['final_approved_at'],
            'testMode' => MerchantAuthTestMode::enabled(),
            'deliveries' => $this->delivery->receipts((int) $app['id']),
        ];
    }

    /** @param list<string> $requested @return list<string> */
    private function channels(array $app, array $requested): array
    {
        $verified = (string) ($app['registration_channel'] ?? '');
        // Admin-entered contacts use email delivery; the source remains distinguishable from OTP.
        if ($verified === 'admin') $verified = 'email';
        if (! in_array($verified, ['email', 'sms'], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '申请缺少已验证的注册渠道');
        }
        $channels = array_values(array_unique(array_map(static fn ($value): string => strtolower(trim((string) $value)), $requested)));
        if ($channels === []) {
            $channels = [$verified, 'inapp'];
        }
        foreach ($channels as $channel) {
            if (! in_array($channel, ['email', 'sms', 'inapp'], true)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '投递渠道不受支持');
            }
            if ($channel !== 'inapp' && $channel !== $verified) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '只能向已验证的注册渠道投递凭证');
            }
        }
        if (! in_array($verified, $channels, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '必须包含已验证的注册渠道');
        }
        return $channels;
    }

    private function merchantCode(string $existing): string
    {
        $row = Db::table('merchant_code_sequence')->where('id', 1)->lockForUpdate()->first();
        if (! $row) {
            Db::table('merchant_code_sequence')->insert(['id' => 1, 'next_value' => 1]);
            $next = 1;
        } else {
            $next = (int) $row->next_value;
        }
        if (preg_match('/^MCH-[0-9]+$/D', $existing)
            && ! Db::table('merchant_info')->where('merchant_code', $existing)->exists()) {
            return $existing;
        }
        do {
            $code = 'MCH-' . str_pad((string) $next, 4, '0', STR_PAD_LEFT);
            ++$next;
        } while (Db::table('merchant_info')->where('merchant_code', $code)->exists()
            || Db::table('merchant_application')->where('merchant_code', $code)->where('id', '<>', 0)->exists());
        Db::table('merchant_code_sequence')->where('id', 1)->update(['next_value' => $next]);
        return $code;
    }

    private function accessCode(string $businessType): string
    {
        $prefix = ['hotel' => 'H', 'car_rental' => 'C'][$businessType] ?? null;
        if ($prefix === null) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前主业态尚未定义访问码前缀');
        }
        for ($attempt = 0; $attempt < 50; ++$attempt) {
            $code = $this->accessCodeCandidate($prefix);
            if (! Db::table('merchant_info')->where('access_code_normalized', strtoupper($code))->exists()) {
                return $code;
            }
        }
        throw new BusinessException(ErrorCode::DATA_CONFLICT, '无法生成唯一访问码');
    }

    protected function accessCodeCandidate(string $prefix): string
    {
        $pool = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $suffix = '';
        for ($index = 0; $index < 5; ++$index) {
            $suffix .= $pool[random_int(0, strlen($pool) - 1)];
        }
        return $prefix . $suffix;
    }

    private function username(int $merchantId): string
    {
        $base = 'm' . str_pad((string) $merchantId, 6, '0', STR_PAD_LEFT);
        $username = $base;
        while (Db::table('merchant_admin')->where('username', $username)->exists()) {
            $username = $base . random_int(10, 99);
        }
        return $username;
    }

    /** @param array<int,int> $propertyIds */
    private function attachDocuments(int $applicationId, int $merchantId, array $propertyIds): void
    {
        $documents = Db::table('merchant_verify_document')->where('application_id', $applicationId)->whereNull('deleted_at')
            ->get()->map(static fn ($row) => (array) $row)->all();
        foreach ($documents as $document) {
            $businessId = (int) $document['application_business_id'];
            $propertyId = $businessId > 0 ? ($propertyIds[$businessId] ?? 0) : 0;
            if ((string) $document['scope_type'] === 'property' && $propertyId <= 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '物业 KYC 文档缺少正式物业映射');
            }
            Db::table('merchant_verify_document')->where('id', $document['id'])->update([
                'merchant_id' => $merchantId, 'property_id' => $propertyId,
            ]);
            Db::table('merchant_verify_document_revision')->where('doc_id', $document['id'])->update([
                'merchant_id' => $merchantId, 'property_id' => $propertyId,
            ]);
            Db::table('merchant_document_event')->where('doc_id', $document['id'])->update([
                'merchant_id' => $merchantId, 'property_id' => $propertyId,
            ]);
        }
    }

    private function decrypt(string $ciphertext): string
    {
        try {
            return CryptoHelper::decrypt($ciphertext, (string) config('mtrip.aes_key'));
        } catch (\Throwable) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已验证联系方式无法解密');
        }
    }

    private function assertSite(int $siteId): void
    {
        if (! AdminContext::isSuper() && AdminContext::siteId() !== $siteId) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
    }
}
