<?php

declare(strict_types=1);

define('BASE_PATH', '/opt/www');
require BASE_PATH . '/vendor/autoload.php';
putenv('SCAN_CACHEABLE=false');
Hyperf\Di\ClassLoader::init();
$container = require BASE_PATH . '/config/container.php';
$database = $container->get(Hyperf\Contract\ConfigInterface::class)->get('databases.default.database');
if (! preg_match('/^referral_qa_[a-f0-9]{8}$/', (string) $database)) {
    throw new RuntimeException('Referral fixtures require an isolated database');
}
$job = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
try {
    if ($job['mode'] === 'checkin') {
        $container->get(App\Service\Booking\BookingLifecycleService::class)
            ->checkIn((int) $job['order'], 99001, 'Referral QA');
    } else {
        Hyperf\DbConnection\Db::transaction(static function () use ($container, $job): void {
            $container->get(App\Service\ReferralService::class)
                ->grantOnFirstBooking((int) $job['site'], (int) $job['uid'], (int) $job['order']);
        });
    }
    $result = ['ok' => true];
} catch (Throwable $e) {
    $result = ['ok' => false, 'code' => $e->getCode(), 'message' => $e->getMessage()];
}
echo 'REFERRAL_RESULT=' . json_encode($result, JSON_THROW_ON_ERROR) . PHP_EOL;
