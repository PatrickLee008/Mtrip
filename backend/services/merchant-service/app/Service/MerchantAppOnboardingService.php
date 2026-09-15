<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantPhoneIndex;
use Mtrip\Shared\Support\CryptoHelper;

use function Hyperf\Config\config;

/** Public application and KYC actions owned by a completed registration OTP. */
class MerchantAppOnboardingService
{
    private const BUSINESS_TYPES = ['hotel', 'car_rental', 'restaurant', 'airline', 'attraction'];

    public function __construct(
        private readonly MerchantRegistrationOtpService $otp,
        private readonly OnboardingKycService $kyc
    )
    {
    }

    /** @param array<string,mixed> $input */
    public function save(int $siteId, string $token, array $input): array
    {
        $claims = $this->otp->registrationClaims($siteId, $token);
        $applicationId = $this->applicationId($input, $claims);
        $now = gmdate('Y-m-d H:i:s');

        return Db::transaction(function () use ($siteId, $claims, $applicationId, $input, $now): array {
            $app = $this->owned($applicationId, $siteId, $claims, true);
            $this->assertRegistrationEditable($app);
            $patch = $this->applicationPatch($input);
            $patch['last_activity_at'] = $now;
            $patch['last_updated_at'] = $now;
            Db::table('merchant_application')->where('id', $applicationId)->update($patch);

            foreach (array_values(array_unique(array_map('intval', (array) ($input['removeBusinessIds'] ?? [])))) as $businessId) {
                if ($businessId > 0) {
                    Db::table('merchant_application_business')->where('id', $businessId)->where('application_id', $applicationId)->delete();
                }
            }
            if (array_key_exists('businesses', $input)) {
                foreach ((array) $input['businesses'] as $business) {
                    if (! is_array($business)) throw new BusinessException(ErrorCode::PARAM_ERROR, 'businesses 格式不正确');
                    $this->saveBusiness($siteId, $applicationId, $business);
                }
            }
            $this->refreshProgress($applicationId);
            return $this->detailFor($this->owned($applicationId, $siteId, $claims));
        });
    }

    public function detail(int $siteId, string $token, int $applicationId): array
    {
        return $this->detailFor($this->owned($applicationId, $siteId, $this->otp->registrationClaims($siteId, $token)));
    }

    public function submit(int $siteId, string $token, int $applicationId): array
    {
        $claims = $this->otp->registrationClaims($siteId, $token);
        return Db::transaction(function () use ($siteId, $claims, $applicationId): array {
            $app = $this->owned($applicationId, $siteId, $claims, true);
            if ((int) $app['registration_status'] === 1) return $this->statusFor($app);
            $this->assertRegistrationEditable($app);
            $this->assertRegistrationComplete($app);
            $now = gmdate('Y-m-d H:i:s');
            Db::table('merchant_application')->where('id', $applicationId)->update([
                'registration_status' => 1,
                'registration_reviewed_by' => 0,
                'registration_reviewed_at' => null,
                'registration_review_reason' => '',
                'current_step' => 4,
                'completion_percent' => 100,
                'submitted_at' => $now,
                'last_activity_at' => $now,
                'last_updated_at' => $now,
            ]);
            $this->timeline($app, (int) $app['registration_status'] === 4 ? 'registration_resubmitted' : 'registration_submitted', 'Merchant App registration submitted');
            return $this->statusFor($this->owned($applicationId, $siteId, $claims));
        });
    }

    public function status(int $siteId, string $token, int $applicationId): array
    {
        return $this->statusFor($this->owned($applicationId, $siteId, $this->otp->registrationClaims($siteId, $token)));
    }

    public function requirements(int $siteId, string $token, int $applicationId): array
    {
        $app = $this->owned($applicationId, $siteId, $this->otp->registrationClaims($siteId, $token));
        return $this->kyc->requirements($app);
    }

    public function upload(int $siteId, string $token, int $applicationId, string $scopeType, int $applicationBusinessId, string $docType, mixed $file): array
    {
        $app = $this->owned($applicationId, $siteId, $this->otp->registrationClaims($siteId, $token));
        return $this->kyc->upload($app, $scopeType, $applicationBusinessId, $docType, $file);
    }

    public function submitKyc(int $siteId, string $token, int $applicationId): array
    {
        $app = $this->owned($applicationId, $siteId, $this->otp->registrationClaims($siteId, $token));
        return $this->kyc->submit($app);
    }

    public function agreement(int $siteId, string $token, int $applicationId): array
    {
        return $this->kyc->agreement($this->owned($applicationId, $siteId, $this->otp->registrationClaims($siteId, $token)));
    }

    public function agreementRead(int $siteId, string $token, int $applicationId, int $agreementId, string $version, bool $scrollConfirmed): array
    {
        return $this->kyc->confirmAgreementRead($this->owned($applicationId, $siteId, $this->otp->registrationClaims($siteId, $token)), $agreementId, $version, $scrollConfirmed);
    }

    public function agreementSign(int $siteId, string $token, int $applicationId, int $agreementId, string $version, string $readReceipt, string $signerName, string $signerRole, string $signature, string $ipAddress, string $userAgent): array
    {
        return $this->kyc->sign($this->owned($applicationId, $siteId, $this->otp->registrationClaims($siteId, $token)), $agreementId, $version, $readReceipt, $signerName, $signerRole, $signature, $ipAddress, $userAgent);
    }

    /** @param array<string,mixed> $input @param array<string,mixed> $claims */
    private function applicationId(array $input, array $claims): int
    {
        $tokenId = (int) $claims['application_id'];
        $inputId = max(0, (int) ($input['applicationId'] ?? 0));
        if ($inputId > 0 && $inputId !== $tokenId) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '申请与注册凭证不匹配');
        return $tokenId;
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    private function applicationPatch(array $input): array
    {
        $map = [
            'merchantName' => ['merchant_name', 100], 'companyName' => ['company_name', 100],
            'companyGroupName' => ['company_group_name', 100], 'regNumber' => ['reg_number', 50],
            'country' => ['country', 50], 'city' => ['city', 50], 'address' => ['address', 255],
        ];
        $patch = [];
        foreach ($map as $key => [$column, $limit]) {
            if (array_key_exists($key, $input)) $patch[$column] = $this->text($input, $key, $limit);
        }
        if (array_key_exists('companyName', $input) && ! array_key_exists('merchantName', $input)) {
            $patch['merchant_name'] = $patch['company_name'];
        }
        if (array_key_exists('currentStep', $input)) {
            $step = (int) $input['currentStep'];
            if ($step < 0 || $step > 4) throw new BusinessException(ErrorCode::PARAM_ERROR, 'currentStep 仅支持 0-4');
            $patch['current_step'] = $step;
        }
        return $patch;
    }

    /** @param array<string,mixed> $input */
    private function saveBusiness(int $siteId, int $applicationId, array $input): void
    {
        $businessId = max(0, (int) ($input['applicationBusinessId'] ?? 0));
        $clientRef = $this->text($input, 'clientRef', 64);
        $query = Db::table('merchant_application_business')->where('application_id', $applicationId);
        $existing = $businessId > 0
            ? (clone $query)->where('id', $businessId)->lockForUpdate()->first()
            : ($clientRef !== '' ? (clone $query)->where('client_ref', $clientRef)->lockForUpdate()->first() : null);
        if ($businessId > 0 && ! $existing) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '注册业务不存在或无访问权限');
        if (! $existing && $clientRef === '') throw new BusinessException(ErrorCode::PARAM_ERROR, '新增注册业务必须提供 clientRef');
        if ($existing && $clientRef !== '' && (string) ($existing->client_ref ?? '') !== '' && (string) $existing->client_ref !== $clientRef) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'clientRef 与注册业务不匹配');
        }

        $values = [];
        $textMap = [
            'businessName' => ['business_name', 100], 'city' => ['city', 50],
            'cityKey' => ['city_key', 80], 'address' => ['address', 255],
            'contactName' => ['contact_name', 50],
        ];
        foreach ($textMap as $key => [$column, $limit]) {
            if (array_key_exists($key, $input)) $values[$column] = $this->text($input, $key, $limit);
        }
        if (array_key_exists('businessType', $input)) {
            $type = strtolower($this->text($input, 'businessType', 30));
            if ($type !== '' && ! in_array($type, self::BUSINESS_TYPES, true)) throw new BusinessException(ErrorCode::PARAM_ERROR, 'businessType 不受支持');
            $values['business_type'] = $type;
        }
        if (array_key_exists('countryCode', $input)) {
            $countryCode = strtoupper($this->text($input, 'countryCode', 2));
            if ($countryCode !== '' && ! preg_match('/^[A-Z]{2}$/D', $countryCode)) throw new BusinessException(ErrorCode::PARAM_ERROR, 'countryCode 必须为两位字母');
            $values['country_code'] = $countryCode;
        }
        if (array_key_exists('contactEmail', $input)) {
            $email = strtolower($this->text($input, 'contactEmail', 100));
            if ($email !== '' && ! filter_var($email, FILTER_VALIDATE_EMAIL)) throw new BusinessException(ErrorCode::PARAM_ERROR, '业务邮箱格式不正确');
            $values['contact_email'] = $email;
        }
        if (array_key_exists('contactPhone', $input)) {
            $phone = preg_replace('/[\s().-]+/', '', trim((string) $input['contactPhone'])) ?? '';
            if ($phone !== '' && ! preg_match('/^\+[1-9]\d{6,14}$/D', $phone)) throw new BusinessException(ErrorCode::PARAM_ERROR, '业务手机号必须为 E.164 格式');
            $aes = $this->aesKey();
            $values['contact_phone'] = $phone === '' ? '' : CryptoHelper::encrypt($phone, $aes);
            $values['contact_phone_index'] = $phone === '' ? null : MerchantPhoneIndex::hash($phone, $aes);
        }

        if ($existing) {
            if ($clientRef !== '' && (string) ($existing->client_ref ?? '') === '') $values['client_ref'] = $clientRef;
            if ($values !== []) Db::table('merchant_application_business')->where('id', (int) $existing->id)->update($values);
            return;
        }
        Db::table('merchant_application_business')->insert(array_merge([
            'site_id' => $siteId, 'application_id' => $applicationId, 'client_ref' => $clientRef,
            'business_name' => '', 'business_type' => '', 'city' => '', 'country_code' => '', 'city_key' => '',
            'address' => '', 'contact_name' => '', 'contact_phone' => '', 'contact_phone_index' => null, 'contact_email' => '',
            'kyc_status' => 0,
        ], $values));
    }

    private function refreshProgress(int $applicationId): void
    {
        $app = (array) Db::table('merchant_application')->where('id', $applicationId)->first();
        $businesses = Db::table('merchant_application_business')->where('application_id', $applicationId)->orderBy('id')->get()->map(static fn ($row) => (array) $row)->all();
        $types = [];
        foreach ($businesses as $business) {
            $type = trim((string) $business['business_type']);
            if ($type !== '' && ! in_array($type, $types, true)) $types[] = $type;
        }
        $completeBusinesses = $businesses !== [];
        foreach ($businesses as $business) $completeBusinesses = $completeBusinesses && $this->businessComplete($business);
        $checks = [
            trim((string) $app['company_name']) !== '', trim((string) $app['reg_number']) !== '',
            trim((string) $app['country']) !== '' && trim((string) $app['address']) !== '',
            $businesses !== [], $completeBusinesses,
        ];
        Db::table('merchant_application')->where('id', $applicationId)->update([
            'business_types' => implode(',', $types),
            'primary_business_type' => $types[0] ?? '',
            'num_businesses' => count($businesses),
            'completion_percent' => count(array_filter($checks)) * 20,
        ]);
    }

    private function assertRegistrationComplete(array $app): void
    {
        foreach (['company_name' => '公司名称', 'reg_number' => '公司注册号', 'country' => '注册国家', 'address' => '公司地址'] as $field => $label) {
            if (trim((string) $app[$field]) === '') throw new BusinessException(ErrorCode::PARAM_ERROR, $label . '不能为空');
        }
        $businesses = Db::table('merchant_application_business')->where('application_id', (int) $app['id'])->orderBy('id')->get()->map(static fn ($row) => (array) $row)->all();
        if ($businesses === []) throw new BusinessException(ErrorCode::PARAM_ERROR, '请至少填写一家注册业务');
        foreach ($businesses as $business) {
            if (! $this->businessComplete($business)) throw new BusinessException(ErrorCode::PARAM_ERROR, '请完整填写每一家注册业务及联系人信息');
        }
    }

    private function businessComplete(array $business): bool
    {
        foreach (['business_name', 'business_type', 'contact_name', 'contact_phone', 'contact_email'] as $field) {
            if (trim((string) ($business[$field] ?? '')) === '') return false;
        }
        if (! in_array((string) $business['business_type'], self::BUSINESS_TYPES, true)) return false;
        if ((string) $business['business_type'] === 'hotel') {
            foreach (['country_code', 'city_key', 'address'] as $field) if (trim((string) ($business[$field] ?? '')) === '') return false;
        }
        return true;
    }

    /** @param array<string,mixed> $claims */
    private function owned(int $id, int $siteId, array $claims, bool $lock = false): array { if ($id !== (int) $claims['application_id']) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '申请与注册凭证不匹配'); $query = Db::table('merchant_application')->where('id', $id)->where('site_id', $siteId)->where('registration_phone_index', $claims['phone_hash'])->where('registration_email_index', $claims['email_hash'])->whereNull('deleted_at'); if ($lock) $query->lockForUpdate(); $app = $query->first(); if (! $app) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '申请不存在或无访问权限'); return (array) $app; }
    private function assertRegistrationEditable(array $app): void { if (! in_array((int) $app['registration_status'], [0, 4], true)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前注册状态不可修改'); }
    private function statusFor(array $app): array
    {
        $registration = (int) $app['registration_status'];
        $kyc = (int) $app['merchant_kyc_status'];
        $account = (int) $app['account_status'];
        $properties = Db::table('merchant_application_business')->where('application_id', (int) $app['id'])->orderBy('id')->get()->map(static fn ($business) => [
            'applicationBusinessId' => (int) $business->id,
            'businessType' => (string) $business->business_type,
            'kycStatus' => match ((int) $business->kyc_status) { 0 => 'locked', 1 => 'draft', 2 => 'submitted', 3 => 'under_review', 4 => 'resubmit_required', 5 => 'approved', 6 => 'rejected', default => 'unknown' },
        ])->all();
        $status = [
            'applicationId' => (int) $app['id'], 'appNo' => (string) $app['app_no'], 'stage' => (int) $app['stage'],
            'registrationStatus' => match ($registration) { 0 => 'draft', 1 => 'submitted', 2 => 'under_review', 3 => 'approved', 4 => 'resubmit_required', 5 => 'rejected', default => 'unknown' },
            'merchantKycStatus' => match ($kyc) { 0 => 'locked', 1 => 'draft', 2 => 'submitted', 3 => 'under_review', 4 => 'resubmit_required', 5 => 'approved', 6 => 'rejected', default => 'unknown' },
            'accountStatus' => match ($account) { 0 => 'not_created', 1 => 'pending_activation', 2 => 'active', 3 => 'suspended', 4 => 'disabled', default => 'unknown' },
            'currentStep' => (int) $app['current_step'], 'completionPercent' => (int) $app['completion_percent'],
            'canEdit' => in_array($registration, [0, 4], true), 'canSubmit' => in_array($registration, [0, 4], true),
            'reviewReason' => (string) $app['registration_review_reason'], 'initialProperties' => $properties,
        ];
        if ($registration === 3 && $kyc > 0) {
            $details = $this->kyc->requirements($app);
            $status['merchantKyc'] = $details['merchantKyc'];
            $status['initialProperties'] = $details['initialProperties'];
            $status['agreement'] = $details['agreement'];
            $status['finalApproval'] = $details['finalApproval'];
        }
        return $status;
    }

    private function detailFor(array $app): array
    {
        $aes = $this->aesKey();
        $businesses = Db::table('merchant_application_business')->where('application_id', (int) $app['id'])->orderBy('id')->get()->map(static function ($business) use ($aes): array {
            $phone = (string) $business->contact_phone;
            try { $phone = $phone === '' ? '' : CryptoHelper::decrypt($phone, $aes); } catch (\Throwable) { $phone = ''; }
            return [
                'applicationBusinessId' => (int) $business->id, 'clientRef' => (string) ($business->client_ref ?? ''),
                'businessName' => (string) $business->business_name, 'businessType' => (string) $business->business_type,
                'countryCode' => (string) ($business->country_code ?? ''), 'city' => (string) $business->city,
                'cityKey' => (string) ($business->city_key ?? ''), 'address' => (string) ($business->address ?? ''),
                'contactName' => (string) $business->contact_name, 'contactPhone' => $phone,
                'contactEmail' => (string) $business->contact_email,
            ];
        })->all();
        $registrationPhone = '';
        $registrationEmail = '';
        try { $registrationPhone = CryptoHelper::decrypt((string) $app['registration_phone'], $aes); } catch (\Throwable) { }
        try { $registrationEmail = CryptoHelper::decrypt((string) $app['registration_email'], $aes); } catch (\Throwable) { }
        return array_merge($this->statusFor($app), [
            'application' => [
                'merchantName' => (string) $app['merchant_name'], 'companyName' => (string) $app['company_name'],
                'companyGroupName' => (string) $app['company_group_name'], 'regNumber' => (string) $app['reg_number'],
                'country' => (string) $app['country'], 'city' => (string) $app['city'], 'address' => (string) $app['address'],
                'registrationPhone' => $registrationPhone, 'registrationEmail' => $registrationEmail,
            ],
            'businesses' => $businesses,
        ]);
    }

    private function aesKey(): string { $key = (string) config('mtrip.aes_key'); if ($key === '') throw new BusinessException(ErrorCode::SERVER_ERROR, '数据加密密钥未配置'); return $key; }
    /** @param array<string,mixed> $input */ private function text(array $input, string $key, int $limit): string { return mb_substr(trim((string) ($input[$key] ?? '')), 0, $limit); }
    private function timeline(array $app, string $action, string $note): void { Db::table('merchant_verify_timeline')->insert(['site_id' => (int) $app['site_id'], 'merchant_id' => (int) $app['merchant_id'], 'application_id' => (int) $app['id'], 'action' => $action, 'actor_type' => 3, 'operator_id' => 0, 'operator_name' => 'Merchant App', 'note' => $note, 'is_exception' => 0]); }
}
