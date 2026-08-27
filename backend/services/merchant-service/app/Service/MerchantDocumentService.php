<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Psr\Http\Message\UploadedFileInterface;
use function Hyperf\Config\config;

/** Current document is a projection; revisions and events are append-only. */
class MerchantDocumentService
{
    public function document(int $id, bool $lock = false): array
    {
        $q = Db::table('merchant_verify_document')->where('id', $id)->whereNull('deleted_at');
        $row = ($lock ? $q->lockForUpdate() : $q)->first();
        if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND, '文档不存在');
        $doc = (array) $row;
        if (! AdminContext::isSuper() && (int) $doc['site_id'] !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $doc;
    }

    public function permission(string $key): void
    {
        if (! AdminContext::hasPermission($key)) throw new BusinessException(ErrorCode::FORBIDDEN);
    }

    public function approved(array $doc): bool
    {
        return Db::table('merchant_info')->where('id', $doc['merchant_id'])->where('site_id', $doc['site_id'])
            ->whereIn('status', [3, 4])->whereNull('deleted_at')->exists();
    }

    public function snapshot(array $doc, string $source = 'migration_snapshot', ?string $sha = null): void
    {
        if (Db::table('merchant_verify_document_revision')->where('doc_id', $doc['id'])->where('lifecycle_version', $doc['document_version'])->exists()) return;
        Db::table('merchant_verify_document_revision')->insert([
            'site_id' => $doc['site_id'], 'doc_id' => $doc['id'], 'merchant_id' => $doc['merchant_id'],
            'version' => $doc['document_version'], 'lifecycle_version' => $doc['document_version'],
            'file_url' => $doc['file_url'], 'file_size' => $doc['file_size'], 'file_name' => $doc['name'],
            'status' => $doc['status'], 'reject_reason' => $doc['reject_reason'], 'reviewer_name' => $doc['reviewer_name'],
            'uploaded_at' => $doc['uploaded_at'], 'expiry_date' => $doc['expiry_date'], 'source' => $source,
            'file_sha256' => $sha, 'uploader_id' => in_array($source, ['admin_replacement', 'onboarding_draft'], true) ? AdminContext::adminId() : 0,
        ]);
    }

    public function replace(int $id, array $input, ?UploadedFileInterface $file): array
    {
        $this->permission('merchant:document:replace');
        $reason = $this->reason($input);
        $expiry = trim((string) ($input['expiryDate'] ?? ''));
        if ($expiry !== '' && (! preg_match('/^\d{4}-\d{2}-\d{2}$/D', $expiry) || date('Y-m-d', strtotime($expiry)) !== $expiry || $expiry < gmdate('Y-m-d'))) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '有效期必须为有效的今日或未来日期');
        }
        if (! $file || $file->getError() !== UPLOAD_ERR_OK || ! $file->getSize() || $file->getSize() > 10 * 1024 * 1024) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择不超过10MB的文件');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer((string) $file->getStream());
        $ext = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
        if ($ext === null) throw new BusinessException(ErrorCode::PARAM_ERROR, '仅支持有效PDF/JPEG/PNG/WebP文件');
        $newPath = null;
        try {
            return Db::transaction(function () use ($id, $input, $file, $reason, $expiry, $ext, &$newPath) {
                $doc = $this->document($id, true);
                if (! $this->approved($doc)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '入驻资料请使用模块11草稿流程');
                $this->version($doc, $input);
                $this->snapshot($doc);
                $dir = rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\') . '/kyc/m12/' . $id;
                if (! is_dir($dir) && ! mkdir($dir, 0700, true) && ! is_dir($dir)) throw new \RuntimeException('Cannot create KYC storage');
                $name = bin2hex(random_bytes(20)) . '.' . $ext;
                $newPath = $dir . '/' . $name;
                $file->moveTo($newPath);
                chmod($newPath, 0600);
                $next = array_replace($doc, [
                    'document_version' => (int) $doc['document_version'] + 1,
                    'file_url' => '/uploads/kyc/m12/' . $id . '/' . $name,
                    'name' => mb_substr(basename((string) $file->getClientFilename()), 0, 100),
                    'file_size' => (string) filesize($newPath), 'status' => 2, 'expiry_date' => $expiry ?: null,
                    'reviewer_id' => 0, 'reviewer_name' => '', 'reject_reason' => '', 'last_verified_at' => null,
                    'resubmit_required_at' => null, 'uploaded_at' => gmdate('Y-m-d H:i:s'),
                ]);
                Db::table('merchant_verify_document')->where('id', $id)->update(array_diff_key($next, array_flip(['id', 'created_at', 'updated_at'])));
                $this->snapshot($next, 'admin_replacement', hash_file('sha256', $newPath));
                $this->event($next, 'replace', $reason);
                $this->syncKyc($next);
                return ['doc_id' => $id, 'document_version' => $next['document_version'], 'status' => 2];
            });
        } catch (\Throwable $e) {
            // Only the random file created by this request may be removed on rollback.
            if ($newPath !== null && is_file($newPath)) unlink($newPath);
            throw $e;
        }
    }

    public function review(int $id, array $input): array
    {
        return Db::transaction(function () use ($id, $input) {
            $doc = $this->document($id, true);
            $this->permission($this->approved($doc) ? 'merchant:document:verify' : 'merchant:verify:doc');
            if ((int) $doc['merchant_id'] === 0) throw new BusinessException(ErrorCode::DATA_CONFLICT, '草稿必须先提交核验');
            $this->version($doc, $input);
            if ((int) $doc['status'] !== 2 || $doc['file_url'] === '') throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅当前待审文件可审核');
            $action = (string) ($input['action'] ?? '');
            if (! in_array($action, ['verify', 'reject'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR);
            if ($action === 'verify' && $doc['expiry_date'] && $doc['expiry_date'] < gmdate('Y-m-d')) throw new BusinessException(ErrorCode::DATA_CONFLICT, '过期文件不能通过审核');
            if ($action === 'verify') {
                $path = $this->localPath((string) $doc['file_url']);
                $digest = Db::table('merchant_verify_document_revision')->where('doc_id', $id)->where('lifecycle_version', $doc['document_version'])->value('file_sha256');
                if ($digest !== null && ! hash_equals($digest, hash_file('sha256', $path))) throw new BusinessException(ErrorCode::DATA_CONFLICT, '文件完整性校验失败');
            }
            $reason = $action === 'reject' ? $this->reason($input) : trim((string) ($input['reason'] ?? ''));
            if (mb_strlen($reason) > 500) throw new BusinessException(ErrorCode::PARAM_ERROR);
            $this->snapshot($doc);
            $doc = array_replace($doc, ['status' => $action === 'verify' ? 1 : 3, 'reviewer_id' => AdminContext::adminId(),
                'reviewer_name' => AdminContext::adminName(), 'last_verified_at' => gmdate('Y-m-d H:i:s'), 'reject_reason' => mb_substr($reason, 0, 255)]);
            Db::table('merchant_verify_document')->where('id', $id)->update(array_intersect_key($doc, array_flip(['status', 'reviewer_id', 'reviewer_name', 'last_verified_at', 'reject_reason'])));
            $this->event($doc, $action, $reason);
            $this->syncKyc($doc);
            return ['document_version' => $doc['document_version'], 'status' => $doc['status']];
        });
    }

    public function resubmit(int $id, array $input): array
    {
        $this->permission('merchant:document:verify');
        $reason = $this->reason($input);
        return Db::transaction(function () use ($id, $input, $reason) {
            $doc = $this->document($id, true);
            if (! $this->approved($doc)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '请使用模块11重新提交流程');
            $this->version($doc, $input);
            if ((int) $doc['status'] === 5) throw new BusinessException(ErrorCode::DATA_CONFLICT, '已要求重新提交');
            $this->snapshot($doc);
            $doc['status'] = 5;
            Db::table('merchant_verify_document')->where('id', $id)->update(['status' => 5, 'reject_reason' => mb_substr($reason, 0, 255), 'resubmit_required_at' => gmdate('Y-m-d H:i:s')]);
            $this->event($doc, 'resubmit', $reason);
            (new MerchantNotificationService())->send((int) $doc['merchant_id'], [
                'title' => '请重新提交商户证件', 'message' => $doc['name'] . ': ' . $reason, 'category' => 'account',
                'channels' => ['inapp'], 'requestId' => 'document-' . $id . '-' . bin2hex(random_bytes(12)),
            ]);
            $this->syncKyc($doc);
            return ['status' => 5];
        });
    }

    public function download(int $id, ?int $revisionId = null): array
    {
        $doc = $this->document($id);
        if ($this->approved($doc)) $this->permission('merchant:document:download');
        elseif (! AdminContext::hasAnyPermission(['merchant:onboarding:kyc', 'merchant:verify:doc', 'merchant:document:download'])) throw new BusinessException(ErrorCode::FORBIDDEN);
        $revision = $revisionId === null
            ? Db::table('merchant_verify_document_revision')->where('doc_id', $id)->where('lifecycle_version', $doc['document_version'])->first()
            : Db::table('merchant_verify_document_revision')->where('doc_id', $id)->where('id', $revisionId)->first();
        if ($revisionId !== null && ! $revision) throw new BusinessException(ErrorCode::NOT_FOUND);
        $url = (string) ($revision->file_url ?? $doc['file_url']);
        $path = $this->localPath($url);
        $sha = hash_file('sha256', $path);
        if ($revision && $revision->file_sha256 !== null && ! hash_equals($revision->file_sha256, $sha)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '文件完整性校验失败');
        Db::transaction(fn () => $this->event($doc, 'download', $revisionId === null ? 'current' : 'revision:' . $revisionId));
        return ['name' => (string) ($revision->file_name ?? $doc['name']), 'mime' => (new \finfo(FILEINFO_MIME_TYPE))->file($path), 'content' => base64_encode(file_get_contents($path)), 'sha256' => $sha];
    }

    public function localPath(string $url): string
    {
        if (! preg_match('#^/uploads/kyc/[A-Za-z0-9_/-]+\.(pdf|jpg|jpeg|png|webp)$#D', $url)) throw new BusinessException(ErrorCode::DATA_CONFLICT, '历史文件须人工确认并迁入受控KYC存储');
        $root = realpath(rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\') . '/kyc');
        $path = realpath(rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\') . substr($url, strlen('/uploads')));
        if (! $root || ! $path || ! str_starts_with($path, $root . DIRECTORY_SEPARATOR) || ! is_file($path) || filesize($path) > 10 * 1024 * 1024) throw new BusinessException(ErrorCode::NOT_FOUND, '文件不存在或不在受控目录');
        return $path;
    }

    public function event(array $doc, string $action, string $reason, bool $system = false): void
    {
        $actor = $system ? 'system' : 'admin';
        $name = $system ? 'System' : AdminContext::adminName();
        $actorId = $system ? 0 : AdminContext::adminId();
        Db::table('merchant_document_event')->insert(['site_id' => $doc['site_id'], 'merchant_id' => $doc['merchant_id'], 'doc_id' => $doc['id'], 'version' => $doc['document_version'], 'action' => $action, 'status' => $doc['status'], 'reason' => $reason, 'actor_type' => $actor, 'actor_id' => $actorId, 'actor_name' => $name]);
        Db::table('merchant_activity_log')->insert(['site_id' => $doc['site_id'], 'merchant_id' => $doc['merchant_id'], 'activity_type' => $action === 'replace' ? 'document_upload' : 'verification', 'description' => 'Document ' . $doc['id'] . ' v' . $doc['document_version'] . ': ' . $action, 'performed_by' => $name, 'performed_by_id' => $actorId, 'actor_type' => $actor, 'entity_type' => 'document', 'entity_id' => $doc['id']]);
    }

    public function expireDue(): int
    {
        $count = 0;
        $ids = Db::table('merchant_verify_document')->where('status', 1)->where('expiry_date', '<', gmdate('Y-m-d'))->whereNull('deleted_at')->orderBy('id')->limit(200)->pluck('id');
        foreach ($ids as $id) $count += Db::transaction(function () use ($id) {
            $row = Db::table('merchant_verify_document')->where('id', $id)->lockForUpdate()->first();
            if (! $row || $row->deleted_at !== null || (int) $row->status !== 1 || ! $row->expiry_date || $row->expiry_date >= gmdate('Y-m-d')) return 0;
            $doc = (array) $row;
            $this->snapshot($doc);
            Db::table('merchant_verify_document')->where('id', $id)->update(['status' => 4]);
            $doc['status'] = 4;
            $this->event($doc, 'expire', 'Document expiry date passed (UTC)', true);
            $this->syncKyc($doc);
            return 1;
        });
        return $count;
    }

    private function version(array $doc, array $input): void
    {
        if (! isset($input['expectedVersion']) || filter_var($input['expectedVersion'], FILTER_VALIDATE_INT) === false) throw new BusinessException(ErrorCode::PARAM_ERROR, '缺少当前文件版本');
        if ((int) $input['expectedVersion'] !== (int) $doc['document_version']) throw new BusinessException(ErrorCode::DATA_CONFLICT, '文件版本已变化，请刷新');
    }

    private function reason(array $input): string
    {
        $value = trim((string) ($input['reason'] ?? ''));
        if ($value === '' || mb_strlen($value) > 500) throw new BusinessException(ErrorCode::PARAM_ERROR, '原因必填且不能超过500字');
        return $value;
    }

    private function syncKyc(array $doc): void
    {
        if (! $doc['application_id'] || ! ctype_digit((string) $doc['biz_unit'])) return;
        $app = Db::table('merchant_application')->where('id', $doc['application_id'])->where('site_id', $doc['site_id'])->first();
        $business = Db::table('merchant_application_business')->where('id', (int) $doc['biz_unit'])->where('application_id', $doc['application_id'])->where('site_id', $doc['site_id'])->first();
        if (! $app || ! $business || (int) $app->stage < 5) return;
        $template = (int) $business->kyc_template_id > 0
            ? Db::table('merchant_kyc_template')->where('id', $business->kyc_template_id)->where('status', 1)->first()
            : Db::table('merchant_kyc_template')->where('business_type', $business->business_type)->where('status', 1)->orderBy('sort')->first();
        $requirements = $template ? json_decode((string) $template->docs, true) : [];
        $required = [];
        foreach (is_array($requirements) ? $requirements : [] as $item) if (($item['required'] ?? true) !== false) $required[] = (string) ($item['doc_type'] ?? '');
        $rows = Db::table('merchant_verify_document')->where('application_id', $doc['application_id'])->where('biz_unit', $doc['biz_unit'])->whereNull('deleted_at')->get();
        $verified = $rows->filter(static fn ($r) => (int) $r->status === 1 && $r->file_url !== '' && (! $r->expiry_date || $r->expiry_date >= gmdate('Y-m-d')))->pluck('doc_type')->all();
        $complete = $required !== [] ? array_diff($required, $verified) === [] : ($rows->isNotEmpty() && count($verified) === $rows->count());
        Db::table('merchant_application_business')->where('id', $business->id)->update(['kyc_status' => $complete ? 1 : 3]);
    }
}
