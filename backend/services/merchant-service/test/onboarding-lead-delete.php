<?php
declare(strict_types=1);
require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\OnboardingController;
use App\Middleware\OnboardingMutationMiddleware;
use App\Service\MerchantEmailIdentityService;
use App\Service\MerchantPhoneIdentityService;
use App\Service\MerchantRegistrationOtpService;
use App\Service\OnboardingKycService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;

$admin = $container->get(OnboardingController::class);
$request = static function (array $input) use ($admin): array { setRequest($input); return $admin->delete(); };
$id = (int) Db::table('merchant_application')->insertGetId([
    'site_id' => 7, 'app_no' => 'DELETE-TEST-001', 'company_name' => 'Deletion Test', 'state_model_version' => 1, 'stage' => 4,
    'registration_status' => 3, 'merchant_kyc_status' => 2,
    'registration_email_index' => str_repeat('a', 64), 'registration_phone_index' => str_repeat('b', 64),
]);
$payload = ['id' => $id, 'confirmAppNo' => 'DELETE-TEST-001', 'reason' => 'Duplicate test lead', 'expectedRegistrationStatus' => 3, 'expectedKycStatus' => 2, 'expectedStage' => 4];
AdminContext::set(['admin_id' => 93002, 'site_id' => 7, 'is_super' => false, 'permissions' => ['merchant:onboarding:delete']]);
rejects(ErrorCode::FORBIDDEN, fn () => $request($payload), 'ordinary admin with delete permission still cannot permanently delete');
AdminContext::set(['admin_id' => 93001, 'admin_name' => 'Delete Test Super', 'site_id' => 0, 'is_super' => true]);
rejects(ErrorCode::PARAM_ERROR, fn () => $request(array_replace($payload, ['confirmAppNo' => 'OTHER'])), 'permanent deletion requires the exact application number');
rejects(ErrorCode::PARAM_ERROR, fn () => $request(array_replace($payload, ['reason' => ''])), 'permanent deletion requires a reason');
rejects(ErrorCode::DATA_CONFLICT, fn () => $request(array_replace($payload, ['expectedKycStatus' => 1])), 'stale approval snapshot blocks deletion');
Db::table('merchant_application')->where('id', $id)->update(['merchant_id' => 999999]);
rejects(ErrorCode::DATA_CONFLICT, fn () => $request($payload), 'formal merchant applications cannot be permanently deleted');
Db::table('merchant_application')->where('id', $id)->update(['merchant_id' => 0]);
$business = (int) Db::table('merchant_application_business')->insertGetId(['application_id' => $id, 'site_id' => 7, 'business_name' => 'Purge property']);
$template = (int) Db::table('merchant_kyc_template')->insertGetId(['application_business_id' => $business, 'name' => 'Private purge template', 'business_type' => 'hotel', 'docs' => '[]']);
Db::table('merchant_application_business')->where('id', $business)->update(['kyc_template_id' => $template]);
$publicTemplate = (int) Db::table('merchant_kyc_template')->insertGetId(['name' => 'Public template retained', 'business_type' => 'hotel', 'docs' => '[]']);
$root = sys_get_temp_dir() . '/mtrip-delete-test-' . bin2hex(random_bytes(5));
$config->set('storage.upload_root', $root); $config->set('storage.url_prefix', '/uploads');
mkdir($root . '/kyc/' . $id . '/merchant', 0775, true);
$url = '/uploads/kyc/' . $id . '/merchant/test.pdf';
file_put_contents($root . '/kyc/' . $id . '/merchant/test.pdf', 'test-data');
$doc = (int) Db::table('merchant_verify_document')->insertGetId(['merchant_id' => 0, 'site_id' => 7, 'application_id' => $id, 'application_business_id' => $business, 'doc_type' => 'business_reg', 'file_url' => $url]);
Db::table('merchant_verify_document_revision')->insert(['doc_id' => $doc, 'file_url' => $url]);
Db::table('merchant_document_event')->insert(['site_id' => 7, 'doc_id' => $doc, 'action' => 'upload', 'version' => 1, 'status' => 2, 'actor_type' => 'admin']);
Db::table('merchant_activity_log')->insert(['merchant_id' => 0, 'entity_type' => 'document', 'entity_id' => $doc, 'activity_type' => 'document_upload', 'description' => 'test']);
Db::table('merchant_application_note')->insert(['application_id' => $id, 'note' => 'delete test note']);
Db::table('merchant_verify_timeline')->insert(['merchant_id' => 0, 'application_id' => $id, 'action' => 'test']);
Db::table('merchant_application_signature')->insert(['application_id' => $id, 'signer_name' => 'Delete Test Owner', 'agreement_id' => 1, 'agreement_version' => '1', 'agreement_sha256' => str_repeat('a',64), 'signature_sha256' => str_repeat('b',64), 'signature_file_url' => $url, 'signed_at' => gmdate('Y-m-d H:i:s'), 'terms_read_at' => gmdate('Y-m-d H:i:s')]);
Db::table('sys_file')->insert(['file_name' => 'test.pdf', 'file_path' => '/kyc/' . $id . '/merchant/test.pdf', 'file_url' => $url, 'biz_type' => 'merchant_kyc']);
$otherId = (int) Db::table('merchant_application')->insertGetId(['app_no' => 'DELETE-KEEP-002', 'company_name' => 'Retained Test', 'site_id' => 7]);
$sharedDoc = (int) Db::table('merchant_verify_document')->insertGetId(['merchant_id' => 0, 'application_id' => $otherId, 'doc_type' => 'shared', 'file_url' => $url]);
rejects(ErrorCode::DATA_CONFLICT, fn () => $request($payload), 'cross-application file references block destructive cleanup');
check(is_file($root . '/kyc/' . $id . '/merchant/test.pdf') && Db::table('merchant_application')->where('id', $id)->exists(), 'blocked cleanup preserves both file and application');
Db::table('merchant_verify_document')->where('id', $sharedDoc)->delete();
$staleApp = (array) Db::table('merchant_application')->where('id', $id)->first();
$registrationToken = \Mtrip\Shared\Support\JwtHelper::issue([
    'aud' => 'merchant_registration', 'site_id' => 7, 'application_id' => $id,
    'email_hash' => str_repeat('a', 64), 'phone_hash' => str_repeat('b', 64),
], (string) \Hyperf\Config\config('mtrip.jwt_secret'));
$otp = $container->get(MerchantRegistrationOtpService::class);
check((int) $otp->registrationClaims(7, $registrationToken)['application_id'] === $id, 'registration token is valid before deletion');
// A missing audit destination must roll back every DB delete and restore the staged files.
Db::statement('RENAME TABLE sys_operation_log TO delete_test_audit_backup');
$auditFailed = false;
try { $request($payload); } catch (\Throwable $e) { $auditFailed = true; }
finally { Db::statement('RENAME TABLE delete_test_audit_backup TO sys_operation_log'); }
check($auditFailed && Db::table('merchant_application')->where('id', $id)->exists()
    && Db::table('merchant_verify_document')->where('id', $doc)->exists()
    && Db::table('sys_file')->where('file_url', $url)->exists()
    && is_file($root . '/kyc/' . $id . '/merchant/test.pdf'), 'audit failure rolls back data and restores staged upload directory');
$request($payload);
foreach (['merchant_application' => ['id', $id], 'merchant_application_business' => ['application_id', $id], 'merchant_application_note' => ['application_id', $id], 'merchant_application_signature' => ['application_id', $id], 'merchant_verify_timeline' => ['application_id', $id], 'merchant_verify_document' => ['application_id', $id], 'merchant_verify_document_revision' => ['doc_id', $doc], 'merchant_document_event' => ['doc_id', $doc], 'merchant_kyc_template' => ['application_business_id', $business]] as $table => [$column, $value]) {
    check(!Db::table($table)->where($column, $value)->exists(), 'permanent deletion clears ' . $table);
}
check(!Db::table('sys_file')->where('file_url', $url)->exists() && !is_dir($root . '/kyc/' . $id), 'owned upload metadata and physical files are removed');
check(Db::table('merchant_application')->where('id', $otherId)->exists() && Db::table('merchant_kyc_template')->where('id', $publicTemplate)->exists(), 'unrelated application and public template are preserved');
MerchantEmailIdentityService::assertAvailable(str_repeat('a',64)); MerchantPhoneIdentityService::assertAvailable(str_repeat('b',64));
check(true, 'deleted phone and email identities are available for registration');
check(Db::table('sys_operation_log')->where('admin_id',93001)->where('action','永久删除入驻线索')->exists(), 'platform audit records the super administrator deletion');
rejects(ErrorCode::NOT_FOUND, fn () => $request($payload), 'repeated deletion does not touch another application');
rejects(ErrorCode::UNAUTHORIZED, fn () => $otp->registrationClaims(7, $registrationToken), 'deleted application registration token is invalidated');
$kyc = $container->get(OnboardingKycService::class);
rejects(ErrorCode::DATA_CONFLICT, fn () => $kyc->upload($staleApp, 'merchant', 0, 'business_reg', null), 'stale upload cannot recreate files after permanent deletion');
rejects(ErrorCode::DATA_CONFLICT, fn () => $kyc->sign($staleApp, 1, '1', '', '', '', '', '', ''), 'stale signature cannot recreate files after permanent deletion');
$handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
    public bool $called = false;
    public function handle(\Psr\Http\Message\ServerRequestInterface $request): \Psr\Http\Message\ResponseInterface
    {
        $this->called = true;
        return new \Hyperf\HttpMessage\Server\Response();
    }
};
$middleware = new OnboardingMutationMiddleware();
$mutation = (new \Hyperf\HttpMessage\Server\Request('POST', '/api/v1/admin/merchant/onboarding/note-add'))->withParsedBody(['id' => $id]);
rejects(ErrorCode::NOT_FOUND, fn () => $middleware->process($mutation, $handler), 'stale admin mutation is rejected before its handler');
check(!$handler->called && !is_dir($root . '/kyc/' . $id), 'deleted lead cannot gain orphan records or upload directories');
$templateMutation = (new \Hyperf\HttpMessage\Server\Request('POST', '/api/v1/admin/merchant/onboarding/kyc-template-update'))->withParsedBody(['id' => $id]);
$middleware->process($templateMutation, $handler);
check($handler->called, 'template identifiers are not mistaken for deleted application identifiers');
$liveMutation = $mutation->withParsedBody(['id' => $otherId]);
$middleware->process($liveMutation, $handler);
check($handler->called, 'existing lead admin mutation still reaches its handler');
AdminContext::set(['admin_id' => 93002, 'site_id' => 8, 'is_super' => false]);
rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $middleware->process($liveMutation, $handler), 'mutation middleware rejects ordinary cross-site administrator');
@rmdir($root . '/kyc'); @rmdir($root);
