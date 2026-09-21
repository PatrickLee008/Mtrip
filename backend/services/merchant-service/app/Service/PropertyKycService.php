<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Psr\Http\Message\UploadedFileInterface;

use function Hyperf\Config\config;

/** Hotel property creation and property-scoped KYC. */
class PropertyKycService
{
    public function properties(int $page, int $pageSize): array
    {
        $query = Db::table('merchant_store as p')
            ->leftJoin('merchant_info as m', 'm.id', '=', 'p.merchant_id')
            ->where('p.site_id', MerchantContext::siteId())
            ->whereNull('p.deleted_at');
        $this->applyPropertyScope($query, 'p.');
        $total = (clone $query)->count();
        $list = $query->select('p.*', 'm.merchant_name')
            ->selectRaw('(SELECT COUNT(*) FROM hotel_room_type r WHERE r.property_id=p.id AND r.site_id=p.site_id AND r.status=1 AND r.publish_status=2 AND r.approved_version>0 AND r.deleted_at IS NULL) as live_room_count')
            ->selectRaw('(SELECT v.status FROM merchant_property_content_revision v WHERE v.property_id=p.id ORDER BY v.version DESC, v.id DESC LIMIT 1) as latest_content_review_status')
            ->selectRaw('(SELECT v.reject_reason FROM merchant_property_content_revision v WHERE v.property_id=p.id ORDER BY v.version DESC, v.id DESC LIMIT 1) as latest_content_reject_reason')
            ->orderByDesc('p.id')
            ->forPage($page, $pageSize)->get()->map(static function ($row): array {
                $item = (array) $row;
                $item['images'] = self::jsonArray($item['images'] ?? null);
                unset($item['deleted_at']);
                return $item;
            })->all();
        return ['list' => $list, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
    }

    public function save(array $input): array
    {
        if (MerchantContext::accountType() === 3) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '物业账号不能新增物业');
        }
        $name = mb_substr(trim((string) ($input['propertyName'] ?? '')), 0, 100);
        $address = mb_substr(trim((string) ($input['location'] ?? '')), 0, 255);
        $businessType = trim((string) ($input['businessType'] ?? 'hotel'));
        if ($name === '' || $businessType !== 'hotel') {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '物业名称必填，当前只支持酒店物业');
        }
        $propertyId = max(0, (int) ($input['propertyId'] ?? 0));

        return Db::transaction(function () use ($input, $name, $address, $propertyId): array {
            if ($propertyId > 0) {
                $property = $this->property($propertyId, true, true);
                if (! in_array((int) $property['kyc_status'], [0, 4, 5], true)) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前 KYC 状态不允许修改物业基本信息');
                }
                Db::table('merchant_store')->where('id', $propertyId)->update([
                    'store_name' => $name, 'address' => $address,
                ]);
                return ['propertyId' => $propertyId, 'kycStatus' => (int) $property['kyc_status']];
            }

            $merchantId = $this->merchantIdForCreate((int) ($input['merchantId'] ?? 0));
            $merchant = Db::table('merchant_info')->where('id', $merchantId)
                ->where('site_id', MerchantContext::siteId())->where('status', 3)
                ->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $merchant) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅已通过商户认证且已启用的商户可新增物业');
            }
            $template = $this->template((int) $merchant->site_id);
            $hasProperty = Db::table('merchant_store')->where('merchant_id', $merchantId)
                ->whereNull('deleted_at')->exists();
            $propertyId = (int) Db::table('merchant_store')->insertGetId([
                'site_id' => (int) $merchant->site_id, 'merchant_id' => $merchantId,
                'store_name' => $name, 'address' => $address, 'business_type' => 'hotel',
                'is_main' => $hasProperty ? 0 : 1, 'status' => 2, 'display_enabled' => 0,
                'kyc_status' => 0, 'kyc_template_id' => (int) $template->id,
            ]);
            $this->ensureDocuments($propertyId, $merchantId, (int) $merchant->site_id, $template);
            $this->activity((int) $merchant->site_id, $merchantId, $propertyId, 'Property draft created');
            return ['propertyId' => $propertyId, 'kycStatus' => 0];
        });
    }

    public function requirements(int $propertyId): array
    {
        $property = $this->property($propertyId);
        $template = $this->templateForProperty($property);
        $required = $this->templateRequirements($template);
        $documents = Db::table('merchant_verify_document')->where('scope_type', 'property')
            ->where('property_id', $propertyId)->whereNull('deleted_at')->orderBy('id')->get()
            ->map(static function ($doc) use ($required): array {
                $type = (string) $doc->doc_type;
                return [
                    'id' => (int) $doc->id, 'docType' => $type,
                    'name' => (string) ($required[$type]['name'] ?? $doc->name),
                    'required' => (bool) ($required[$type]['required'] ?? false),
                    'uploaded' => (string) $doc->file_url !== '', 'fileName' => (string) $doc->name,
                    'fileSize' => (string) $doc->file_size, 'status' => (int) $doc->status,
                    'rejectReason' => (string) $doc->reject_reason,
                ];
            })->all();
        return [
            'propertyId' => (int) $property['id'], 'propertyName' => (string) $property['store_name'],
            'merchantId' => (int) $property['merchant_id'], 'businessType' => (string) $property['business_type'],
            'location' => (string) $property['address'],
            'kycStatus' => (int) $property['kyc_status'], 'kycVersion' => (int) $property['kyc_version'],
            'rejectReason' => (string) $property['kyc_reject_reason'], 'documents' => $documents,
        ];
    }

    public function upload(int $propertyId, string $docType, ?UploadedFileInterface $file): array
    {
        if (! $file || $file->getError() !== UPLOAD_ERR_OK || ! $file->getSize() || $file->getSize() > 10 * 1024 * 1024) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择不超过 10MB 的文件');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer((string) $file->getStream());
        $ext = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'][$mime] ?? null;
        if ($ext === null) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '仅支持有效 PDF/JPG/PNG 文件');
        }
        $newPath = null;
        try {
            return Db::transaction(function () use ($propertyId, $docType, $file, $ext, &$newPath): array {
                $property = $this->property($propertyId, true, true);
                if (! in_array((int) $property['kyc_status'], [0, 4, 5], true)) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前 KYC 状态不允许上传');
                }
                $doc = Db::table('merchant_verify_document')->where('scope_type', 'property')
                    ->where('property_id', $propertyId)->where('doc_type', $docType)
                    ->whereNull('deleted_at')->lockForUpdate()->first();
                if (! $doc) {
                    throw new BusinessException(ErrorCode::PARAM_ERROR, '文件类型不在该物业 KYC 模板中');
                }
                $current = (array) $doc;
                if ((string) $current['file_url'] !== '') {
                    $this->snapshot($current, 'property_previous');
                }
                $root = rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\');
                $dir = $root . '/kyc/property/' . $propertyId . '/' . $current['id'];
                if (! is_dir($dir) && ! mkdir($dir, 0700, true) && ! is_dir($dir)) {
                    throw new BusinessException(ErrorCode::SERVER_ERROR, '上传目录创建失败');
                }
                $name = bin2hex(random_bytes(20)) . '.' . $ext;
                $newPath = $dir . '/' . $name;
                $file->moveTo($newPath);
                if (! is_file($newPath)) {
                    throw new BusinessException(ErrorCode::SERVER_ERROR, '文件保存失败');
                }
                chmod($newPath, 0600);
                $version = (int) $current['document_version'] + 1;
                $clientName = mb_substr(basename((string) $file->getClientFilename()), 0, 100);
                $next = array_replace($current, [
                    'document_version' => $version, 'name' => $clientName,
                    'file_url' => '/uploads/kyc/property/' . $propertyId . '/' . $current['id'] . '/' . $name,
                    'file_size' => (string) filesize($newPath), 'status' => 0,
                    'reviewer_id' => 0, 'reviewer_name' => '', 'reject_reason' => '',
                    'last_verified_at' => null, 'resubmit_required_at' => null,
                    'uploaded_at' => gmdate('Y-m-d H:i:s'),
                ]);
                Db::table('merchant_verify_document')->where('id', $current['id'])->update(array_intersect_key($next, array_flip([
                    'document_version', 'name', 'file_url', 'file_size', 'status', 'reviewer_id',
                    'reviewer_name', 'reject_reason', 'last_verified_at', 'resubmit_required_at', 'uploaded_at',
                ])));
                $this->snapshot($next, 'merchant_property_upload', hash_file('sha256', $newPath));
                $this->documentEvent($next, 'upload', '');
                Db::table('merchant_store')->where('id', $propertyId)->update([
                    'kyc_status' => 0, 'kyc_submitted_at' => null, 'kyc_approved_at' => null,
                    'kyc_reject_reason' => '',
                ]);
                return ['documentId' => (int) $current['id'], 'docType' => $docType,
                    'fileName' => $clientName, 'fileSize' => (string) filesize($newPath)];
            });
        } catch (\Throwable $e) {
            if ($newPath !== null && is_file($newPath)) {
                unlink($newPath);
            }
            throw $e;
        }
    }

    public function submit(int $propertyId): array
    {
        return Db::transaction(function () use ($propertyId): array {
            $property = $this->property($propertyId, true, true);
            $from = (int) $property['kyc_status'];
            if (! in_array($from, [0, 4, 5], true)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前 KYC 状态不允许重复提交');
            }
            $required = $this->templateRequirements($this->templateForProperty($property));
            foreach ($required as $docType => $item) {
                if (! $item['required']) {
                    continue;
                }
                $ready = Db::table('merchant_verify_document')->where('scope_type', 'property')
                    ->where('property_id', $propertyId)->where('doc_type', $docType)
                    ->where('file_url', '<>', '')->whereNull('deleted_at')->exists();
                if (! $ready) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '请先上传全部必需的物业 KYC 文件');
                }
            }
            $now = gmdate('Y-m-d H:i:s');
            $version = (int) $property['kyc_version'] + 1;
            Db::table('merchant_verify_document')->where('scope_type', 'property')
                ->where('property_id', $propertyId)->where('file_url', '<>', '')
                ->whereIn('status', [0, 3, 4, 5])->whereNull('deleted_at')
                ->update(['status' => 2, 'reject_reason' => '']);
            Db::table('merchant_store')->where('id', $propertyId)->update([
                'kyc_status' => 2, 'kyc_version' => $version, 'kyc_submitted_at' => $now,
                'kyc_approved_at' => null, 'kyc_reject_reason' => '',
            ]);
            $this->kycEvent($property, $version, 'submit', $from, 2, '');
            $this->activity((int) $property['site_id'], (int) $property['merchant_id'], $propertyId, 'Property KYC submitted');
            return ['propertyId' => $propertyId, 'kycStatus' => 2, 'kycVersion' => $version];
        });
    }

    private function merchantIdForCreate(int $requested): int
    {
        if (MerchantContext::accountType() === 2) {
            return MerchantContext::merchantId();
        }
        if (MerchantContext::accountType() === 1 && in_array($requested, MerchantContext::scopeMerchantIds(), true)) {
            return $requested;
        }
        throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '请选择当前集团内的商户');
    }

    private function property(int $id, bool $lock = false, bool $requireSelected = false): array
    {
        $query = Db::table('merchant_store')->where('id', $id)
            ->where('site_id', MerchantContext::siteId())->whereNull('deleted_at');
        if ($lock) {
            $query->lockForUpdate();
        }
        $row = $query->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '物业不存在');
        }
        $property = (array) $row;
        MerchantContext::assertPropertyAccess((int) $property['id'], $requireSelected);
        if ((string) $property['business_type'] !== 'hotel') {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前只支持酒店物业 KYC');
        }
        return $property;
    }

    private function applyPropertyScope($query, string $prefix = ''): void
    {
        $ids = MerchantContext::scopePropertyIds();
        $query->whereIn($prefix . 'id', $ids === [] ? [-1] : $ids);
    }

    private function template(int $siteId): object
    {
        $template = Db::table('merchant_kyc_template')->where('scope_type', 'property')
            ->where('business_type', 'hotel')->where('status', 1)
            ->whereIn('site_id', [0, $siteId])->orderByDesc('site_id')->orderBy('sort')->first();
        if (! $template) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '平台未配置酒店物业 KYC 模板');
        }
        return $template;
    }

    private function templateForProperty(array $property): object
    {
        $template = Db::table('merchant_kyc_template')->where('id', $property['kyc_template_id'])
            ->where('scope_type', 'property')->where('status', 1)->first();
        return $template ?: $this->template((int) $property['site_id']);
    }

    /** @return array<string,array{name:string,required:bool}> */
    private function templateRequirements(object $template): array
    {
        $requirements = [];
        $docs = json_decode((string) $template->docs, true);
        foreach (is_array($docs) ? $docs : [] as $item) {
            $type = trim((string) ($item['doc_type'] ?? ''));
            if ($type !== '') {
                $requirements[$type] = ['name' => (string) ($item['name'] ?? $type),
                    'required' => ($item['required'] ?? true) !== false];
            }
        }
        if ($requirements === []) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '物业 KYC 模板未配置文件');
        }
        return $requirements;
    }

    private function ensureDocuments(int $propertyId, int $merchantId, int $siteId, object $template): void
    {
        foreach ($this->templateRequirements($template) as $docType => $item) {
            Db::table('merchant_verify_document')->insert([
                'site_id' => $siteId, 'merchant_id' => $merchantId, 'scope_type' => 'property',
                'property_id' => $propertyId, 'application_id' => 0, 'biz_unit' => '',
                'doc_type' => $docType, 'name' => $item['name'], 'status' => 0,
            ]);
        }
    }

    private function snapshot(array $doc, string $source, ?string $sha = null): void
    {
        $version = (int) $doc['document_version'];
        if (Db::table('merchant_verify_document_revision')->where('doc_id', $doc['id'])
            ->where('lifecycle_version', $version)->exists()) {
            return;
        }
        Db::table('merchant_verify_document_revision')->insert([
            'site_id' => $doc['site_id'], 'doc_id' => $doc['id'], 'merchant_id' => $doc['merchant_id'],
            'property_id' => $doc['property_id'], 'version' => $version, 'lifecycle_version' => $version,
            'file_url' => $doc['file_url'], 'file_size' => $doc['file_size'], 'file_name' => $doc['name'],
            'status' => $doc['status'], 'reject_reason' => $doc['reject_reason'],
            'reviewer_name' => $doc['reviewer_name'], 'uploaded_at' => $doc['uploaded_at'],
            'expiry_date' => $doc['expiry_date'], 'source' => $source,
            'file_sha256' => $sha, 'uploader_id' => MerchantContext::adminId(),
        ]);
    }

    private function documentEvent(array $doc, string $action, string $reason): void
    {
        Db::table('merchant_document_event')->insert([
            'site_id' => $doc['site_id'], 'merchant_id' => $doc['merchant_id'],
            'property_id' => $doc['property_id'], 'doc_id' => $doc['id'],
            'version' => $doc['document_version'], 'action' => $action, 'status' => $doc['status'],
            'reason' => $reason, 'actor_type' => 'merchant', 'actor_id' => MerchantContext::adminId(),
            'actor_name' => MerchantContext::adminName(),
        ]);
    }

    private function kycEvent(array $property, int $version, string $action, int $from, int $to, string $reason): void
    {
        Db::table('merchant_property_kyc_event')->insert([
            'site_id' => $property['site_id'], 'merchant_id' => $property['merchant_id'],
            'property_id' => $property['id'], 'kyc_version' => $version, 'action' => $action,
            'from_status' => $from, 'to_status' => $to, 'reason' => $reason,
            'actor_type' => 'merchant', 'actor_id' => MerchantContext::adminId(),
            'actor_name' => MerchantContext::adminName(),
        ]);
    }

    private function activity(int $siteId, int $merchantId, int $propertyId, string $description): void
    {
        Db::table('merchant_activity_log')->insert([
            'site_id' => $siteId, 'merchant_id' => $merchantId, 'activity_type' => 'verification',
            'description' => $description, 'performed_by' => MerchantContext::adminName(),
            'performed_by_id' => MerchantContext::adminId(), 'actor_type' => 'merchant',
            'target_account_id' => MerchantContext::adminId(), 'entity_type' => 'property',
            'entity_id' => $propertyId,
        ]);
    }

    private static function jsonArray(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        $decoded = is_string($value) && $value !== '' ? json_decode($value, true) : [];
        return is_array($decoded) ? $decoded : [];
    }
}
