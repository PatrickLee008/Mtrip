<?php
declare(strict_types=1);
require __DIR__ . '/M12Bootstrap.php';

use App\Service\OnboardingReapplyService;
use Mtrip\Shared\Context\AdminContext;

AdminContext::set(['admin_id' => 94002, 'admin_name' => 'Concurrent Reopen Super', 'site_id' => 0, 'is_super' => true]);
echo "REOPEN_READY\n"; flush();
try {
    $container->get(OnboardingReapplyService::class)->adminReopen((int) $argv[1], [
        'reason' => 'Concurrent isolated test', 'expectedRegistrationStatus' => 5, 'expectedStage' => 1,
    ]);
    echo json_encode(['ok' => true]) . PHP_EOL;
} catch (Mtrip\Shared\Exception\BusinessException $e) {
    echo json_encode(['ok' => false, 'code' => $e->getCode()]) . PHP_EOL;
}
