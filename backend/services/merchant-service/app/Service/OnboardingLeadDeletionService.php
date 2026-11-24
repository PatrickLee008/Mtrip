<?php
declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use function Hyperf\Config\config;

/** Permanent cleanup is restricted to unconverted leads and the super administrator. */
final class OnboardingLeadDeletionService
{
    public function delete(int $id, array $input): void
    {
        if (!AdminContext::isSuper() || !AdminContext::hasPermission('merchant:onboarding:delete')) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅超级管理员可以永久删除入驻线索');
        }
        $reason = trim((string) ($input['reason'] ?? ''));
        if ($reason === '' || mb_strlen($reason) > 200) throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写200字符以内的删除原因');
        foreach (['expectedRegistrationStatus', 'expectedKycStatus', 'expectedStage'] as $key) {
            if (!isset($input[$key]) || !is_numeric($input[$key])) throw new BusinessException(ErrorCode::PARAM_ERROR, '请刷新列表后重新确认删除');
        }
        $directory = ''; $staged = '';
        try {
            Db::transaction(function () use ($id, $input, $reason, &$directory, &$staged): void {
                $app = Db::table('merchant_application')->where('id', $id)->lockForUpdate()->first();
                if (!$app) throw new BusinessException(ErrorCode::NOT_FOUND, '入驻线索不存在');
                if ((string) ($input['confirmAppNo'] ?? '') !== (string) $app->app_no) throw new BusinessException(ErrorCode::PARAM_ERROR, '请输入完整线索编号确认永久删除');
                if ((int) $app->merchant_id > 0 || (int) ($app->account_status ?? 0) > 0 || (int) $app->stage === 5 || !empty($app->final_approved_at)
                    || Db::table('merchant_credential_delivery')->where('application_id', $id)->exists()) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '已最终批准或已生成商户账号的申请不可删除');
                }
                foreach (['registration_status' => 'expectedRegistrationStatus', 'merchant_kyc_status' => 'expectedKycStatus', 'stage' => 'expectedStage'] as $column => $key) {
                    if ((int) $app->$column !== (int) $input[$key]) throw new BusinessException(ErrorCode::DATA_CONFLICT, '申请进度已变化，请刷新后重新确认');
                }
                $businessIds = Db::table('merchant_application_business')->where('application_id', $id)->lockForUpdate()->pluck('id')->all();
                $documents = Db::table('merchant_verify_document')->where('application_id', $id)->lockForUpdate()->get();
                $docIds = $documents->pluck('id')->all();
                if ($documents->contains(static fn ($doc) => (int) $doc->merchant_id > 0 || (int) ($doc->property_id ?? 0) > 0)
                    || ($businessIds !== [] && (Db::table('merchant_store')->whereIn('source_business_id', $businessIds)->exists()
                        || Db::table('merchant_verify_document')->whereIn('application_business_id', $businessIds)->where('application_id', '!=', $id)->exists()))) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '关联资料已被其他实体引用，不能自动删除');
                }
                $templates = $businessIds === [] ? [] : Db::table('merchant_kyc_template')->whereIn('application_business_id', $businessIds)->pluck('id')->all();
                if ($templates !== [] && (Db::table('merchant_application_business')->whereIn('kyc_template_id', $templates)->whereNotIn('id', $businessIds)->exists()
                    || Db::table('merchant_store')->whereIn('kyc_template_id', $templates)->exists())) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '专属模板被其他业务引用，不能删除');
                }
                $prefix = rtrim((string) config('storage.url_prefix', '/uploads'), '/') . '/kyc/' . $id . '/';
                $signatures = Db::table('merchant_application_signature')->where('application_id', $id)->get();
                $urls = array_merge($documents->pluck('file_url')->all(), Db::table('merchant_verify_document_revision')->whereIn('doc_id', $docIds)->pluck('file_url')->all(), $signatures->pluck('signature_file_url')->all());
                foreach ($urls as $url) {
                    if ($url !== '' && $url !== 'test-only:admin-confirmation' && !str_starts_with($url, $prefix)) {
                        throw new BusinessException(ErrorCode::DATA_CONFLICT, '文件不在该线索专属目录，请先核对文件归属');
                    }
                }
                if (Db::table('merchant_verify_document')->where('application_id', '!=', $id)->where('file_url', 'like', $prefix . '%')->exists()
                    || Db::table('merchant_verify_document_revision')->whereNotIn('doc_id', $docIds)->where('file_url', 'like', $prefix . '%')->exists()
                    || Db::table('merchant_application_signature')->where('application_id', '!=', $id)->where('signature_file_url', 'like', $prefix . '%')->exists()) {
                    throw new BusinessException(ErrorCode::DATA_CONFLICT, '线索文件被其他申请引用，不能删除');
                }
                $directory = rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\') . '/kyc/' . $id;
                if (file_exists($directory) || is_link($directory)) {
                    $root = realpath(rtrim((string) config('storage.upload_root', '/opt/www/uploads'), '/\\'));
                    if ($root === false || realpath(dirname($directory)) !== $root . '/kyc') {
                        throw new BusinessException(ErrorCode::DATA_CONFLICT, '上传目录不在预期存储范围，不能清理');
                    }
                    $this->checkDirectory($directory);
                    $staged = dirname($directory) . '/.deleting-' . $id . '-' . bin2hex(random_bytes(8));
                    if (!rename($directory, $staged)) throw new BusinessException(ErrorCode::SERVER_ERROR, '无法清理线索文件，请检查存储权限');
                }
                try {
                    Db::table('merchant_document_event')->whereIn('doc_id', $docIds)->delete();
                    Db::table('merchant_activity_log')->where('entity_type', 'document')->whereIn('entity_id', $docIds)->delete();
                    Db::table('merchant_verify_document_revision')->whereIn('doc_id', $docIds)->delete();
                    foreach (['merchant_application_registration_review', 'merchant_verify_document', 'merchant_application_signature', 'merchant_application_note', 'merchant_verify_timeline', 'merchant_application_business'] as $table) {
                        Db::table($table)->where('application_id', $id)->delete();
                    }
                    Db::table('merchant_kyc_template')->whereIn('id', $templates)->delete();
                    $system = (string) config('databases.system.database', 'mtrip_system');
                    Db::table($system . '.sys_file')->where('file_path', 'like', '/kyc/' . $id . '/%')->delete();
                    Db::table('merchant_application')->where('id', $id)->delete();
                    // Use the same connection/transaction so an audit failure cancels deletion.
                    Db::table($system . '.sys_operation_log')->insert([
                        'admin_id' => AdminContext::adminId(), 'admin_name' => AdminContext::adminName(), 'site_id' => (int) $app->site_id,
                        'module' => '商户入驻', 'action' => '永久删除入驻线索',
                        'content' => json_encode(['applicationId' => $id, 'appNo' => $app->app_no, 'reason' => $reason], JSON_UNESCAPED_UNICODE),
                        'request_url' => '/api/v1/admin/merchant/onboarding/delete', 'request_method' => 'POST', 'status_code' => 200,
                    ]);
                } catch (\Throwable $e) {
                    // Restore while still holding the application lock, before rollback releases waiting uploads.
                    if ($staged !== '' && is_dir($staged) && !rename($staged, $directory)) error_log('onboarding_delete_restore_failed application=' . $id);
                    throw $e;
                }
            });
        } catch (\Throwable $e) {
            if ($staged !== '' && is_dir($staged) && !rename($staged, $directory)) error_log('onboarding_delete_restore_failed application=' . $id);
            throw $e;
        }
        if ($staged !== '') $this->removeDirectory($staged);
    }

    private function checkDirectory(string $directory): void
    {
        if (is_link($directory) || !is_dir($directory) || !is_writable($directory) || !is_writable(dirname($directory))) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '文件目录归属或权限异常，不能自动清理');
        }
        foreach (new \FilesystemIterator($directory) as $item) {
            if ($item->isLink()) throw new BusinessException(ErrorCode::DATA_CONFLICT, '目录包含符号链接，不能自动清理');
            if ($item->isDir()) $this->checkDirectory($item->getPathname());
        }
    }

    private function removeDirectory(string $directory): void
    {
        foreach (new \FilesystemIterator($directory) as $item) {
            if ($item->isDir()) $this->removeDirectory($item->getPathname());
            elseif (!unlink($item->getPathname())) throw new BusinessException(ErrorCode::SERVER_ERROR, '线索已删除，但文件清理失败，请联系管理员');
        }
        if (!rmdir($directory)) throw new BusinessException(ErrorCode::SERVER_ERROR, '线索已删除，但目录清理失败，请联系管理员');
    }
}
