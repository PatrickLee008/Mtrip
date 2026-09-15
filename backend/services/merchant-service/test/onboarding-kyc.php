<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\OnboardingController;
use App\Controller\Admin\VerifyController;
use App\Controller\App\Merchant\ApplicationController;
use App\Service\MerchantDocumentService;
use App\Service\OnboardingKycService;
use App\Service\OnboardingAdminContactService;
use Hyperf\DbConnection\Db;
use Hyperf\HttpMessage\Upload\UploadedFile;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;

function kycFile(string $name, string $suffix = ''): UploadedFile
{
    $content = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n{$suffix}\n%%EOF";
    $path = tempnam(sys_get_temp_dir(), 'onboarding-kyc-');
    if ($path === false) throw new RuntimeException('Cannot create upload fixture');
    file_put_contents($path, $content);
    return new UploadedFile($path, strlen($content), UPLOAD_ERR_OK, $name, 'application/pdf');
}

function currentApp(int $id): array
{
    return (array) Db::table('merchant_application')->where('id', $id)->first();
}

function currentDoc(int $applicationId, string $scope, int $businessId): array
{
    return (array) Db::table('merchant_verify_document')->where('application_id', $applicationId)
        ->where('scope_type', $scope)->where('application_business_id', $businessId)->first();
}

$applicationId = 990300001;
$otherApplicationId = 990300002;
$businessOne = 990310001;
$businessTwo = 990310002;
$otherBusiness = 990310003;
$siteId = 993;
$uploadDir = '/opt/www/uploads/kyc/' . $applicationId;
$otherUploadDir = '/opt/www/uploads/kyc/' . $otherApplicationId;
$kyc = $container->get(OnboardingKycService::class);
$admin = $container->get(OnboardingController::class);
$verify = $container->get(VerifyController::class);
$documents = new MerchantDocumentService();

try {
    $merchantTemplate = (int) Db::table('merchant_kyc_template')->insertGetId([
        'site_id' => 0, 'scope_type' => 'merchant', 'name' => 'Stage 3 Merchant KYC', 'business_type' => 'unified',
        'docs' => json_encode([['name' => 'Business Registration', 'doc_type' => 'business_reg', 'required' => true]]),
        'status' => 1, 'sort' => 1,
    ]);
    $propertyTemplate = (int) Db::table('merchant_kyc_template')->insertGetId([
        'site_id' => 0, 'scope_type' => 'property', 'name' => 'Stage 3 Hotel KYC', 'business_type' => 'hotel',
        'docs' => json_encode([['name' => 'Hotel License', 'doc_type' => 'hotel_license', 'required' => true]]),
        'status' => 1, 'sort' => 1,
    ]);
    Db::table('merchant_application')->insert([
        ...(new OnboardingAdminContactService())->fields($siteId, '+95990300001', 'kyc-one@example.test'),
        'id' => $applicationId, 'site_id' => $siteId, 'app_no' => 'APP-STAGE3-001',
        'merchant_name' => 'Stage 3 Merchant', 'company_name' => 'Stage 3 Merchant', 'reg_number' => 'STAGE3-001',
        'country' => 'Myanmar', 'business_types' => 'hotel', 'num_businesses' => 2,
        'registration_status' => 2, 'merchant_kyc_status' => 0, 'account_status' => 0, 'state_model_version' => 1,
    ]);
    foreach ([[$businessOne, 'Stage 3 Hotel One'], [$businessTwo, 'Stage 3 Hotel Two']] as [$id, $name]) {
        Db::table('merchant_application_business')->insert([
            'id' => $id, 'site_id' => $siteId, 'application_id' => $applicationId,
            'business_name' => $name, 'business_type' => 'hotel', 'city' => 'Yangon', 'kyc_status' => 0,
        ]);
    }
    Db::table('merchant_application')->insert([
        ...(new OnboardingAdminContactService())->fields($siteId, '+95990300002', 'kyc-two@example.test'),
        'id' => $otherApplicationId, 'site_id' => $siteId, 'app_no' => 'APP-STAGE3-002',
        'merchant_name' => 'Other Merchant', 'company_name' => 'Other Merchant', 'reg_number' => 'STAGE3-002',
        'country' => 'Myanmar', 'business_types' => 'hotel', 'num_businesses' => 1,
        'registration_status' => 3, 'merchant_kyc_status' => 1, 'account_status' => 0, 'state_model_version' => 1,
        'kyc_template_id' => $merchantTemplate,
    ]);
    Db::table('merchant_application_business')->insert([
        'id' => $otherBusiness, 'site_id' => $siteId, 'application_id' => $otherApplicationId,
        'business_name' => 'Other Hotel', 'business_type' => 'hotel', 'city' => 'Yangon',
        'kyc_status' => 1, 'kyc_template_id' => $propertyTemplate,
    ]);

    AdminContext::set([
        'admin_id' => 93001, 'admin_name' => 'Stage 3 Reviewer', 'site_id' => $siteId, 'is_super' => false,
        'permissions' => ['merchant:onboarding:list', 'merchant:onboarding:registration-approve', 'merchant:onboarding:kyc', 'merchant:doc:list'],
    ]);
    setRequest(['id' => $applicationId]);
    $admin->approve();
    $app = currentApp($applicationId);
    check((int) $app['merchant_kyc_status'] === 1,
        'base approval opens merchant KYC');
    check((int) $app['kyc_template_id'] === $merchantTemplate,
        'base approval freezes the merchant KYC template expected=' . $merchantTemplate . ' actual=' . $app['kyc_template_id']);
    $businessStates = Db::table('merchant_application_business')->where('application_id', $applicationId)->pluck('kyc_status')->all();
    check($businessStates === [1, 1], 'two initial properties open independent KYC drafts');
    check(Db::table('merchant_verify_document')->where('application_id', $applicationId)->where('biz_unit', '<>', '')->count() === 0,
        'new KYC documents never write legacy biz_unit');
    check(Db::table('merchant_verify_document')->where('application_id', $applicationId)->count() === 3,
        'merchant and two property scopes receive separate document rows');

    rejects(ErrorCode::DATA_CONFLICT, fn () => $kyc->submit($app), 'signature is required before KYC submission');
    rejects(ErrorCode::PARAM_ERROR, fn () => $kyc->confirmAgreementRead($app, 1, '1.0', false), 'scroll confirmation is required');
    $agreement = $kyc->agreement($app);
    $receipt = $kyc->confirmAgreementRead($app, $agreement['agreementId'], $agreement['version'], true);
    $png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    $kyc->sign($app, $agreement['agreementId'], $agreement['version'], $receipt['readReceipt'], 'Stage Three Signer', 'Owner', $png, '127.0.0.1', 'stage3-test');
    $app = currentApp($applicationId);
    check($kyc->requirements($app)['agreement']['status'] === 'signed', 'current agreement and signature digest are frozen');

    $kyc->upload($app, 'merchant', 0, 'business_reg', kycFile('merchant.pdf'));
    $kyc->upload($app, 'property', $businessOne, 'hotel_license', kycFile('hotel-one.pdf'));
    $kyc->upload($app, 'property', $businessTwo, 'hotel_license', kycFile('hotel-two.pdf'));
    rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $kyc->upload($app, 'property', $otherBusiness, 'hotel_license', kycFile('wrong-owner.pdf')),
        'application cannot upload into another application property scope');
    $submitted = $kyc->submit(currentApp($applicationId));
    check(count($submitted['submittedScopes']) === 3, 'one request submits merchant and both initial property scopes');
    check((int) currentApp($applicationId)['merchant_kyc_status'] === 2, 'merchant KYC enters submitted state');
    rejects(ErrorCode::DATA_CONFLICT, fn () => $kyc->upload($app, 'merchant', 0, 'business_reg', kycFile('late-upload.pdf')),
        'upload rechecks the current scope state after KYC submission');
    check(method_exists(ApplicationController::class, 'kycSubmit'), 'public KYC submit route has a controller target');
    setRequest(['page' => 1, 'pageSize' => 20]);
    $library = $verify->documents()['data'];
    check($library['total'] === 3
        && count(array_filter($library['list'], static fn ($row) => $row['scope_type'] === 'property' && $row['property_name'] !== '')) === 2,
        'admin document library exposes merchant and named initial-property scopes');

    $merchantDoc = currentDoc($applicationId, 'merchant', 0);
    $propertyOneDoc = currentDoc($applicationId, 'property', $businessOne);
    $propertyTwoDoc = currentDoc($applicationId, 'property', $businessTwo);
    $documents->review((int) $merchantDoc['id'], ['action' => 'verify', 'expectedVersion' => $merchantDoc['document_version']]);
    $documents->review((int) $propertyOneDoc['id'], ['action' => 'verify', 'expectedVersion' => $propertyOneDoc['document_version']]);
    $documents->review((int) $propertyTwoDoc['id'], ['action' => 'reject', 'reason' => 'License image is unreadable', 'expectedVersion' => $propertyTwoDoc['document_version']]);
    $app = currentApp($applicationId);
    check((int) $app['merchant_kyc_status'] === 5, 'merchant scope is approved independently');
    $states = Db::table('merchant_application_business')->whereIn('id', [$businessOne, $businessTwo])->pluck('kyc_status', 'id')->all();
    check((int) $states[$businessOne] === 5 && (int) $states[$businessTwo] === 4,
        'partial property rejection preserves the approved property scope');
    $rejectedScope = array_values(array_filter($kyc->requirements($app)['initialProperties'],
        static fn ($property) => $property['applicationBusinessId'] === $businessTwo))[0];
    check($rejectedScope['reviewReason'] === 'License image is unreadable'
        && $rejectedScope['documents'][0]['rejectReason'] === 'License image is unreadable',
        'scope and rejected document expose the correction reason');
    check($kyc->readiness($app)['ready'] === false, 'final approval gate blocks a partially rejected application');

    $replaced = $kyc->upload($app, 'property', $businessTwo, 'hotel_license', kycFile('hotel-two-fixed.pdf', 'replacement'));
    check($replaced['documentVersion'] === 2, 'rejected file replacement increments document version');
    rejects(ErrorCode::DATA_CONFLICT, fn () => $kyc->upload($app, 'property', $businessOne, 'hotel_license', kycFile('approved-scope.pdf')),
        'approved property scope cannot be changed during another scope resubmission');
    check(Db::table('merchant_verify_document_revision')->where('doc_id', $propertyTwoDoc['id'])->count() === 2,
        'original and replacement file revisions are retained');
    $resubmitted = $kyc->submit(currentApp($applicationId));
    check($resubmitted['submittedScopes'] === ['property:' . $businessTwo], 'resubmission submits only the corrected scope');
    $propertyTwoDoc = currentDoc($applicationId, 'property', $businessTwo);
    $documents->review((int) $propertyTwoDoc['id'], ['action' => 'verify', 'expectedVersion' => $propertyTwoDoc['document_version']]);
    check($kyc->readiness(currentApp($applicationId))['ready'] === true, 'all scopes plus signature satisfy final approval precheck');

    $otherApp = currentApp($otherApplicationId);
    $kyc->initialize($otherApp);
    $otherApp = currentApp($otherApplicationId);
    $otherAgreement = $kyc->agreement($otherApp);
    $originalEnv = $config->get('app_env');
    $config->set('app_env', 'test');
    $confirmationInput = ['id' => $otherApplicationId, 'agreementId' => $otherAgreement['agreementId'], 'version' => $otherAgreement['version'], 'reason' => 'Admin assisted onboarding regression'];
    setRequest($confirmationInput);
    rejects(ErrorCode::FORBIDDEN, fn () => $admin->testConfirmAgreement(), 'ordinary admin cannot test-confirm an agreement');
    AdminContext::set(['admin_id' => 93001, 'admin_name' => 'Test Super Admin', 'site_id' => 0, 'is_super' => true, 'permissions' => []]);
    $config->set('app_env', 'production');
    rejects(ErrorCode::FORBIDDEN, fn () => $admin->testConfirmAgreement(), 'production rejects test agreement endpoint');
    $config->set('app_env', 'test');
    setRequest(array_replace($confirmationInput, ['reason' => '']));
    rejects(ErrorCode::PARAM_ERROR, fn () => $admin->testConfirmAgreement(), 'test confirmation requires a reason');
    setRequest($confirmationInput);
    $testState = $admin->testConfirmAgreement()['data'];
    check($testState['status'] === 'test_confirmed' && $testState['satisfied'], 'test confirmation is distinct from a merchant signature');
    $admin->testConfirmAgreement();
    check(Db::table('merchant_application_signature')->where('application_id', $otherApplicationId)->count() === 1, 'repeat test confirmation is idempotent');
    $testTimeline = Db::table('merchant_verify_timeline')->where('application_id', $otherApplicationId)->where('action', 'agreement_test_confirmed')->first();
    check($testTimeline && (int) $testTimeline->operator_id === 93001 && (int) $testTimeline->actor_type === 2 && (int) $testTimeline->is_exception === 1,
        'test confirmation audits the administrator and exception marker');
    check((int) currentApp($otherApplicationId)['confirmation_status'] === 0, 'test confirmation does not claim real merchant consent');
    setRequest(['id' => $otherApplicationId]);
    rejects(ErrorCode::DATA_CONFLICT, fn () => $admin->submitVerification(), 'test agreement does not bypass required documents');
    foreach ([['merchant', 0, 'business_reg'], ['property', $otherBusiness, 'hotel_license']] as [$scope, $business, $docType]) {
        setRequest(['id' => $otherApplicationId, 'scopeType' => $scope, 'applicationBusinessId' => $business, 'docType' => $docType]);
        Hyperf\Context\RequestContext::set(Hyperf\Context\RequestContext::get()->withUploadedFiles(['file' => kycFile('admin-' . $scope . '.pdf')]));
        $uploaded = $admin->kycUpload()['data'];
        $event = Db::table('merchant_document_event')->where('doc_id', $uploaded['id'])->where('action', 'upload')->first();
        check($event && $event->actor_type === 'admin' && (int) $event->actor_id === 93001, 'assisted upload audits real admin for ' . $scope);
        $revision = Db::table('merchant_verify_document_revision')->where('doc_id', $uploaded['id'])->first();
        check($revision && $revision->source === 'admin_assisted' && (int) $revision->uploader_id === 93001, 'assisted revision preserves uploader for ' . $scope);
    }
    $config->set('app_env', 'prod');
    setRequest(['id' => $otherApplicationId]);
    rejects(ErrorCode::DATA_CONFLICT, fn () => $admin->submitVerification(), 'production does not accept persisted test confirmation');
    $config->set('app_env', 'test');
    $singleSubmitted = $admin->submitVerification()['data'];
    check($singleSubmitted['submittedScopes'] === ['merchant', 'property:' . $otherBusiness],
        'single-property application submits both required KYC scopes');
    $singleMerchantDoc = currentDoc($otherApplicationId, 'merchant', 0);
    $singlePropertyDoc = currentDoc($otherApplicationId, 'property', $otherBusiness);
    $documents->review((int) $singleMerchantDoc['id'], ['action' => 'verify', 'expectedVersion' => $singleMerchantDoc['document_version']]);
    $documents->review((int) $singlePropertyDoc['id'], ['action' => 'verify', 'expectedVersion' => $singlePropertyDoc['document_version']]);
    check($kyc->readiness(currentApp($otherApplicationId))['ready'] === true,
        'single-property application reaches the final approval gate');
    $config->set('app_env', 'production');
    check($kyc->readiness(currentApp($otherApplicationId))['ready'] === false, 'production final approval blocks test-confirmed agreement');
    $config->set('app_env', 'test');
    check((int) Db::table('merchant_application_business')->where('id', $otherBusiness)->value('kyc_submitted_by') === 93001, 'assisted submission retains administrator');

    $v2Content = 'Stage 3 agreement version two';
    $agreementV2 = (int) Db::table('merchant_onboarding_agreement')->insertGetId([
        'site_id' => 0, 'agreement_version' => '2.0', 'title' => 'Stage 3 Agreement v2', 'content' => $v2Content,
        'content_sha256' => hash('sha256', $v2Content), 'status' => 1, 'effective_at' => gmdate('Y-m-d H:i:s'), 'created_by' => 0,
    ]);
    $app = currentApp($applicationId);
    check(! $kyc->requirements(currentApp($otherApplicationId))['agreement']['satisfied'], 'agreement update invalidates test confirmation');
    setRequest($confirmationInput);
    rejects(ErrorCode::DATA_CONFLICT, fn () => $admin->testConfirmAgreement(), 'stale agreement confirmation request is rejected');
    setRequest(array_replace($confirmationInput, ['agreementId' => $agreementV2, 'version' => '2.0']));
    $admin->testConfirmAgreement();
    Db::table('merchant_application')->where('id', $otherApplicationId)->update(['account_status' => 1]);
    rejects(ErrorCode::DATA_CONFLICT, fn () => $admin->testConfirmAgreement(), 'finalized application cannot receive a test confirmation');
    Db::table('merchant_application')->where('id', $otherApplicationId)->update(['account_status' => 0]);
    check($kyc->requirements($app)['agreement']['status'] === 'resign_required' && $kyc->readiness($app)['ready'] === false,
        'a newly effective agreement invalidates the old signature for final approval');
    $receiptV2 = $kyc->confirmAgreementRead($app, $agreementV2, '2.0', true);
    $kyc->sign($app, $agreementV2, '2.0', $receiptV2['readReceipt'], 'Stage Three Signer', 'Owner', $png, '127.0.0.1', 'stage3-test');
    check($kyc->readiness(currentApp($applicationId))['ready'] === true, 'approved KYC scopes remain valid after signing the new agreement');
    check(Db::table('merchant_application_signature')->where('application_id', $applicationId)->where('status', 2)->count() === 1,
        'superseded signature remains in the audit trail');

    AdminContext::set([
        'admin_id' => 93002, 'admin_name' => 'Wrong Site', 'site_id' => $siteId + 1, 'is_super' => false,
        'permissions' => ['merchant:onboarding:kyc'],
    ]);
    rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $documents->document((int) $merchantDoc['id']),
        'cross-site reviewer cannot read onboarding KYC documents');
    setRequest(['id' => $otherApplicationId]);
    rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $admin->submitVerification(), 'cross-site assisted submission is rejected');
    rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $admin->kycUpload(), 'cross-site assisted upload is rejected');
    rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $admin->testConfirmAgreement(), 'cross-site test confirmation is rejected');
    $config->set('app_env', $originalEnv);
} finally {
    AdminContext::set(['admin_id' => 0, 'admin_name' => '', 'site_id' => 0, 'is_super' => false, 'permissions' => []]);
    $docIds = Db::table('merchant_verify_document')->whereIn('application_id', [$applicationId, $otherApplicationId])->pluck('id')->all();
    if ($docIds !== []) {
        Db::table('merchant_document_event')->whereIn('doc_id', $docIds)->delete();
        Db::table('merchant_verify_document_revision')->whereIn('doc_id', $docIds)->delete();
        Db::table('merchant_verify_document')->whereIn('id', $docIds)->delete();
    }
    Db::table('merchant_activity_log')->where('site_id', $siteId)->where('merchant_id', 0)->delete();
    Db::table('merchant_verify_timeline')->whereIn('application_id', [$applicationId, $otherApplicationId])->delete();
    Db::table('merchant_application_signature')->whereIn('application_id', [$applicationId, $otherApplicationId])->delete();
    Db::table('merchant_application_business')->whereIn('application_id', [$applicationId, $otherApplicationId])->delete();
    Db::table('merchant_application')->whereIn('id', [$applicationId, $otherApplicationId])->delete();
    Db::table('merchant_kyc_template')->whereIn('id', [$merchantTemplate ?? 0, $propertyTemplate ?? 0])->delete();
    Db::table('merchant_onboarding_agreement')->where('agreement_version', '2.0')->delete();
    foreach ([$uploadDir, $otherUploadDir] as $dir) {
        if (is_dir($dir)) {
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
            foreach ($iterator as $entry) {
                $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
            }
            rmdir($dir);
        }
    }
}

echo "Onboarding KYC integration complete\n";
