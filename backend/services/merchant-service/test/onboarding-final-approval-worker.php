<?php

declare(strict_types=1);

require '/tmp/M12Bootstrap.php';

use App\Service\OnboardingFinalApprovalService;
use Mtrip\Shared\Context\AdminContext;

$applicationId = (int) ($argv[1] ?? 0);
$requestId = (string) ($argv[2] ?? '');
AdminContext::set([
    'admin_id' => 94001, 'admin_name' => 'Stage 4 Super', 'site_id' => 0, 'is_super' => true,
    'permissions' => ['merchant:onboarding:final-approve'],
]);

try {
    $result = $container->get(OnboardingFinalApprovalService::class)->approve($applicationId, $requestId, ['email']);
    echo json_encode(['ok' => true, 'merchantId' => $result['merchantId']]) . PHP_EOL;
} catch (Throwable $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]) . PHP_EOL;
    exit(1);
}
