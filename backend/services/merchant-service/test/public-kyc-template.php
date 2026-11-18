<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\KycTemplateService;
use App\Service\OnboardingKycService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;

check(Db::connection('system')->table('sys_menu')->whereIn('perm_key', ['config:kyc:list', 'config:kyc:add', 'config:kyc:edit', 'config:kyc:status'])->count() === 4, 'migration registers all configuration permission keys exactly once');
check(Db::connection('system')->table('sys_menu')->where('id', 1315)->value('component') === 'config/kyc-template/index', 'menu component matches the implemented page directory');
$service = new KycTemplateService();
$actor = ['admin_id' => 911, 'admin_name' => 'Template Reviewer', 'site_id' => 0, 'is_super' => true];
AdminContext::set($actor);
$input = ['siteId' => 0, 'scopeType' => 'merchant', 'businessType' => 'unified', 'name' => 'Subject requirements',
    'documents' => [['docType' => 'registration', 'name' => 'Registration', 'required' => true]], 'sort' => 0, 'status' => 1];
$one = $service->create($input);
check($one['template_version'] === 1 && $one['template_group_id'] === $one['id'], 'create starts a public version group');
check($one['created_by'] === 911 && $one['change_action'] === 'create', 'version records actor and action');
$two = $service->update(['id' => $one['id'], 'expectedVersion' => 1, 'name' => 'New requirements',
    'documents' => [...$input['documents'], ['docType' => 'identity', 'name' => 'Identity', 'required' => true]], 'reason' => 'Compliance update']);
check($two['template_version'] === 2 && $two['id'] !== $one['id'], 'edit appends a new version');
check(count(json_decode(Db::table('merchant_kyc_template')->where('id', $one['id'])->value('docs'), true)) === 1, 'old checklist remains immutable');
check((int) Db::table('merchant_kyc_template')->where('id', $one['id'])->value('is_current') === 0, 'old version no longer offered');
rejects(ErrorCode::DATA_CONFLICT, fn () => $service->update(['id' => $one['id'], 'expectedVersion' => 1] + $input), 'stale editor cannot overwrite newer version');
rejects(ErrorCode::DATA_CONFLICT, fn () => $service->status(['id' => $two['id'], 'expectedVersion' => 1, 'status' => 2]), 'status also checks expected version');
$three = $service->status(['id' => $two['id'], 'expectedVersion' => 2, 'status' => 2]);
check($three['template_version'] === 3 && $three['status'] === 2, 'disable appends a version');
check((int) Db::table('merchant_kyc_template')->where('id', $two['id'])->value('status') === 1, 'bound enabled version remains readable');
$history = $service->history(['id' => $one['id']]);
check(array_column($history['list'], 'template_version') === [3, 2, 1], 'history includes every immutable version');
$copy = $service->create($input + ['copyFromId' => $two['id']]);
check($copy['template_group_id'] !== $one['template_group_id'] && $copy['change_action'] === 'copy', 'copy starts an independent group');
foreach ([['scopeType' => 'invalid'], ['businessType' => 'hotel'], ['name' => ''], ['documents' => []],
    ['documents' => [$input['documents'][0], $input['documents'][0]]],
    ['documents' => [['docType' => 'bad/type', 'name' => 'File', 'required' => true]]],
    ['documents' => [['docType' => 'file', 'name' => 'File', 'required' => false]]],
    ['documents' => [['docType' => 'file', 'name' => 'File', 'required' => 'true']]], ['status' => 3], ['siteId' => -1]] as $bad) {
    rejects(ErrorCode::PARAM_ERROR, fn () => $service->create(array_replace($input, $bad)), 'invalid input rejected: ' . json_encode($bad));
}
$local = $service->create(array_replace($input, ['siteId' => 991, 'name' => 'Site requirements']));
$foreign = $service->create(array_replace($input, ['siteId' => 992]));
$property = $service->create(array_replace($input, ['siteId' => 991, 'scopeType' => 'property', 'businessType' => 'hotel', 'name' => 'Hotel checklist']));
$applicationId = (int) Db::table('merchant_application')->insertGetId([
    'site_id' => 991, 'app_no' => 'PUBLIC-KYC-VERSION', 'merchant_name' => 'Version fixture',
    'company_name' => 'Version fixture', 'registration_status' => 3, 'merchant_kyc_status' => 1, 'state_model_version' => 1,
]);
$businessId = (int) Db::table('merchant_application_business')->insertGetId([
    'application_id' => $applicationId, 'site_id' => 991, 'business_type' => 'hotel', 'business_name' => 'Frozen checklist',
]);
$kyc = new OnboardingKycService();
$app = (array) Db::table('merchant_application')->where('id', $applicationId)->first();
$kyc->initialize($app);
$app = (array) Db::table('merchant_application')->where('id', $applicationId)->first();
check((int) Db::table('merchant_application_business')->where('id', $businessId)->value('kyc_template_id') === $property['id'], 'application freezes public template at initialization');
$newProperty = $service->update(['id' => $property['id'], 'expectedVersion' => 1, 'name' => 'Hotel checklist v2', 'documents' => $input['documents']]);
$kyc = new OnboardingKycService();
$select = new ReflectionMethod($kyc, 'template');
check($select->invoke($kyc, 991, 'property', 'hotel')['id'] === $newProperty['id'], 'new onboarding uses current enabled version');
$bound = new ReflectionMethod($kyc, 'templateById');
check($bound->invoke($kyc, $property['id'], 'property')['id'] === $property['id'], 'bound old version still resolves by ID');
check(array_column($kyc->propertyTemplateOptions($app, $businessId), 'id') === [$newProperty['id']], 'property selector excludes superseded public versions');
check($kyc->requirements($app)['initialProperties'][0]['template']['id'] === $property['id'], 'live requirements preserve old binding after public update');
$kyc->configurePropertyTemplate($app, $businessId, ['expectedTemplateId' => $property['id'], 'templateId' => $property['id']]);
check((int) Db::table('merchant_application_business')->where('id', $businessId)->value('kyc_template_id') !== $property['id'], 'bound old template remains editable as private requirements');
$privateBound = (int) Db::table('merchant_application_business')->where('id', $businessId)->value('kyc_template_id');
rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $kyc->configurePropertyTemplate($app, $businessId, ['expectedTemplateId' => $privateBound, 'templateId' => $property['id']]), 'superseded template cannot be newly selected');
$service->status(['id' => $newProperty['id'], 'expectedVersion' => 2, 'status' => 2]);
check($select->invoke($kyc, 991, 'property', 'hotel') === null, 'disabled group removed from automatic allocation');
check($bound->invoke($kyc, $newProperty['id'], 'property')['id'] === $newProperty['id'], 'disable does not switch a bound version');
$merchantId = merchantFixture(991);
Db::table('merchant_application')->where('id', $applicationId)->update(['merchant_id' => $merchantId, 'stage' => 5]);
setRequest(['id' => $merchantId]);
set_error_handler(static function (int $severity, string $message): never { throw new ErrorException($message, 0, $severity); });
try {
    $detail = $container->get(\App\Controller\Admin\VerifyController::class)->detail()['data'];
    check($detail['businesses'][0]['kyc_template_docs'][0]['doc_type'] === 'registration', 'formal detail reads site-specific bound private checklist without warnings');
} finally {
    restore_error_handler();
}
$legacyId = (int) Db::table('merchant_kyc_template')->insertGetId([
    'site_id' => 0, 'scope_type' => 'merchant', 'business_type' => 'hotel', 'name' => 'Historical subject hotel', 'docs' => '[]',
]);
Db::table('merchant_kyc_template')->where('id', $legacyId)->update(['template_group_id' => $legacyId]);
$legacy = $service->history(['id' => $legacyId])['list'][0];
check($legacy['is_legacy'] && ! $legacy['can_manage'], 'historical targeting is clearly marked read-only');
rejects(ErrorCode::FORBIDDEN, fn () => $service->status(['id' => $legacyId, 'expectedVersion' => 1, 'status' => 2]), 'legacy configuration cannot be changed in place');
AdminContext::set(array_replace($actor, ['is_super' => false, 'site_id' => 991, 'permissions' => ['config:kyc:list', 'config:kyc:add', 'config:kyc:edit', 'config:kyc:status']]));
$visible = $service->listing([]);
check(! in_array($foreign['id'], array_column($visible['list'], 'id'), true), 'list excludes foreign site');
check(in_array($local['id'], array_column($visible['list'], 'id'), true) && in_array($copy['id'], array_column($visible['list'], 'id'), true), 'site admins read local and global templates');
check(count($service->listing(['siteId' => 0])['list']) < count($visible['list']), 'explicit global filter differs from all visible');
rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $service->history(['id' => $foreign['id']]), 'foreign history inaccessible');
rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $service->create($input), 'site administrator cannot create global config');
rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $service->update(['id' => $copy['id'], 'expectedVersion' => 1] + $input), 'site administrator cannot edit global config');
rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $service->status(['id' => $foreign['id'], 'expectedVersion' => 1, 'status' => 2]), 'site administrator cannot disable foreign config');
$private = Db::table('merchant_kyc_template')->insertGetId(['site_id' => 991, 'scope_type' => 'property', 'business_type' => 'hotel', 'application_business_id' => 123, 'name' => 'Private', 'docs' => '[]']);
check(! in_array((int) $private, array_column($service->listing([])['list'], 'id'), true), 'private property requirements stay outside public management');
rejects(ErrorCode::NOT_FOUND, fn () => $service->history(['id' => $private]), 'public history excludes private versions');
AdminContext::set(['is_super' => false, 'site_id' => 991, 'permissions' => ['merchant:onboarding:kyc']]);
rejects(ErrorCode::FORBIDDEN, fn () => $service->create(array_replace($input, ['siteId' => 991])), 'onboarding reviewer cannot create public config');
rejects(ErrorCode::FORBIDDEN, fn () => $service->listing([]), 'configuration read requires own permission');
echo "Public KYC template lifecycle verified\n";

setRequest(['id' => $copy['id'], 'expectedVersion' => 1, 'name' => 'Bypass attempt', 'docs' => [['doc_type' => 'license', 'name' => 'License', 'required' => true]]]);
rejects(ErrorCode::FORBIDDEN, fn () => $container->get(\App\Controller\Admin\OnboardingController::class)->kycTemplateUpdate(), 'legacy editor cannot bypass config permission');
