<?php
declare(strict_types=1);
require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\OnboardingController;
use App\Service\MerchantAppOnboardingService;
use App\Service\MerchantRegistrationOtpService;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\JwtHelper;

$service = $container->get(MerchantAppOnboardingService::class);
$admin = $container->get(OnboardingController::class);
$otp = $container->get(MerchantRegistrationOtpService::class);
$key = (string) Hyperf\Config\config('mtrip.aes_key');
$jwt = (string) Hyperf\Config\config('mtrip.jwt_secret');
$phone = '+95911122444'; $email = 'reapply@example.test';
$phoneHash = hash_hmac('sha256', 'merchant-registration-phone-v1:' . $phone, $key);
$emailHash = hash_hmac('sha256', 'merchant-registration-email-v1:' . $email, $key);
$id = (int) Db::table('merchant_application')->insertGetId([
    'site_id' => 7, 'app_no' => 'REAPPLY-TEST-001', 'state_model_version' => 1, 'stage' => 1,
    'registration_status' => 5, 'company_name' => 'Original company', 'reg_number' => 'ORIGINAL-001',
    'num_businesses' => 1, 'business_types' => 'car_rental', 'country' => 'Myanmar', 'city' => 'Yangon', 'address' => 'Original company address',
    'registration_phone' => CryptoHelper::encrypt($phone, $key), 'registration_phone_index' => $phoneHash,
    'registration_email' => CryptoHelper::encrypt($email, $key), 'registration_email_index' => $emailHash,
    'submitted_at' => '2026-11-01 00:00:00', 'registration_reviewed_at' => '2026-11-02 00:00:00',
    'registration_reviewed_by' => 94001, 'registration_review_reason' => 'Original refusal',
]);
$businessId = (int) Db::table('merchant_application_business')->insertGetId([
    'site_id' => 7, 'application_id' => $id, 'client_ref' => 'reapply-car', 'business_name' => 'Original cars',
    'business_type' => 'car_rental', 'country_code' => 'MM', 'city' => 'Yangon', 'city_key' => 'yangon', 'address' => 'Original business address', 'contact_name' => 'Original contact',
    'contact_phone' => CryptoHelper::encrypt($phone, $key), 'contact_email' => $email,
]);
Db::table('merchant_verify_timeline')->insert(['site_id' => 7, 'application_id' => $id, 'merchant_id' => 0,
    'action' => 'rejected', 'operator_id' => 94001, 'operator_name' => 'Original reviewer', 'note' => 'Original refusal']);
$token = JwtHelper::issue(['aud' => 'merchant_registration', 'site_id' => 7, 'application_id' => $id,
    'phone_hash' => $phoneHash, 'email_hash' => $emailHash], $jwt, 3600);
$call = static function (string $method, array $input) use ($admin): mixed { setRequest($input); return $admin->$method()['data']; };
$super = ['admin_id' => 94002, 'admin_name' => 'Reopen Super', 'site_id' => 0, 'is_super' => true];
$payload = ['id' => $id, 'reason' => 'Applicant supplied clarification', 'expectedRegistrationStatus' => 5, 'expectedStage' => 1];
check(($service->status(7, $token, $id)['canReapply'] ?? false) === true, 'rejected base status advertises explicit reapplication');
rejects(ErrorCode::DATA_CONFLICT, fn () => $service->save(7, $token, ['applicationId' => $id, 'companyName' => 'Implicit reopen']), 'rejected application remains read-only until explicit reopen');
rejects(ErrorCode::UNAUTHORIZED, fn () => $service->reopen(8, $token, $id), 'reopen token cannot cross sites');
rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $service->reopen(7, $token, $id + 1), 'reopen token cannot target another application');
$expired = JwtHelper::issue(['aud' => 'merchant_registration', 'site_id' => 7, 'application_id' => $id,
    'phone_hash' => $phoneHash, 'email_hash' => $emailHash], $jwt, -1);
rejects(ErrorCode::TOKEN_EXPIRED, fn () => $service->reopen(7, $expired, $id), 'expired registration session cannot reopen');
AdminContext::set(['admin_id' => 94003, 'site_id' => 7, 'is_super' => false, 'permissions' => ['merchant:onboarding:reopen']]);
rejects(ErrorCode::FORBIDDEN, fn () => $call('reopen', $payload), 'ordinary administrator cannot reopen even with permission');
AdminContext::set($super);
rejects(ErrorCode::PARAM_ERROR, fn () => $call('reopen', array_replace($payload, ['reason' => ' '])), 'admin reopening requires a reason');
rejects(ErrorCode::PARAM_ERROR, fn () => $call('reopen', ['id' => $id, 'reason' => 'Missing snapshot']), 'admin reopening requires expected state');
rejects(ErrorCode::DATA_CONFLICT, fn () => $call('reopen', array_replace($payload, ['expectedStage' => 6])), 'stale admin snapshot cannot reopen');
// Revalidating the original identity recovers the same refused record without changing it.
$redis = $container->get(Redis::class);
$redis->setex("mtrip:merchant:registration:otp:7:email:$emailHash", 300, json_encode(['type' => 'email',
    'codeHash' => hash_hmac('sha256', '246810', $jwt), 'attempts' => 0, 'maxAttempts' => 5, 'phoneHash' => $phoneHash, 'emailHash' => $emailHash]));
$restored = $otp->verify(7, $phone, $email, 'email', '246810');
check((int) $restored['applicationId'] === $id && (int) Db::table('merchant_application')->where('id', $id)->value('registration_status') === 5, 'OTP identity recovery never implicitly reopens refusal');
$detail = $service->reopen(7, $restored['registrationToken'], $id);
check($detail['registrationStatus'] === 'resubmit_required' && $detail['canEdit'] && !$detail['canReapply']
    && $detail['application']['companyName'] === 'Original company' && count($detail['businesses']) === 1, 'explicit app reopen returns editable full original detail');
check($detail['merchantKycStatus'] === 'locked' && $detail['accountStatus'] === 'not_created', 'reopening leaves KYC and account gates locked');
rejects(ErrorCode::FORBIDDEN, fn () => $service->requirements(7, $token, $id), 'reopening does not grant KYC access');
rejects(ErrorCode::DATA_CONFLICT, fn () => $service->reopen(7, $token, $id), 'duplicate app reopen conflicts without creating another round');
$history = $call('detail', ['id' => $id])['registrationHistory'];
check(count($history) === 1 && (int) $history[0]['registration_status'] === 5 && $history[0]['review_reason'] === 'Original refusal'
    && $history[0]['reviewer_name'] === 'Original reviewer' && $history[0]['reviewed_at'] === '2026-11-02 00:00:00', 'old refusal retains known decision reviewer and timestamp');
check($history[0]['snapshot']['application']['address'] === 'Original company address'
    && $history[0]['snapshot']['businesses'][0]['country_code'] === 'MM'
    && $history[0]['snapshot']['businesses'][0]['city_key'] === 'yangon'
    && $history[0]['snapshot']['businesses'][0]['address'] === 'Original business address', 'submission history retains actual company and business location fields');
check($history[0]['snapshot']['application']['reg_number'] === 'ORIGINAL-001'
    && $history[0]['snapshot']['businesses'][0]['contact_phone'] === $phone, 'old known company and business values are archived before reopening');
$firstSnapshot = Db::table('merchant_application_registration_review')->where('application_id', $id)->value('snapshot');
check(!str_contains($firstSnapshot, $phone), 'history stores encrypted business phone');
$service->save(7, $token, ['applicationId' => $id, 'companyName' => 'Revised company', 'regNumber' => 'REVISED-002',
    'businesses' => [['applicationBusinessId' => $businessId, 'businessName' => 'Revised cars', 'contactName' => 'Revised contact']]]);
$service->submit(7, $token, $id); $service->submit(7, $token, $id);
check(Db::table('merchant_application_registration_review')->where('application_id', $id)->count() === 2, 'submission creates exactly one new round despite duplicate submit');
$call('registrationReviewStart', ['id' => $id]);
$call('reject', ['id' => $id, 'reasonCode' => 2, 'note' => 'Second refusal']);
$history = $call('detail', ['id' => $id])['registrationHistory'];
check((int) $history[0]['round_no'] === 2 && (int) $history[0]['registration_status'] === 5
    && $history[0]['reviewer_name'] === 'Reopen Super' && str_contains($history[0]['review_reason'], 'Second refusal')
    && $history[0]['snapshot']['application']['company_name'] === 'Revised company', 'new review decision attaches to the new immutable submission');
check(Db::table('merchant_application_registration_review')->where('application_id', $id)->orderBy('round_no')->value('snapshot') === $firstSnapshot,
    'editing and rejecting a new submission never changes the old snapshot');
AdminContext::set(['admin_id' => 94004, 'site_id' => 7, 'is_super' => false, 'permissions' => ['merchant:list:audit']]);
$masked = $call('detail', ['id' => $id])['registrationHistory'];
check($masked[0]['snapshot']['businesses'][0]['contact_phone'] !== $phone && $masked[0]['snapshot']['businesses'][0]['contact_phone'] !== '', 'audit-only history uses existing detail phone masking');
AdminContext::set($super);
$call('reopen', $payload);
check((int) Db::table('merchant_application')->where('id', $id)->value('registration_status') === 4
    && Db::table('merchant_application_registration_review')->where('application_id', $id)->count() === 2, 'super admin reopen restores correction without creating a submission');
check(Db::table('merchant_verify_timeline')->where('application_id', $id)->where('action', 'registration_reopened')->where('operator_id', 94002)->where('note', 'like', '%clarification%')->exists(), 'admin reopening audits operator and required reason');
rejects(ErrorCode::DATA_CONFLICT, fn () => $call('reopen', $payload), 'duplicate admin reopen rejects stale state');
Db::table('merchant_application')->where('id', $id)->update(['registration_status' => 5]);
foreach ([['merchant_id' => 12345], ['account_status' => 1], ['merchant_kyc_status' => 6], ['state_model_version' => 0, 'stage' => 6], ['final_approved_at' => '2026-11-01 00:00:00'], ['final_approval_request_id' => 'existing-approval'], ['registration_email' => ''], ['registration_phone_released_at' => gmdate('Y-m-d H:i:s')]] as $patch) {
    $original = (array) Db::table('merchant_application')->where('id', $id)->first();
    Db::table('merchant_application')->where('id', $id)->update($patch);
    rejects(ErrorCode::DATA_CONFLICT, fn () => $call('reopen', array_replace($payload, ['expectedStage' => (int) ($patch['stage'] ?? 1)])), 'formal entity KYC legacy or incomplete identity blocks reopen ' . array_key_first($patch));
    Db::table('merchant_application')->where('id', $id)->update(array_intersect_key($original, $patch));
}
$deliveryId = Db::table('merchant_credential_delivery')->insertGetId(['site_id' => 7, 'application_id' => $id, 'merchant_id' => 12345,
    'account_id' => 12345, 'approval_request_id' => 'reapply-guard-test', 'channel' => 'email', 'credential_ciphertext' => 'test', 'payload_hash' => str_repeat('a', 64)]);
rejects(ErrorCode::DATA_CONFLICT, fn () => $call('reopen', $payload), 'existing credential delivery blocks reopening even with empty merchant link');
Db::table('merchant_credential_delivery')->where('id', $deliveryId)->delete();
Db::table('merchant_application')->where('id', $id)->update(['registration_status' => 3, 'merchant_kyc_status' => 6]);
$container->get(\App\Service\OnboardingKycService::class)->initialize((array) Db::table('merchant_application')->where('id', $id)->first());
check(!$service->status(7, $token, $id)['canReapply'], 'KYC rejection cannot advertise basic registration reopen');
Db::table('merchant_application_business')->where('id', $businessId)->update(['kyc_status' => 0]);
Db::table('merchant_application')->where('id', $id)->update(['registration_status' => 5, 'merchant_kyc_status' => 0]);
$command = 'php /tmp/onboarding-reapply-worker.php ' . $id;
$workers = [];
for ($i = 0; $i < 2; $i++) {
    $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    check(is_resource($process) && trim(fgets($pipes[1])) === 'REOPEN_READY', 'concurrent reopen worker starts');
    $workers[] = [$process, $pipes];
}
$results = [];
foreach ($workers as [$process, $pipes]) {
    $results[] = json_decode(trim(stream_get_contents($pipes[1])), true, 512, JSON_THROW_ON_ERROR);
    $errors = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]);
    check(proc_close($process) === 0 && $errors === '', 'concurrent reopen worker exits cleanly');
}
check(count(array_filter($results, static fn ($result) => $result['ok'])) === 1
    && count(array_filter($results, static fn ($result) => !$result['ok'] && $result['code'] === ErrorCode::DATA_CONFLICT)) === 1,
    'simultaneous reopen requests serialize to one transition and one conflict');
check(Db::table('merchant_application_registration_review')->where('application_id', $id)->count() === 2,
    'concurrent reopening creates no duplicate round');
Db::table('merchant_application')->where('id', $id)->update(['registration_status' => 5]);
$merchantCounts = [Db::table('merchant_info')->count(), Db::table('merchant_admin')->count(), Db::table('merchant_store')->count()];
Db::beginTransaction();
Db::table('merchant_application')->where('id', $id)->lockForUpdate()->first();
$process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
check(is_resource($process) && trim(fgets($pipes[1])) === 'REOPEN_READY', 'reopen contender starts while deletion owns application lock');
$call('delete', ['id' => $id, 'confirmAppNo' => 'REAPPLY-TEST-001', 'reason' => 'Remove isolated fixture', 'expectedRegistrationStatus' => 5, 'expectedKycStatus' => 0, 'expectedStage' => 1]);
Db::commit();
$result = json_decode(trim(stream_get_contents($pipes[1])), true, 512, JSON_THROW_ON_ERROR);
$errors = stream_get_contents($pipes[2]); fclose($pipes[1]); fclose($pipes[2]);
check(proc_close($process) === 0 && $errors === '' && !$result['ok'] && $result['code'] === ErrorCode::NOT_FOUND,
    'waiting reopen sees committed deletion and cannot recreate the application');
check(!Db::table('merchant_application_registration_review')->where('application_id', $id)->exists(), 'permanent deletion removes all registration review rounds');
rejects(ErrorCode::UNAUTHORIZED, fn () => $service->reopen(7, $token, $id), 'deleted registration cannot be reopened by its former token');
check($merchantCounts === [Db::table('merchant_info')->count(), Db::table('merchant_admin')->count(), Db::table('merchant_store')->count()], 'reopening and submission create no formal entities');

// Pre-history applications must archive their last known round before the first new write.
$oldRoundFixture = static function (int $status, int $suffix) use ($key, $jwt): array {
    $phone = '+95911122' . $suffix; $email = 'old-round-' . $suffix . '@example.test';
    $phoneHash = hash_hmac('sha256', 'merchant-registration-phone-v1:' . $phone, $key);
    $emailHash = hash_hmac('sha256', 'merchant-registration-email-v1:' . $email, $key);
    $id = (int) Db::table('merchant_application')->insertGetId([
        'site_id' => 7, 'app_no' => 'OLD-ROUND-' . $suffix, 'state_model_version' => 1, 'registration_status' => $status,
        'company_name' => 'Old company ' . $suffix, 'reg_number' => 'OLD-REG-' . $suffix,
        'num_businesses' => 1, 'business_types' => 'car_rental',
        'registration_phone' => CryptoHelper::encrypt($phone, $key), 'registration_phone_index' => $phoneHash,
        'registration_email' => CryptoHelper::encrypt($email, $key), 'registration_email_index' => $emailHash,
        'submitted_at' => $status === 0 ? null : '2026-10-01 00:00:00',
        'registration_reviewed_by' => 94005, 'registration_reviewed_at' => '2026-10-02 00:00:00',
        'registration_review_reason' => 'Old correction reason',
    ]);
    $businessId = (int) Db::table('merchant_application_business')->insertGetId([
        'site_id' => 7, 'application_id' => $id, 'client_ref' => 'old-car', 'business_name' => 'Old business ' . $suffix,
        'business_type' => 'car_rental', 'contact_name' => 'Old contact', 'contact_phone' => CryptoHelper::encrypt($phone, $key), 'contact_email' => $email,
    ]);
    Db::table('merchant_verify_timeline')->insert(['site_id' => 7, 'application_id' => $id, 'merchant_id' => 0,
        'action' => 'registration_resubmit_required', 'operator_id' => 94005, 'operator_name' => 'Old correction reviewer', 'note' => 'Old correction reason']);
    return [$id, JwtHelper::issue(['aud' => 'merchant_registration', 'site_id' => 7, 'application_id' => $id,
        'phone_hash' => $phoneHash, 'email_hash' => $emailHash], $jwt, 3600), $businessId];
};
$boundaryFailures = [];
$expectBoundary = static function (bool $condition, string $name) use (&$boundaryFailures): void {
    echo ($condition ? 'PASS: ' : 'FAIL: ') . $name . PHP_EOL;
    if (!$condition) $boundaryFailures[] = $name;
};
[$oldId, $oldToken, $oldBusiness] = $oldRoundFixture(4, 501);
$service->save(7, $oldToken, ['applicationId' => $oldId, 'companyName' => 'New corrected company',
    'businesses' => [['applicationBusinessId' => $oldBusiness, 'businessName' => 'New corrected business']]]);
$oldHistory = $call('detail', ['id' => $oldId])['registrationHistory'];
$expectBoundary(count($oldHistory) === 1 && ($oldHistory[0]['snapshot']['application']['company_name'] ?? '') === 'Old company 501'
    && ($oldHistory[0]['snapshot']['businesses'][0]['business_name'] ?? '') === 'Old business 501', 'old correction save archives company and business before edits');
$expectBoundary(($oldHistory[0]['review_reason'] ?? '') === 'Old correction reason'
    && ($oldHistory[0]['reviewer_name'] ?? '') === 'Old correction reviewer'
    && ($oldHistory[0]['reviewed_at'] ?? '') === '2026-10-02 00:00:00', 'old correction save retains prior reason reviewer and reviewed time');
$service->submit(7, $oldToken, $oldId);
$oldHistory = $call('detail', ['id' => $oldId])['registrationHistory'];
$expectBoundary(count($oldHistory) === 2 && ($oldHistory[1]['snapshot']['application']['company_name'] ?? '') === 'Old company 501'
    && ($oldHistory[0]['snapshot']['application']['company_name'] ?? '') === 'New corrected company', 'old correction save then submit preserves prior round and adds next submission');
[$directId, $directToken] = $oldRoundFixture(4, 502);
$service->submit(7, $directToken, $directId);
$directHistory = $call('detail', ['id' => $directId])['registrationHistory'];
$expectBoundary(count($directHistory) === 2 && ($directHistory[1]['registration_status'] ?? 0) === 4
    && ($directHistory[1]['review_reason'] ?? '') === 'Old correction reason'
    && ($directHistory[1]['reviewer_name'] ?? '') === 'Old correction reviewer'
    && ($directHistory[1]['submitted_at'] ?? '') === '2026-10-01 00:00:00'
    && ($directHistory[1]['reviewed_at'] ?? '') === '2026-10-02 00:00:00'
    && ($directHistory[0]['registration_status'] ?? 0) === 1, 'old correction direct submit archives known decision before resetting review fields');
foreach ([1, 2, 4] as $status) {
    [$numberId] = $oldRoundFixture($status, 510 + $status);
    $call('updateRegistrationNumber', ['id' => $numberId, 'regNumber' => 'NEW-REG-' . $status,
        'expectedRegNumber' => 'OLD-REG-' . (510 + $status), 'reason' => 'Correct old number']);
    $numberHistory = $call('detail', ['id' => $numberId])['registrationHistory'];
    $expectBoundary(count($numberHistory) === 1
        && ($numberHistory[0]['snapshot']['application']['reg_number'] ?? '') === 'OLD-REG-' . (510 + $status), 'admin number amendment archives pre-history registration state ' . $status);
    [$assessmentId] = $oldRoundFixture($status, 520 + $status);
    $call('saveAssessment', ['id' => $assessmentId, 'businessTypes' => 'restaurant', 'numBusinesses' => 3]);
    $assessmentHistory = $call('detail', ['id' => $assessmentId])['registrationHistory'];
    $expectBoundary(count($assessmentHistory) === 1 && ($assessmentHistory[0]['snapshot']['application']['business_types'] ?? '') === 'car_rental'
        && (int) ($assessmentHistory[0]['snapshot']['application']['num_businesses'] ?? 0) === 1, 'admin assessment archives pre-history registration state ' . $status);
}
[$draftId, $draftToken] = $oldRoundFixture(0, 530);
$service->save(7, $draftToken, ['applicationId' => $draftId, 'companyName' => 'Unsubmitted draft']);
$call('saveAssessment', ['id' => $draftId, 'businessTypes' => 'restaurant', 'numBusinesses' => 2]);
$expectBoundary(!Db::table('merchant_application_registration_review')->where('application_id', $draftId)->exists(), 'unsubmitted draft edits do not fabricate a submitted review round');
check($boundaryFailures === [], 'all pre-history registration write boundaries preserve original known rounds');
