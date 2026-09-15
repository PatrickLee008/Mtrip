<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\JwtHelper;
use Psr\Http\Message\UploadedFileInterface;

use function Hyperf\Config\config;

/** Merchant and initial-property KYC share one application owner but keep separate states. */
class OnboardingKycService
{
    private const EDITABLE_KYC = [1, 4];
    private const FILE_STATUS = [
        0 => 'missing', 1 => 'approved', 2 => 'pending_review', 3 => 'rejected',
        4 => 'expired', 5 => 'resubmit_required',
    ];

    public function initialize(array $app): void
    {
        if ((int) $app['registration_status'] !== 3 || (int) $app['merchant_kyc_status'] === 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '基础注册通过后才能初始化 KYC');
        }
        $merchantTemplate = $this->template((int) $app['site_id'], 'merchant', 'unified');
        if (! $merchantTemplate) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '未配置商户主体 KYC 模板');
        }
        $businesses = Db::table('merchant_application_business')->where('application_id', $app['id'])->orderBy('id')->get()
            ->map(static fn ($row) => (array) $row)->all();
        if ($businesses === []) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '申请没有首批物业');
        }
        $propertyTemplates = [];
        foreach ($businesses as $business) {
            $template = $this->template((int) $app['site_id'], 'property', (string) $business['business_type']);
            if (! $template) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '未配置业务类型 ' . $business['business_type'] . ' 的物业 KYC 模板');
            }
            $propertyTemplates[(int) $business['id']] = $template;
        }

        Db::transaction(function () use ($app, $merchantTemplate, $businesses, $propertyTemplates): void {
            Db::table('merchant_application')->where('id', $app['id'])->update([
                'kyc_template_id' => (int) $merchantTemplate['id'],
                'last_updated_at' => gmdate('Y-m-d H:i:s'),
            ]);
            $this->ensureDocuments($app, $merchantTemplate, 0);
            foreach ($businesses as $business) {
                $template = $propertyTemplates[(int) $business['id']];
                $values = ['kyc_scope' => 2, 'kyc_template_id' => (int) $template['id']];
                if ((int) $business['kyc_status'] === 0) {
                    $values['kyc_status'] = 1;
                }
                Db::table('merchant_application_business')->where('id', $business['id'])->update($values);
                $this->ensureDocuments($app, $template, (int) $business['id']);
            }
        });
    }

    public function requirements(array $app): array
    {
        $this->assertReadable($app);
        $merchantTemplate = $this->templateById((int) $app['kyc_template_id'], 'merchant');
        $merchantDocs = $this->documents((int) $app['id'], 0, $merchantTemplate);
        $properties = [];
        $businesses = $this->businesses((int) $app['id']);
        foreach ($businesses as $business) {
            $template = $this->templateById((int) $business['kyc_template_id'], 'property');
            $properties[] = [
                'applicationBusinessId' => (int) $business['id'],
                'businessName' => (string) $business['business_name'],
                'businessType' => (string) $business['business_type'],
                'kycStatus' => $this->kycStatus((int) $business['kyc_status'], true),
                'reviewReason' => (string) ($business['kyc_reject_reason'] ?? ''),
                'documents' => $this->documents((int) $app['id'], (int) $business['id'], $template),
            ];
        }
        return [
            'applicationId' => (int) $app['id'],
            'merchantKyc' => [
                'status' => $this->kycStatus((int) $app['merchant_kyc_status']),
                'reviewReason' => (string) $app['merchant_kyc_review_reason'],
                'documents' => $merchantDocs,
            ],
            'initialProperties' => $properties,
            'agreement' => $this->agreementState($app),
            'finalApproval' => $this->readiness($app),
        ];
    }

    public function agreement(array $app): array
    {
        $this->assertReadable($app);
        $agreement = $this->activeAgreement((int) $app['site_id']);
        $state = $this->agreementState($app, $agreement);
        return array_merge($state, [
            'agreementId' => (int) $agreement['id'],
            'title' => (string) $agreement['title'],
            'content' => (string) $agreement['content'],
            'contentSha256' => (string) $agreement['content_sha256'],
        ]);
    }

    public function confirmAgreementRead(array $app, int $agreementId, string $version, bool $scrollConfirmed): array
    {
        $this->assertReadable($app);
        if (! $scrollConfirmed) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '必须确认已滚动阅读完整条款');
        }
        $agreement = $this->activeAgreement((int) $app['site_id']);
        if ((int) $agreement['id'] !== $agreementId || ! hash_equals((string) $agreement['agreement_version'], $version)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '条款版本已更新，请重新阅读');
        }
        $confirmedAt = time();
        return [
            'readReceipt' => JwtHelper::issue([
                'type' => 'onboarding_terms_read', 'site_id' => (int) $app['site_id'],
                'application_id' => (int) $app['id'], 'agreement_id' => $agreementId,
                'agreement_version' => $version, 'agreement_sha256' => (string) $agreement['content_sha256'],
                'confirmed_at' => $confirmedAt,
            ], $this->jwtKey(), 1800),
            'confirmedAt' => gmdate('Y-m-d H:i:s', $confirmedAt),
        ];
    }

    public function sign(
        array $app,
        int $agreementId,
        string $version,
        string $readReceipt,
        string $signerName,
        string $signerRole,
        string $signature,
        string $ipAddress,
        string $userAgent
    ): array {
        $this->assertReadable($app);
        $agreement = $this->activeAgreement((int) $app['site_id']);
        if ((int) $agreement['id'] !== $agreementId || ! hash_equals((string) $agreement['agreement_version'], $version)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '条款版本已更新，请重新阅读和签署');
        }
        $claims = JwtHelper::verify($readReceipt, $this->jwtKey());
        foreach (['site_id' => (int) $app['site_id'], 'application_id' => (int) $app['id'], 'agreement_id' => $agreementId] as $key => $expected) {
            if ((int) ($claims[$key] ?? 0) !== $expected) {
                throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '阅读凭据与申请不匹配');
            }
        }
        if (($claims['type'] ?? '') !== 'onboarding_terms_read'
            || ! hash_equals((string) ($claims['agreement_version'] ?? ''), $version)
            || ! hash_equals((string) ($claims['agreement_sha256'] ?? ''), (string) $agreement['content_sha256'])) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '阅读凭据对应的条款已失效');
        }
        $signerName = mb_substr(trim($signerName), 0, 100);
        $signerRole = mb_substr(trim($signerRole), 0, 100);
        if ($signerName === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '签署人姓名不能为空');
        }
        [$bytes, $ext] = $this->signatureBytes($signature);
        $root = rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\');
        $dir = '/kyc/' . (int) $app['id'] . '/signatures';
        if (! is_dir($root . $dir) && ! @mkdir($root . $dir, 0775, true) && ! is_dir($root . $dir)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '签名存储目录创建失败');
        }
        $path = $dir . '/' . bin2hex(random_bytes(16)) . '.' . $ext;
        if (file_put_contents($root . $path, $bytes, LOCK_EX) !== strlen($bytes)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '签名保存失败');
        }
        @chmod($root . $path, 0664);
        $url = rtrim((string) config('storage.url_prefix', '/uploads'), '/') . $path;
        try {
            $signatureId = Db::transaction(function () use ($app, $agreement, $signerName, $signerRole, $url, $bytes, $claims, $ipAddress, $userAgent): int {
                Db::table('merchant_application_signature')->where('site_id', $app['site_id'])
                    ->where('application_id', $app['id'])->where('status', 1)->update(['status' => 2]);
                $id = (int) Db::table('merchant_application_signature')->insertGetId([
                    'site_id' => (int) $app['site_id'], 'application_id' => (int) $app['id'],
                    'agreement_id' => (int) $agreement['id'], 'agreement_version' => (string) $agreement['agreement_version'],
                    'agreement_sha256' => (string) $agreement['content_sha256'], 'signer_name' => $signerName,
                    'signer_role' => $signerRole, 'signature_file_url' => $url,
                    'signature_sha256' => hash('sha256', $bytes),
                    'terms_read_at' => gmdate('Y-m-d H:i:s', (int) $claims['confirmed_at']),
                    'signed_at' => gmdate('Y-m-d H:i:s'), 'ip_address' => mb_substr($ipAddress, 0, 45),
                    'user_agent' => mb_substr($userAgent, 0, 500), 'status' => 1,
                ]);
                Db::table('merchant_application')->where('id', $app['id'])->update([
                    'active_signature_id' => $id, 'confirmation_status' => 1,
                    'confirmed_at' => gmdate('Y-m-d H:i:s'), 'last_updated_at' => gmdate('Y-m-d H:i:s'),
                ]);
                $this->timeline($app, 'agreement_signed', 'Merchant onboarding agreement signed: ' . $agreement['agreement_version']);
                return $id;
            });
        } catch (\Throwable $e) {
            if (is_file($root . $path)) {
                unlink($root . $path);
            }
            throw $e;
        }
        return ['signatureId' => $signatureId, 'agreementVersion' => (string) $agreement['agreement_version'], 'signedAt' => gmdate('Y-m-d H:i:s')];
    }

    public function upload(array $app, string $scopeType, int $applicationBusinessId, string $docType, ?UploadedFileInterface $file, bool $adminAssisted = false): array
    {
        $this->assertEditable($app, $scopeType, $applicationBusinessId);
        $scopeType = strtolower(trim($scopeType));
        if (! in_array($scopeType, ['merchant', 'property'], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'scopeType 仅支持 merchant/property');
        }
        if ($scopeType === 'merchant' && $applicationBusinessId !== 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '商户主体文件不能指定 applicationBusinessId');
        }
        if ($scopeType === 'property' && $applicationBusinessId <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '物业文件必须指定 applicationBusinessId');
        }
        $docType = mb_substr(trim($docType), 0, 50);
        if ($docType === '') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'docType 不能为空');
        }
        if (! $file || $file->getError() !== UPLOAD_ERR_OK || $file->getSize() <= 0 || $file->getSize() > 10 * 1024 * 1024) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择不超过 10MB 的有效文件');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer((string) $file->getStream());
        $ext = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
        if ($ext === null) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '仅支持有效 PDF/JPEG/PNG/WebP 文件');
        }
        $doc = Db::table('merchant_verify_document')->where('application_id', $app['id'])
            ->where('scope_type', $scopeType)->where('application_business_id', $applicationBusinessId)
            ->where('doc_type', $docType)->whereNull('deleted_at')->first();
        if (! $doc || (int) $doc->scope_resolution_status === 2) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '文件类型不在当前 KYC 范围中');
        }
        if ($this->scopeStatus($app, $scopeType, $applicationBusinessId) === 4 && ! in_array((int) $doc->status, [0, 3, 4, 5], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '重交时只能替换被退回的文件');
        }

        $root = rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\');
        $dir = '/kyc/' . (int) $app['id'] . '/' . ($scopeType === 'merchant' ? 'merchant' : 'property-' . $applicationBusinessId);
        if (! is_dir($root . $dir) && ! @mkdir($root . $dir, 0775, true) && ! is_dir($root . $dir)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '上传目录创建失败');
        }
        $path = $dir . '/' . bin2hex(random_bytes(16)) . '.' . $ext;
        $file->moveTo($root . $path);
        if (! is_file($root . $path)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '文件保存失败');
        }
        @chmod($root . $path, 0664);
        $url = rtrim((string) config('storage.url_prefix', '/uploads'), '/') . $path;
        try {
            return Db::transaction(function () use ($app, $doc, $file, $mime, $ext, $path, $url, $root, $adminAssisted): array {
                $locked = (array) Db::table('merchant_verify_document')->where('id', $doc->id)->lockForUpdate()->first();
                $currentApp = Db::table('merchant_application')->where('id', $app['id'])
                    ->where('site_id', $app['site_id'])->whereNull('deleted_at')->lockForUpdate()->first();
                if (! $currentApp) {
                    throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '申请不存在或无访问权限');
                }
                $this->assertEditable((array) $currentApp, (string) $locked['scope_type'], (int) $locked['application_business_id']);
                if ((int) $locked['document_version'] > 0 || (string) $locked['file_url'] !== '') {
                    (new MerchantDocumentService())->snapshot($locked, 'merchant_app');
                }
                $version = (int) $locked['document_version'] + 1;
                $now = gmdate('Y-m-d H:i:s');
                $name = mb_substr(basename((string) $file->getClientFilename()), 0, 100);
                Db::connection('system')->table('sys_file')->insert([
                    'site_id' => (int) $app['site_id'], 'storage_id' => 0, 'file_name' => $name,
                    'file_path' => $path, 'file_url' => $url, 'file_type' => $ext === 'pdf' ? 2 : 1,
                    'mime_type' => $mime, 'file_size' => filesize($root . $path), 'biz_type' => 'merchant_kyc', 'uploader_id' => $adminAssisted ? \Mtrip\Shared\Context\AdminContext::adminId() : 0,
                ]);
                Db::table('merchant_verify_document')->where('id', $locked['id'])->update([
                    'document_version' => $version, 'file_url' => $url, 'file_size' => (string) filesize($root . $path),
                    'name' => $name, 'status' => 2, 'reviewer_id' => 0, 'reviewer_name' => '',
                    'reject_reason' => '', 'last_verified_at' => null, 'resubmit_required_at' => null,
                    'uploaded_at' => $now, 'updated_at' => $now,
                ]);
                $saved = (array) Db::table('merchant_verify_document')->where('id', $locked['id'])->first();
                (new MerchantDocumentService())->snapshot($saved, $adminAssisted ? 'admin_assisted' : 'merchant_app', hash_file('sha256', $root . $path));
                Db::table('merchant_document_event')->insert([
                    'site_id' => $saved['site_id'], 'merchant_id' => 0, 'property_id' => 0, 'doc_id' => $saved['id'],
                    'version' => $version, 'action' => 'upload', 'status' => 2, 'reason' => '',
                    'actor_type' => $adminAssisted ? 'admin' : 'merchant',
                    'actor_id' => $adminAssisted ? \Mtrip\Shared\Context\AdminContext::adminId() : 0,
                    'actor_name' => $adminAssisted ? \Mtrip\Shared\Context\AdminContext::adminName() : 'Merchant App',
                ]);
                $this->timeline($app, 'kyc_document_uploaded', $saved['scope_type'] . ':' . $saved['doc_type'], false, $adminAssisted);
                return ['id' => (int) $saved['id'], 'scopeType' => (string) $saved['scope_type'],
                    'applicationBusinessId' => (int) $saved['application_business_id'], 'docType' => (string) $saved['doc_type'],
                    'fileName' => $name, 'fileSize' => (string) $saved['file_size'], 'documentVersion' => $version];
            });
        } catch (\Throwable $e) {
            if (is_file($root . $path)) {
                unlink($root . $path);
            }
            throw $e;
        }
    }

    public function submit(array $app, bool $adminAssisted = false): array
    {
        $this->assertReadable($app);
        $submitted = [];
        Db::transaction(function () use ($app, &$submitted, $adminAssisted): void {
            $locked = (array) Db::table('merchant_application')->where('id', $app['id'])->lockForUpdate()->first();
            $this->assertReadable($locked);
            if (! $this->agreementState($locked)['satisfied']) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '请先阅读并签署当前版本条款');
            }
            if (in_array((int) $locked['merchant_kyc_status'], self::EDITABLE_KYC, true)) {
                $this->assertFilesComplete((int) $app['id'], 0, (int) $locked['kyc_template_id']);
                Db::table('merchant_application')->where('id', $app['id'])->update([
                    'merchant_kyc_status' => 2, 'merchant_kyc_submitted_at' => gmdate('Y-m-d H:i:s'),
                    'merchant_kyc_review_reason' => '', 'last_updated_at' => gmdate('Y-m-d H:i:s'),
                ]);
                $submitted[] = 'merchant';
            }
            foreach ($this->businesses((int) $app['id'], true) as $business) {
                if (! in_array((int) $business['kyc_status'], self::EDITABLE_KYC, true)) {
                    continue;
                }
                $this->assertFilesComplete((int) $app['id'], (int) $business['id'], (int) $business['kyc_template_id']);
                Db::table('merchant_application_business')->where('id', $business['id'])->update([
                    'kyc_status' => 2, 'kyc_version' => (int) $business['kyc_version'] + 1,
                    'kyc_submitted_at' => gmdate('Y-m-d H:i:s'), 'kyc_submitted_by' => $adminAssisted ? \Mtrip\Shared\Context\AdminContext::adminId() : 0,
                    'kyc_reject_reason' => '',
                ]);
                $submitted[] = 'property:' . $business['id'];
            }
            if ($submitted !== []) {
                $this->timeline($app, 'kyc_submitted', 'Submitted scopes: ' . implode(',', $submitted), false, $adminAssisted);
            }
        });
        return ['submittedScopes' => $submitted, 'status' => $this->requirements((array) Db::table('merchant_application')->where('id', $app['id'])->first())];
    }

    public function readiness(array $app): array
    {
        $reasons = [];
        if ((int) ($app['contact_data_status'] ?? 1) !== 0
            || (string) ($app['registration_phone'] ?? '') === '' || (string) ($app['registration_email'] ?? '') === ''
            || ! in_array((string) ($app['registration_channel'] ?? ''), ['email', 'sms', 'admin'], true)) {
            $reasons[] = 'registration_contacts_not_verified';
        }
        if ((int) $app['registration_status'] !== 3) {
            $reasons[] = 'registration_not_approved';
        }
        if ((int) $app['merchant_kyc_status'] !== 5 || ! $this->approvedScopeValid((int) $app['id'], 0, (int) $app['kyc_template_id'])) {
            $reasons[] = 'merchant_kyc_not_approved';
        }
        $businesses = $this->businesses((int) $app['id']);
        foreach ($businesses as $business) {
            if ((int) $business['kyc_status'] !== 5
                || ! $this->approvedScopeValid((int) $app['id'], (int) $business['id'], (int) $business['kyc_template_id'])) {
                $reasons[] = 'property_kyc_not_approved:' . $business['id'];
            }
        }
        if ($businesses === []) {
            $reasons[] = 'initial_property_missing';
        }
        try {
            if (! $this->agreementState($app)['satisfied']) {
                $reasons[] = 'current_agreement_not_signed';
            }
        } catch (BusinessException) {
            $reasons[] = 'active_agreement_missing';
        }
        return ['ready' => $reasons === [], 'reasons' => $reasons];
    }

    public function syncScope(array $doc): void
    {
        if ((int) ($doc['application_id'] ?? 0) <= 0 || (int) ($doc['merchant_id'] ?? 0) !== 0) {
            return;
        }
        if ((int) ($doc['scope_resolution_status'] ?? 0) === 2) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '文档范围待人工处理，不能自动更新 KYC 状态');
        }
        $app = Db::table('merchant_application')->where('id', $doc['application_id'])->where('site_id', $doc['site_id'])->first();
        if (! $app || (int) $app->registration_status !== 3) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '文档不属于可审核的入驻申请');
        }
        $businessId = (string) $doc['scope_type'] === 'property' ? (int) $doc['application_business_id'] : 0;
        if ((string) $doc['scope_type'] === 'property' && $businessId <= 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '物业文档缺少首批物业归属');
        }
        $templateId = (int) $app->kyc_template_id;
        $scopeStatus = (int) $app->merchant_kyc_status;
        if ($businessId > 0) {
            $business = Db::table('merchant_application_business')->where('id', $businessId)
                ->where('application_id', $app->id)->where('site_id', $app->site_id)->lockForUpdate()->first();
            if (! $business) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '首批物业归属不一致');
            }
            $templateId = (int) $business->kyc_template_id;
            $scopeStatus = (int) $business->kyc_status;
        }
        if (! in_array($scopeStatus, [2, 3], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '只有已提交或审核中的 KYC 范围可以审核');
        }
        [$status, $reason] = $this->reviewedScopeStatus((int) $app->id, $businessId, $templateId);
        $now = gmdate('Y-m-d H:i:s');
        if ($businessId === 0) {
            Db::table('merchant_application')->where('id', $app->id)->update([
                'merchant_kyc_status' => $status, 'merchant_kyc_reviewed_by' => \Mtrip\Shared\Context\AdminContext::adminId(),
                'merchant_kyc_reviewed_at' => $now, 'merchant_kyc_review_reason' => mb_substr($reason, 0, 500),
            ]);
        } else {
            Db::table('merchant_application_business')->where('id', $businessId)->update([
                'kyc_status' => $status, 'kyc_approved_at' => $status === 5 ? $now : null,
                'kyc_reject_reason' => mb_substr($reason, 0, 500),
            ]);
        }
        Db::table('merchant_verify_timeline')->insert([
            'site_id' => (int) $app->site_id, 'merchant_id' => 0, 'application_id' => (int) $app->id,
            'action' => 'kyc_document_reviewed', 'actor_type' => 2,
            'operator_id' => \Mtrip\Shared\Context\AdminContext::adminId(),
            'operator_name' => \Mtrip\Shared\Context\AdminContext::adminName(),
            'note' => mb_substr($doc['scope_type'] . ':' . $doc['doc_type'] . ' status=' . $doc['status'], 0, 500),
            'is_exception' => (int) $doc['status'] === 1 ? 0 : 1,
        ]);
    }

    private function assertReadable(array $app): void
    {
        if ((int) $app['registration_status'] !== 3 || (int) $app['merchant_kyc_status'] === 0) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '基础注册通过后才能访问 KYC');
        }
    }

    private function assertEditable(array $app, string $scopeType, int $businessId = 0): void
    {
        $this->assertReadable($app);
        $status = $this->scopeStatus($app, strtolower(trim($scopeType)), $businessId);
        if (! in_array($status, self::EDITABLE_KYC, true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前 KYC 范围不可修改');
        }
    }

    private function scopeStatus(array $app, string $scopeType, int $businessId): int
    {
        if ($scopeType === 'merchant') {
            return (int) $app['merchant_kyc_status'];
        }
        if ($scopeType !== 'property' || $businessId <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'KYC 范围不正确');
        }
        $business = Db::table('merchant_application_business')->where('id', $businessId)
            ->where('application_id', $app['id'])->where('site_id', $app['site_id'])->first();
        if (! $business) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '首批物业不属于当前申请');
        }
        return (int) $business->kyc_status;
    }

    private function ensureDocuments(array $app, array $template, int $businessId): void
    {
        $scopeType = $businessId === 0 ? 'merchant' : 'property';
        foreach ($this->templateDocuments($template) as $required) {
            $exists = Db::table('merchant_verify_document')->where('application_id', $app['id'])
                ->where('scope_type', $scopeType)->where('application_business_id', $businessId)
                ->where('doc_type', $required['docType'])->whereNull('deleted_at')->exists();
            if ($exists) {
                continue;
            }
            Db::table('merchant_verify_document')->insert([
                'site_id' => (int) $app['site_id'], 'merchant_id' => 0, 'scope_type' => $scopeType,
                'property_id' => 0, 'application_id' => (int) $app['id'], 'application_business_id' => $businessId,
                'scope_resolution_status' => 0, 'scope_resolution_note' => '', 'scope_model_version' => 1,
                'biz_unit' => '', 'doc_type' => $required['docType'], 'name' => $required['name'],
                'file_url' => '', 'file_size' => '', 'status' => 0, 'uploaded_at' => gmdate('Y-m-d H:i:s'),
            ]);
        }
    }

    private function documents(int $applicationId, int $businessId, array $template): array
    {
        $rows = Db::table('merchant_verify_document')->where('application_id', $applicationId)
            ->where('scope_type', $businessId === 0 ? 'merchant' : 'property')
            ->where('application_business_id', $businessId)->whereNull('deleted_at')->get()->keyBy('doc_type');
        $documents = [];
        foreach ($this->templateDocuments($template) as $required) {
            $row = $rows->get($required['docType']);
            $documents[] = [
                'id' => $row ? (int) $row->id : 0, 'docType' => $required['docType'], 'name' => $required['name'],
                'required' => $required['required'], 'status' => self::FILE_STATUS[(int) ($row->status ?? 0)] ?? 'unknown',
                'hasFile' => $row && (string) $row->file_url !== '', 'fileName' => $row ? (string) $row->name : '',
                'fileSize' => $row ? (string) $row->file_size : '', 'documentVersion' => $row ? (int) $row->document_version : 0,
                'rejectReason' => $row ? (string) $row->reject_reason : '',
            ];
        }
        return $documents;
    }

    private function assertFilesComplete(int $applicationId, int $businessId, int $templateId): void
    {
        $template = $this->templateById($templateId, $businessId === 0 ? 'merchant' : 'property');
        $uploaded = Db::table('merchant_verify_document')->where('application_id', $applicationId)
            ->where('scope_type', $businessId === 0 ? 'merchant' : 'property')
            ->where('application_business_id', $businessId)->where('file_url', '!=', '')
            ->whereIn('status', [1, 2])->whereNull('deleted_at')->pluck('doc_type')
            ->map(static fn ($value) => (string) $value)->all();
        $missing = [];
        foreach ($this->templateDocuments($template) as $required) {
            if ($required['required'] && ! in_array($required['docType'], $uploaded, true)) {
                $missing[] = $required['name'];
            }
        }
        if ($missing !== []) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '请先上传全部必需文件：' . implode('、', $missing));
        }
    }

    private function reviewedScopeStatus(int $applicationId, int $businessId, int $templateId): array
    {
        $template = $this->templateById($templateId, $businessId === 0 ? 'merchant' : 'property');
        $rows = Db::table('merchant_verify_document')->where('application_id', $applicationId)
            ->where('scope_type', $businessId === 0 ? 'merchant' : 'property')
            ->where('application_business_id', $businessId)->whereNull('deleted_at')->get()->keyBy('doc_type');
        $complete = true;
        foreach ($rows as $row) {
            if (in_array((int) $row->status, [3, 4, 5], true)) {
                return [4, (string) $row->reject_reason];
            }
            if ((string) $row->file_url !== '' && (int) $row->status !== 1) {
                $complete = false;
            }
        }
        foreach ($this->templateDocuments($template) as $required) {
            if (! $required['required']) {
                continue;
            }
            $row = $rows->get($required['docType']);
            $status = (int) ($row->status ?? 0);
            if ($status !== 1 || (string) ($row->file_url ?? '') === '') {
                $complete = false;
            }
        }
        return $complete ? [5, ''] : [3, ''];
    }

    private function approvedScopeValid(int $applicationId, int $businessId, int $templateId): bool
    {
        try {
            $template = $this->templateById($templateId, $businessId === 0 ? 'merchant' : 'property');
        } catch (BusinessException) {
            return false;
        }
        $rows = Db::table('merchant_verify_document')->where('application_id', $applicationId)
            ->where('scope_type', $businessId === 0 ? 'merchant' : 'property')
            ->where('application_business_id', $businessId)->whereNull('deleted_at')->get()->keyBy('doc_type');
        foreach ($this->templateDocuments($template) as $required) {
            if (! $required['required']) {
                continue;
            }
            $row = $rows->get($required['docType']);
            if (! $row || (int) $row->status !== 1 || (string) $row->file_url === ''
                || ($row->expiry_date && (string) $row->expiry_date < gmdate('Y-m-d'))) {
                return false;
            }
        }
        return true;
    }

    public function testAgreementEnabled(): bool
    {
        return in_array((string) config('app_env', ''), ['dev', 'local', 'test'], true);
    }

    /** Test confirmation is deliberately not a merchant signature or uploaded signature image. */
    public function testConfirmAgreement(array $app, int $agreementId, string $version, string $reason): array
    {
        if (! $this->testAgreementEnabled() || ! \Mtrip\Shared\Context\AdminContext::isSuper()) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅开发/测试环境超级管理员可测试确认协议');
        }
        $reason = mb_substr(trim($reason), 0, 400);
        if ($reason === '') throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写测试原因');
        return Db::transaction(function () use ($app, $agreementId, $version, $reason): array {
            $app = (array) Db::table('merchant_application')->where('id', $app['id'])->where('site_id', $app['site_id'])
                ->whereNull('deleted_at')->lockForUpdate()->first();
            $this->assertReadable($app);
            if ((int) $app['merchant_id'] > 0 || (int) $app['account_status'] > 0) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '最终批准后不能测试确认协议');
            }
            $agreement = $this->activeAgreement((int) $app['site_id']);
            if ((int) $agreement['id'] !== $agreementId || $agreement['agreement_version'] !== $version) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '条款版本已更新，请刷新后重试');
            }
            $state = $this->agreementState($app, $agreement);
            if ($state['satisfied']) return $state;
            $now = gmdate('Y-m-d H:i:s');
            Db::table('merchant_application_signature')->where('application_id', $app['id'])->where('status', 1)->update(['status' => 2]);
            $id = Db::table('merchant_application_signature')->insertGetId([
                'site_id' => $app['site_id'], 'application_id' => $app['id'],
                'agreement_id' => $agreementId, 'agreement_version' => $version, 'agreement_sha256' => $agreement['content_sha256'],
                'signer_name' => \Mtrip\Shared\Context\AdminContext::adminName(), 'signer_role' => 'admin_test_confirmation',
                'signature_file_url' => 'test-only:admin-confirmation', 'signature_sha256' => hash('sha256', $reason),
                'terms_read_at' => $now, 'signed_at' => $now, 'status' => 1,
            ]);
            Db::table('merchant_application')->where('id', $app['id'])->update(['active_signature_id' => $id, 'last_updated_at' => $now]);
            $this->timeline($app, 'agreement_test_confirmed', 'TEST ONLY; agreement=' . $agreementId . '; version=' . $version . '; reason=' . $reason, true, true);
            return $this->agreementState(array_replace($app, ['active_signature_id' => $id]), $agreement);
        });
    }

    private function agreementState(array $app, ?array $agreement = null): array
    {
        $agreement ??= $this->activeAgreement((int) $app['site_id']);
        $signature = (int) ($app['active_signature_id'] ?? 0) > 0
            ? Db::table('merchant_application_signature')->where('id', $app['active_signature_id'])
                ->where('application_id', $app['id'])->where('site_id', $app['site_id'])->where('status', 1)->first()
            : null;
        $signed = $signature
            && (int) $signature->agreement_id === (int) $agreement['id']
            && hash_equals((string) $signature->agreement_version, (string) $agreement['agreement_version'])
            && hash_equals((string) $signature->agreement_sha256, (string) $agreement['content_sha256']);
        $testConfirmation = $signature && (string) $signature->signature_file_url === 'test-only:admin-confirmation';
        return [
            'status' => $signed ? ($testConfirmation ? 'test_confirmed' : 'signed') : ($signature ? 'resign_required' : 'unsigned'),
            'satisfied' => $signed && (! $testConfirmation || $this->testAgreementEnabled()),
            'agreementId' => (int) $agreement['id'], 'version' => (string) $agreement['agreement_version'],
            'title' => (string) $agreement['title'], 'signedAt' => $signed ? (string) $signature->signed_at : null,
            'signerName' => $signed ? (string) $signature->signer_name : '',
        ];
    }

    private function activeAgreement(int $siteId): array
    {
        $agreement = Db::table('merchant_onboarding_agreement')->whereIn('site_id', [0, $siteId])
            ->where('status', 1)->where('effective_at', '<=', gmdate('Y-m-d H:i:s'))
            ->orderByDesc('site_id')->orderByDesc('effective_at')->orderByDesc('id')->first();
        if (! $agreement) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前没有已生效的商户入驻条款');
        }
        return (array) $agreement;
    }

    private function template(int $siteId, string $scopeType, string $businessType): ?array
    {
        $row = Db::table('merchant_kyc_template')->whereIn('site_id', [0, $siteId])
            ->where('scope_type', $scopeType)->where('business_type', $businessType)->where('status', 1)
            ->orderByDesc('site_id')->orderBy('sort')->orderBy('id')->first();
        return $row ? (array) $row : null;
    }

    private function templateById(int $id, string $scopeType): array
    {
        $row = Db::table('merchant_kyc_template')->where('id', $id)->where('scope_type', $scopeType)->where('status', 1)->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'KYC 模板不存在或已停用');
        }
        return (array) $row;
    }

    private function templateDocuments(array $template): array
    {
        $decoded = json_decode((string) ($template['docs'] ?? '[]'), true);
        $documents = [];
        foreach (is_array($decoded) ? $decoded : [] as $item) {
            $item = (array) $item;
            $docType = mb_substr(trim((string) ($item['doc_type'] ?? '')), 0, 50);
            if ($docType === '') {
                continue;
            }
            $documents[] = ['docType' => $docType, 'name' => mb_substr((string) ($item['name'] ?? $docType), 0, 100), 'required' => ($item['required'] ?? true) !== false];
        }
        if ($documents === []) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'KYC 模板没有文件要求');
        }
        return $documents;
    }

    private function businesses(int $applicationId, bool $lock = false): array
    {
        $query = Db::table('merchant_application_business')->where('application_id', $applicationId)->orderBy('id');
        if ($lock) {
            $query->lockForUpdate();
        }
        return $query->get()->map(static fn ($row) => (array) $row)->all();
    }

    private function kycStatus(int $status, bool $property = false): string
    {
        return match ($status) {
            0 => 'locked', 1 => 'draft', 2 => 'submitted', 3 => 'under_review',
            4 => 'resubmit_required', 5 => 'approved', 6 => 'rejected', default => 'unknown',
        };
    }

    private function signatureBytes(string $signature): array
    {
        $encoded = trim($signature);
        if (preg_match('#^data:image/(png|jpeg);base64,(.+)$#s', $encoded, $matches)) {
            $encoded = $matches[2];
        }
        $bytes = base64_decode($encoded, true);
        if ($bytes === false || strlen($bytes) < 16 || strlen($bytes) > 1024 * 1024) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '签名图片无效或超过 1MB');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        $ext = ['image/png' => 'png', 'image/jpeg' => 'jpg'][$mime] ?? null;
        if ($ext === null) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '签名仅支持 PNG/JPEG 图片');
        }
        return [$bytes, $ext];
    }

    private function jwtKey(): string
    {
        $key = (string) config('mtrip.jwt_secret');
        if ($key === '') {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '签署凭据密钥未配置');
        }
        return $key;
    }

    private function timeline(array $app, string $action, string $note, bool $exception = false, bool $adminAssisted = false): void
    {
        Db::table('merchant_verify_timeline')->insert([
            'site_id' => (int) $app['site_id'], 'merchant_id' => (int) ($app['merchant_id'] ?? 0),
            'application_id' => (int) $app['id'], 'action' => $action, 'actor_type' => $adminAssisted ? 2 : 3,
            'operator_id' => $adminAssisted ? \Mtrip\Shared\Context\AdminContext::adminId() : 0,
            'operator_name' => $adminAssisted ? \Mtrip\Shared\Context\AdminContext::adminName() : 'Merchant App', 'note' => mb_substr($note, 0, 500),
            'is_exception' => $exception ? 1 : 0,
        ]);
    }
}
