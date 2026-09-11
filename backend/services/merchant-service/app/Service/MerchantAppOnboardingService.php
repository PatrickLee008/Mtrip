<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantPhoneIndex;

use function Hyperf\Config\config;

/** Public application and KYC actions owned by a completed registration OTP. */
class MerchantAppOnboardingService
{
    public function __construct(private readonly MerchantRegistrationOtpService $otp)
    {
    }

    /** @param array<string,mixed> $input */
    public function save(int $siteId, string $token, array $input): array
    {
        $claims = $this->otp->registrationClaims($siteId, $token);
        $applicationId = max(0, (int) ($input['applicationId'] ?? 0));
        $companyName = $this->required($input, 'companyName', 100);
        $businesses = $this->businesses($input, $claims);
        $now = gmdate('Y-m-d H:i:s');

        return Db::transaction(function () use ($siteId, $claims, $applicationId, $companyName, $businesses, $input, $now): array {
            if ($applicationId > 0) {
                $app = $this->owned($applicationId, $siteId, $claims, true);
                if ((int) $app['stage'] !== 0) throw new BusinessException(ErrorCode::DATA_CONFLICT, '申请已提交，不可再修改草稿');
                Db::table('merchant_application')->where('id', $applicationId)->update($this->applicationValues($input, $companyName, $businesses, $now));
            } else {
                $applicationId = (int) Db::table('merchant_application')->insertGetId(array_merge($this->applicationValues($input, $companyName, $businesses, $now), [
                    'site_id' => $siteId, 'app_no' => $this->appNo(), 'stage' => 0,
                    'registration_channel' => (string) $claims['channel'], 'registration_contact_hash' => (string) $claims['recipient_hash'],
                ]));
            }
            $existing = Db::table('merchant_application_business')->where('application_id', $applicationId)->orderBy('id')->get()->all();
            foreach ($businesses as $index => $business) {
                $values = $this->businessValues($siteId, $applicationId, $business);
                if (isset($existing[$index])) Db::table('merchant_application_business')->where('id', $existing[$index]->id)->update($values);
                else Db::table('merchant_application_business')->insert($values);
            }
            return $this->statusFor($this->owned($applicationId, $siteId, $claims));
        });
    }

    public function submit(int $siteId, string $token, int $applicationId): array
    {
        $claims = $this->otp->registrationClaims($siteId, $token);
        return Db::transaction(function () use ($siteId, $claims, $applicationId): array {
            $app = $this->owned($applicationId, $siteId, $claims, true);
            if ((int) $app['stage'] !== 0) throw new BusinessException(ErrorCode::DATA_CONFLICT, '申请已提交或已结束');
            $count = Db::table('merchant_application_business')->where('application_id', $applicationId)->count();
            if ($count <= 0) throw new BusinessException(ErrorCode::PARAM_ERROR, '请至少填写一家注册商家');
            $now = gmdate('Y-m-d H:i:s');
            Db::table('merchant_application')->where('id', $applicationId)->update(['stage' => 1, 'submitted_at' => $now, 'last_updated_at' => $now]);
            $this->timeline($app, 'app_submitted', 'Merchant App registration submitted');
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
        $this->assertKycReadable($app);
        $required = $this->requiredDocumentTypes((int) $app['kyc_template_id']);
        $documents = Db::table('merchant_verify_document')->where('application_id', $applicationId)->where('biz_unit', '')->whereNull('deleted_at')->orderBy('id')->get()->map(static fn ($doc) => [
            'id' => (int) $doc->id, 'docType' => (string) $doc->doc_type, 'name' => (string) $doc->name, 'required' => isset($required[(string) $doc->doc_type]),
            'fileUrl' => (string) $doc->file_url, 'fileSize' => (string) $doc->file_size,
        ])->all();
        return ['applicationId' => $applicationId, 'stage' => (int) $app['stage'], 'documents' => $documents];
    }

    public function upload(int $siteId, string $token, int $applicationId, string $docType, mixed $file): array
    {
        $app = $this->owned($applicationId, $siteId, $this->otp->registrationClaims($siteId, $token));
        $this->assertKycOpen($app);
        $doc = Db::table('merchant_verify_document')->where('application_id', $applicationId)->where('biz_unit', '')->where('doc_type', $docType)->whereNull('deleted_at')->lockForUpdate()->first();
        if (! $doc) throw new BusinessException(ErrorCode::PARAM_ERROR, '文件类型不在本次 KYC 要求中');
        if (! is_object($file) || ! method_exists($file, 'isValid') || ! $file->isValid()) throw new BusinessException(ErrorCode::PARAM_ERROR, '未接收到有效文件');
        $name = (string) $file->getClientFilename();
        $ext = strtolower((string) pathinfo($name, PATHINFO_EXTENSION));
        if (! in_array($ext, ['pdf', 'jpg', 'jpeg', 'png', 'webp'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR, '仅支持 PDF/JPG/JPEG/PNG/WebP 文件');
        $size = (int) $file->getSize();
        if ($size <= 0 || $size > 10 * 1024 * 1024) throw new BusinessException(ErrorCode::PARAM_ERROR, '文件大小须在 10MB 以内');
        $root = rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\');
        $prefix = rtrim((string) config('storage.url_prefix', '/uploads'), '/');
        $dir = '/kyc/' . $applicationId . '/' . gmdate('Ym'); $path = $dir . '/' . bin2hex(random_bytes(12)) . '.' . $ext;
        if (! is_dir($root . $dir) && ! @mkdir($root . $dir, 0775, true) && ! is_dir($root . $dir)) throw new BusinessException(ErrorCode::SERVER_ERROR, '上传目录创建失败');
        $file->moveTo($root . $path); if (! is_file($root . $path)) throw new BusinessException(ErrorCode::SERVER_ERROR, '文件保存失败'); @chmod($root . $path, 0664);
        $url = $prefix . $path; $now = gmdate('Y-m-d H:i:s');
        Db::transaction(function () use ($siteId, $applicationId, $doc, $name, $size, $url, $path, $ext, $now): void {
            Db::connection('system')->table('sys_file')->insert(['site_id' => $siteId, 'storage_id' => 0, 'file_name' => mb_substr($name, 0, 255), 'file_path' => $path, 'file_url' => $url, 'file_type' => $ext === 'pdf' ? 2 : 1, 'mime_type' => '', 'file_size' => $size, 'biz_type' => 'merchant_kyc', 'uploader_id' => 0]);
            Db::table('merchant_verify_document')->where('id', $doc->id)->update(['file_url' => $url, 'file_size' => (string) $size, 'name' => mb_substr($name, 0, 100), 'status' => 2, 'uploaded_at' => $now, 'updated_at' => $now]);
            Db::table('merchant_application_business')->where('application_id', $applicationId)->update(['kyc_status' => 0, 'kyc_submitted_at' => null, 'kyc_submitted_by' => 0]);
        });
        return ['id' => (int) $doc->id, 'docType' => $docType, 'fileUrl' => $url, 'fileName' => $name, 'fileSize' => (string) $size];
    }

    public function submitKyc(int $siteId, string $token, int $applicationId): array
    {
        $app = $this->owned($applicationId, $siteId, $this->otp->registrationClaims($siteId, $token), true);
        $this->assertKycOpen($app);
        $required = $this->requiredDocumentTypes((int) $app['kyc_template_id']);
        foreach (array_keys($required) as $docType) {
            if (! Db::table('merchant_verify_document')->where('application_id', $applicationId)->where('biz_unit', '')->where('doc_type', $docType)->where('file_url', '!=', '')->whereNull('deleted_at')->exists()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '请先上传全部必需 KYC 文件');
            }
        }
        $now = gmdate('Y-m-d H:i:s');
        Db::transaction(function () use ($applicationId, $now): void { Db::table('merchant_application_business')->where('application_id', $applicationId)->update(['kyc_status' => 2, 'kyc_submitted_at' => $now, 'kyc_submitted_by' => 0]); Db::table('merchant_application')->where('id', $applicationId)->update(['stage' => 4, 'confirmation_status' => 1, 'confirmed_at' => $now, 'last_updated_at' => $now]); });
        $this->timeline($app, 'kyc_submitted', 'Merchant App KYC submitted');
        return $this->statusFor($this->owned($applicationId, $siteId, $this->otp->registrationClaims($siteId, $token)));
    }

    /** @param array<string,mixed> $input @param array<string,mixed> $claims @return list<array<string,string>> */
    private function businesses(array $input, array $claims): array
    {
        $items = array_values(array_filter((array) ($input['businesses'] ?? []), static fn ($item): bool => is_array($item) && trim((string) ($item['businessName'] ?? '')) !== ''));
        if ($items === []) throw new BusinessException(ErrorCode::PARAM_ERROR, '请至少填写一家注册商家');
        $matched = false; $out = [];
        foreach ($items as $item) { $item = (array) $item; $email = strtolower(trim((string) ($item['contactEmail'] ?? ''))); $phone = trim((string) ($item['contactPhone'] ?? '')); if ($email !== '' && ! filter_var($email, FILTER_VALIDATE_EMAIL)) throw new BusinessException(ErrorCode::PARAM_ERROR, '业务邮箱格式不正确'); if ($phone !== '' && ! preg_match('/^\+?\d{6,20}$/', $phone)) throw new BusinessException(ErrorCode::PARAM_ERROR, '业务手机号格式不正确'); $channel = (string) $claims['channel']; $value = $channel === 'email' ? $email : $phone; if ($value !== '' && hash_equals((string) $claims['recipient_hash'], hash('sha256', $channel . ':' . strtolower($value)))) $matched = true; $out[] = ['businessName' => $this->text($item, 'businessName', 100), 'businessType' => '', 'city' => $this->text($item, 'city', 50), 'contactName' => $this->text($item, 'contactName', 50), 'contactPhone' => $phone, 'contactEmail' => $email]; }
        if (! $matched) throw new BusinessException(ErrorCode::PARAM_ERROR, '至少一位业务联系人必须与已验证的注册邮箱或手机号一致'); return $out;
    }
    /** @param array<string,mixed> $input @param list<array<string,string>> $businesses @return array<string,mixed> */
    private function applicationValues(array $input, string $companyName, array $businesses, string $now): array { return ['merchant_name' => $this->text($input, 'merchantName', 100) ?: $companyName, 'company_name' => $companyName, 'company_group_name' => $this->text($input, 'companyGroupName', 100), 'reg_number' => $this->text($input, 'regNumber', 50), 'country' => $this->text($input, 'country', 50), 'city' => $this->text($input, 'city', 50), 'address' => $this->text($input, 'address', 255), 'business_types' => implode(',', array_values(array_unique(array_column($businesses, 'businessType')))), 'num_businesses' => count($businesses), 'last_updated_at' => $now]; }
    /** @param array<string,string> $business @return array<string,mixed> */
    private function businessValues(int $siteId, int $applicationId, array $business): array { $phone = $business['contactPhone']; $aes = (string) config('mtrip.aes_key'); return ['site_id' => $siteId, 'application_id' => $applicationId, 'business_name' => $business['businessName'], 'business_type' => $business['businessType'], 'city' => $business['city'], 'contact_name' => $business['contactName'], 'contact_phone' => $phone === '' ? '' : \Mtrip\Shared\Support\CryptoHelper::encrypt($phone, $aes), 'contact_phone_index' => MerchantPhoneIndex::hash($phone, $aes), 'contact_email' => $business['contactEmail']]; }
    /** @param array<string,mixed> $claims */
    private function owned(int $id, int $siteId, array $claims, bool $lock = false): array { $query = Db::table('merchant_application')->where('id', $id)->where('site_id', $siteId)->where('registration_channel', $claims['channel'])->where('registration_contact_hash', $claims['recipient_hash'])->whereNull('deleted_at'); if ($lock) $query->lockForUpdate(); $app = $query->first(); if (! $app) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '申请不存在或无访问权限'); return (array) $app; }
    private function assertKycReadable(array $app): void { if (! in_array((int) $app['stage'], [3, 4], true)) throw new BusinessException(ErrorCode::FORBIDDEN, '请等待平台审核并发送 KYC 请求后查看文件要求'); }
    private function assertKycOpen(array $app): void { if ((int) $app['stage'] !== 3) throw new BusinessException(ErrorCode::FORBIDDEN, '请等待平台审核并发送 KYC 请求后再上传文件'); }
    /** @return array<string,true> */
    private function requiredDocumentTypes(int $templateId): array { $template = $templateId > 0 ? Db::table('merchant_kyc_template')->where('id', $templateId)->where('status', 1)->first() : null; $docs = $template ? json_decode((string) $template->docs, true) : []; $types = []; foreach (is_array($docs) ? $docs : [] as $doc) { $doc = (array) $doc; $type = trim((string) ($doc['doc_type'] ?? '')); if ($type !== '' && (bool) ($doc['required'] ?? true)) $types[$type] = true; } return $types; }
    private function statusFor(array $app): array { $stage = (int) $app['stage']; return ['applicationId' => (int) $app['id'], 'appNo' => (string) $app['app_no'], 'stage' => $stage, 'status' => match ($stage) { 0 => 'draft', 1, 2 => 'under_review', 3 => 'kyc_required', 4 => 'kyc_under_review', 5 => 'approved', 6 => 'rejected', default => 'unknown' }, 'canUploadKyc' => $stage === 3, 'canSubmitKyc' => $stage === 3, 'rejectReasonCode' => (int) $app['reject_reason_code'], 'rejectNote' => (string) $app['reject_note']]; }
    private function appNo(): string { return 'APP-' . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(4))); }
    /** @param array<string,mixed> $input */ private function required(array $input, string $key, int $limit): string { $value = $this->text($input, $key, $limit); if ($value === '') throw new BusinessException(ErrorCode::PARAM_ERROR, "参数 {$key} 不能为空"); return $value; }
    /** @param array<string,mixed> $input */ private function text(array $input, string $key, int $limit): string { return mb_substr(trim((string) ($input[$key] ?? '')), 0, $limit); }
    private function timeline(array $app, string $action, string $note): void { Db::table('merchant_verify_timeline')->insert(['site_id' => (int) $app['site_id'], 'merchant_id' => (int) $app['merchant_id'], 'application_id' => (int) $app['id'], 'action' => $action, 'actor_type' => 3, 'operator_id' => 0, 'operator_name' => 'Merchant App', 'note' => $note, 'is_exception' => 0]); }
}
