<?php

declare(strict_types=1);

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;

// Invoked inside the disposable stage-3 database; rollback leaves the original lifecycle fixtures intact.
Db::connection()->beginTransaction();
try {
    $input = ['expectedTemplateId' => $propertyTemplate, 'templateId' => $propertyTemplate];
    $options = $kyc->propertyTemplateOptions($app, $businessOne);
    check(array_column($options, 'id') === [$propertyTemplate], 'property template options match the current business');
    rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $kyc->propertyTemplateOptions($app, $otherBusiness), 'template options reject another application business');

    foreach ([['restaurant', 'property', $siteId, 1], ['hotel', 'merchant', $siteId, 1], ['hotel', 'property', $siteId + 1, 1], ['hotel', 'property', $siteId, 2]] as [$type, $scope, $site, $status]) {
        Db::table('merchant_kyc_template')->insert([
            'site_id' => $site, 'scope_type' => $scope, 'business_type' => $type, 'status' => $status,
            'name' => 'Unavailable template', 'docs' => '[]',
        ]);
    }
    check(array_column($kyc->propertyTemplateOptions($app, $businessOne), 'id') === [$propertyTemplate], 'options exclude other types, scopes, sites and disabled templates');
    $docs = [['docType' => 'hotel_license', 'name' => 'Hotel License', 'required' => true], ['docType' => 'insurance', 'name' => 'Insurance', 'required' => true]];
    $save = array_merge($input, ['name' => 'Property One Requirements', 'documents' => $docs]);
    $kyc->configurePropertyTemplate($app, $businessOne, $save);
    $version = (int) Db::table('merchant_application_business')->where('id', $businessOne)->value('kyc_template_id');
    $saved = (array) Db::table('merchant_kyc_template')->where('id', $version)->first();
    check($version !== $propertyTemplate && (int) $saved['application_business_id'] === $businessOne && (int) $saved['source_template_id'] === $propertyTemplate, 'custom requirements create a private template version');
    check((int) Db::table('merchant_application_business')->where('id', $businessTwo)->value('kyc_template_id') === $propertyTemplate, 'editing one property preserves the other property template');
    check(count(json_decode((string) Db::table('merchant_kyc_template')->where('id', $propertyTemplate)->value('docs'), true)) === 1, 'public template remains unchanged');
    check(count($kyc->propertyTemplateOptions($app, $businessOne)) === 1, 'private versions never become public template options');
    $requirements = $kyc->requirements($app)['initialProperties'][0];
    check($requirements['template']['name'] === 'Property One Requirements' && count($requirements['documents']) === 2, 'requirements expose the selected private version and its checklist');
    rejects(ErrorCode::DATA_CONFLICT, fn () => $kyc->configurePropertyTemplate($app, $businessOne, $save), 'stale template version cannot overwrite newer requirements');
    $next = array_merge($save, ['expectedTemplateId' => $version]);
    rejects(ErrorCode::PARAM_ERROR, fn () => $kyc->configurePropertyTemplate($app, $businessOne, array_merge($next, ['documents' => [$docs[0], $docs[0]]])), 'duplicate document types are rejected');
    rejects(ErrorCode::PARAM_ERROR, fn () => $kyc->configurePropertyTemplate($app, $businessOne, array_merge($next, ['documents' => []])), 'empty checklist is rejected');
    rejects(ErrorCode::PARAM_ERROR, fn () => $kyc->configurePropertyTemplate($app, $businessOne, array_merge($next, ['documents' => [['docType' => 'license', 'name' => 'License', 'required' => false]]])), 'checklist must retain a mandatory document');
    rejects(ErrorCode::PARAM_ERROR, fn () => $kyc->configurePropertyTemplate($app, $businessOne, array_merge($next, ['documents' => ['invalid']])), 'malformed document requirements are rejected');
    rejects(ErrorCode::PARAM_ERROR, fn () => $kyc->configurePropertyTemplate($app, $businessOne, array_merge($next, ['documents' => [['docType' => 'bad/type', 'name' => 'Bad', 'required' => true]]])), 'document type identifiers are validated');
    rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $kyc->configurePropertyTemplate($app, $businessTwo, array_merge($input, ['templateId' => $version])), 'another property cannot select a private template version');

    $insurance = Db::table('merchant_verify_document')->where('application_business_id', $businessOne)->where('doc_type', 'insurance')->first();
    Db::table('merchant_verify_document')->where('id', $insurance->id)->update(['file_url' => '/uploads/template-fixture.pdf', 'document_version' => 1, 'status' => 2]);
    $kyc->configurePropertyTemplate($app, $businessOne, ['expectedTemplateId' => $version, 'templateId' => $propertyTemplate]);
    $version = (int) Db::table('merchant_application_business')->where('id', $businessOne)->value('kyc_template_id');
    $archived = Db::table('merchant_verify_document')->where('id', $insurance->id)->first();
    check($archived->deleted_at !== null && $archived->file_url === '/uploads/template-fixture.pdf', 'removed requirements archive uploaded rows without deleting their file');
    $kyc->configurePropertyTemplate($app, $businessOne, array_merge($save, ['expectedTemplateId' => $version]));
    $version = (int) Db::table('merchant_application_business')->where('id', $businessOne)->value('kyc_template_id');
    $restored = Db::table('merchant_verify_document')->where('id', $insurance->id)->first();
    check($restored->deleted_at === null && (int) $restored->document_version === 1, 'reintroduced requirements restore uploaded files and versions');

    Db::table('merchant_application_business')->where('id', $businessOne)->update(['kyc_status' => 3, 'kyc_submitted_at' => gmdate('Y-m-d H:i:s')]);
    $change = ['expectedTemplateId' => $version, 'templateId' => $propertyTemplate];
    rejects(ErrorCode::DATA_CONFLICT, fn () => $kyc->configurePropertyTemplate($app, $businessOne, $change), 'submitted requirements are locked without an explicit change');
    rejects(ErrorCode::PARAM_ERROR, fn () => $kyc->configurePropertyTemplate($app, $businessOne, array_merge($change, ['amendment' => true, 'reason' => '  '])), 'submitted requirement changes need a reason');
    $kyc->configurePropertyTemplate($app, $businessOne, array_merge($change, ['amendment' => true, 'reason' => 'Operating requirements corrected']));
    $business = Db::table('merchant_application_business')->where('id', $businessOne)->first();
    check((int) $business->kyc_status === 1 && $business->kyc_submitted_at !== null, 'audited change reopens only the target property and preserves its submission history');
    check($kyc->requirements($app)['initialProperties'][0]['templateEditable'] === false, 'previously submitted draft remains locked for ordinary edits');
    check((int) Db::table('merchant_application_business')->where('id', $businessTwo)->value('kyc_status') === 1, 'amendment does not reset other property scopes');
    check(Db::table('merchant_verify_timeline')->where('application_id', $applicationId)->where('action', 'kyc_requirements_changed')->where('note', 'like', '%Operating requirements corrected%')->exists(), 'requirement changes record property, template versions and reason');
    check($kyc->readiness($app)['ready'] === false, 'changed requirements cannot bypass final approval');
    $finalApp = array_merge($app, ['merchant_id' => 123, 'account_status' => 1]);
    Db::table('merchant_application')->where('id', $applicationId)->update(['merchant_id' => 123, 'account_status' => 1]);
    rejects(ErrorCode::DATA_CONFLICT, fn () => $kyc->configurePropertyTemplate($finalApp, $businessOne, array_merge($change, ['expectedTemplateId' => (int) $business->kyc_template_id, 'amendment' => true, 'reason' => 'Too late'])), 'final approval locks property requirements');
} finally {
    Db::connection()->rollBack();
}
