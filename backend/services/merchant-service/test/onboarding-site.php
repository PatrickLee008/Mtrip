<?php
declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Admin\MerchantController;
use App\Controller\Admin\OnboardingController;
use App\Controller\App\Merchant\RegistrationController;
use App\Service\MerchantRegistrationOtpService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;

AdminContext::set(['admin_id' => 1, 'admin_name' => 'Site policy test', 'site_id' => 0, 'is_super' => true]);
$controller = $container->get(MerchantController::class);
foreach ([1, 6] as $requestedSite) {
    setRequest(['siteId' => $requestedSite, 'merchantName' => 'Fixed site test ' . $requestedSite,
        'creditCode' => 'QA-SITE-' . $requestedSite, 'legalPerson' => 'Test', 'contactName' => 'Test', 'contactPhone' => '+95977001000']);
    $id = $controller->create()['data']['id'];
    check((int) Db::table('merchant_info')->where('id', $id)->value('site_id') === 7, 'admin merchant creation ignores requested site ' . $requestedSite);
}

$onboarding = $container->get(OnboardingController::class);
setRequest(['siteId' => 1, 'companyName' => 'Fixed site onboarding', 'registrationPhone' => '+95977001111',
    'registrationEmail' => 'fixed-site-onboarding@example.test', 'businesses' => [['businessName' => 'Fixed site property', 'businessType' => 'hotel']]]);
$result = $onboarding->create()['data'];
$id = (int) ($result['id'] ?? $result['applicationId'] ?? 0);
check($id > 0 && (int) Db::table('merchant_application')->where('id', $id)->value('site_id') === 7, 'admin onboarding application is created in site 7');
check((int) Db::table('merchant_application_business')->where('application_id', $id)->value('site_id') === 7, 'onboarding business uses the same fixed site');

AdminContext::set(['admin_id' => 2, 'admin_name' => 'Foreign scoped admin', 'site_id' => 6, 'is_super' => false,
    'permissions' => ['merchant:list:add', 'merchant:onboarding:create']]);
setRequest(['creditCode' => 'QA-SITE-FOREIGN', 'companyName' => 'Foreign site']);
rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $controller->create(), 'foreign scoped admin cannot create across sites');
rejects(ErrorCode::NO_DATA_PERMISSION, fn () => $onboarding->create(), 'foreign scoped admin cannot create onboarding across sites');

class SiteRecordingOtp extends MerchantRegistrationOtpService
{
    public array $sites = [];
    public function availableChannels(int $siteId): array { $this->sites[] = $siteId; return []; }
    public function send(int $siteId, string $phone, string $email, string $channel, string $ip): array { $this->sites[] = $siteId; return []; }
    public function verify(int $siteId, string $phone, string $email, string $channel, string $code): array { $this->sites[] = $siteId; return ['applicationId' => 1, 'registrationToken' => 'test-only']; }
}
$registration = $container->get(RegistrationController::class);
$otp = new SiteRecordingOtp();
(new ReflectionProperty(RegistrationController::class, 'otp'))->setValue($registration, $otp);
setRequest(['phone' => '+95977001222', 'email' => 'site-test@example.test', 'otpChannel' => 'email', 'otpCode' => '123456']);
check($registration->config()['data']['siteId'] === 7, 'public registration config reports canonical site 7');
check($registration->sendOtp()['data']['siteId'] === 7, 'registration OTP uses canonical site 7');
check($registration->verifyOtp()['data']['siteId'] === 7, 'verified registration reports canonical site 7');
check($otp->sites === [7, 7, 7], 'all public registration controller operations delegate to site 7');

echo "Fixed merchant onboarding site integration tests passed.\n";
