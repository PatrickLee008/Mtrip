<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\MerchantDocumentService;
use App\Service\PropertyKycService;
use Hyperf\DbConnection\Db;
use Hyperf\HttpMessage\Upload\UploadedFile;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;

$propertyService = $container->get(PropertyKycService::class);
$documentService = new MerchantDocumentService();
$merchantIds = [];
$propertyIds = [];
$docIds = [];
$sourceFiles = [];
$fixtureRoot = sys_get_temp_dir() . '/property-kyc-' . bin2hex(random_bytes(8));
mkdir($fixtureRoot, 0700);
$config->set('storage.upload_root', $fixtureRoot);

function propertyActor(int $merchantId, int $siteId = 991): void
{
    MerchantContext::set([
        'admin_id' => 99001, 'admin_name' => 'Property Tester', 'site_id' => $siteId,
        'account_type' => 2, 'group_id' => 0, 'merchant_id' => $merchantId,
        'store_id' => 0, 'is_owner' => true,
        'permissions' => ['mch:properties:add', 'mch:properties:kyc-upload', 'mch:properties:kyc-submit'],
    ]);
}

function propertyFile(string $name = 'fixture.pdf', string $content = "%PDF-1.4\n%%EOF"): UploadedFile
{
    global $sourceFiles;
    $path = tempnam(sys_get_temp_dir(), 'property-kyc-upload-');
    $sourceFiles[] = $path;
    file_put_contents($path, $content);
    return new UploadedFile($path, strlen($content), UPLOAD_ERR_OK, $name, 'application/pdf');
}

try {
    $merchantId = $merchantIds[] = merchantFixture(991);
    Db::table('merchant_info')->where('id', $merchantId)->update([
        'status' => 3, 'merchant_name' => 'Property KYC Merchant', 'access_code' => 'KEEP-ACCESS-CODE',
    ]);
    $otherProperty = $propertyIds[] = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchantId, 'store_name' => 'Existing Property',
        'business_type' => 'hotel', 'status' => 1, 'kyc_status' => 1,
    ]);
    propertyActor($merchantId);
    $created = $propertyService->save([
        'propertyName' => 'New Hotel Property', 'businessType' => 'hotel', 'location' => 'Yangon',
    ]);
    $propertyId = $propertyIds[] = (int) $created['propertyId'];
    $property = Db::table('merchant_store')->where('id', $propertyId)->first();
    check((int) $property->kyc_status === 0 && (int) $property->status === 2 && (int) $property->display_enabled === 0,
        'B property draft is unavailable before KYC');
    $requirements = $propertyService->requirements($propertyId);
    check(count($requirements['documents']) === 3 && count(array_filter($requirements['documents'], static fn ($doc) => $doc['required'])) === 3,
        'B property template creates three required documents');
    $docIds = array_map(static fn ($doc) => (int) $doc['id'], $requirements['documents']);
    check(Db::table('merchant_verify_document')->whereIn('id', $docIds)->where('scope_type', 'property')->where('property_id', $propertyId)->count() === 3,
        'B documents are scoped to the property');

    propertyActor($merchantId, 992);
    rejects(40401, fn () => $propertyService->requirements($propertyId), 'B cross-site property read denied');
    propertyActor($merchantId);
    rejects(40001, fn () => $propertyService->upload($propertyId, 'business_reg', propertyFile('fake.pdf', '<script>fake</script>')),
        'B spoofed KYC file rejected');
    foreach ($requirements['documents'] as $doc) {
        $propertyService->upload($propertyId, $doc['docType'], propertyFile($doc['docType'] . '.pdf'));
    }
    $submitted = $propertyService->submit($propertyId);
    check($submitted['kycStatus'] === 2 && $submitted['kycVersion'] === 1,
        'B complete property KYC submits one review version');
    check(Db::table('merchant_info')->where('id', $merchantId)->value('access_code') === 'KEEP-ACCESS-CODE'
        && (int) Db::table('merchant_store')->where('id', $otherProperty)->value('kyc_status') === 1,
        'B submission leaves merchant access code and other property unchanged');

    AdminContext::set(['admin_id' => 99002, 'admin_name' => 'KYC Reviewer', 'site_id' => 991,
        'is_super' => false, 'permissions' => ['merchant:document:verify']]);
    $documents = Db::table('merchant_verify_document')->where('property_id', $propertyId)->orderBy('id')->get()->all();
    $documentService->review((int) $documents[0]->id, ['expectedVersion' => 1, 'action' => 'verify']);
    check((int) Db::table('merchant_store')->where('id', $propertyId)->value('kyc_status') === 3,
        'B partial document review keeps property under review');
    $documentService->review((int) $documents[1]->id, ['expectedVersion' => 1, 'action' => 'reject', 'reason' => 'License unreadable']);
    check((int) Db::table('merchant_store')->where('id', $propertyId)->value('kyc_status') === 4,
        'B rejected document rejects only this property KYC');
    check(Db::table('merchant_info')->where('id', $merchantId)->value('access_code') === 'KEEP-ACCESS-CODE'
        && (int) Db::table('merchant_store')->where('id', $otherProperty)->value('kyc_status') === 1,
        'B rejection leaves merchant access code and other property unchanged');

    propertyActor($merchantId);
    $propertyService->upload($propertyId, (string) $documents[1]->doc_type, propertyFile('hotel-license-new.pdf'));
    $resubmitted = $propertyService->submit($propertyId);
    check($resubmitted['kycVersion'] === 2
        && (int) Db::table('merchant_verify_document')->where('id', $documents[0]->id)->value('status') === 1,
        'B resubmission keeps previously approved documents');
    AdminContext::set(['admin_id' => 99002, 'admin_name' => 'KYC Reviewer', 'site_id' => 991,
        'is_super' => false, 'permissions' => ['merchant:document:verify']]);
    $documentService->review((int) $documents[1]->id, ['expectedVersion' => 2, 'action' => 'verify']);
    $completedReview = $documentService->review((int) $documents[2]->id, ['expectedVersion' => 1, 'action' => 'verify']);
    check((int) Db::table('merchant_store')->where('id', $propertyId)->value('kyc_status') === 1
        && Db::table('merchant_store')->where('id', $propertyId)->value('kyc_approved_at') !== null,
        'B all required documents approve the property');
    check(($completedReview['propertyKycStatus'] ?? 0) === 1
        && ($completedReview['nextStep'] ?? '') === 'complete_property_profile',
        'B final property document review returns the profile completion next step');
    check(Db::table('merchant_property_kyc_event')->where('property_id', $propertyId)->count() >= 6,
        'B property KYC lifecycle is audited');
    check(Db::table('merchant_verify_document_revision')->where('property_id', $propertyId)->count() === 4,
        'B document versions retain property ownership');
} finally {
    if ($propertyIds) {
        Db::table('merchant_property_kyc_event')->whereIn('property_id', $propertyIds)->delete();
        Db::table('merchant_document_event')->whereIn('property_id', $propertyIds)->delete();
        Db::table('merchant_verify_document_revision')->whereIn('property_id', $propertyIds)->delete();
        Db::table('merchant_verify_document')->whereIn('property_id', $propertyIds)->delete();
        Db::table('merchant_activity_log')->whereIn('entity_id', $propertyIds)->where('entity_type', 'property')->delete();
        Db::table('merchant_store')->whereIn('id', $propertyIds)->delete();
    }
    if ($merchantIds) {
        Db::table('merchant_info')->whereIn('id', $merchantIds)->delete();
    }
    if (is_dir($fixtureRoot)) {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($fixtureRoot, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($fixtureRoot);
    }
    foreach ($sourceFiles as $sourceFile) {
        if (is_file($sourceFile)) unlink($sourceFile);
    }
}

echo "Property KYC integration complete\n";
