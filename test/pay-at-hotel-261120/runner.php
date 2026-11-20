<?php
declare(strict_types=1);
define('BASE_PATH', '/opt/www');
require BASE_PATH . '/vendor/autoload.php';
putenv('SCAN_CACHEABLE=false');
Hyperf\Di\ClassLoader::init();
$container = require BASE_PATH . '/config/container.php';
$db = $container->get(Hyperf\Contract\ConfigInterface::class)->get('databases.default.database');
if (! preg_match('/^pah_qa_[a-f0-9]{8}$/D', (string) $db)) throw new RuntimeException('Disposable schemas only');
$job = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$result = match ($job['action']) {
    'credit' => Hyperf\DbConnection\Db::transaction(static fn () => Mtrip\Shared\Wallet\WalletLedger::credit(7, (int) $job['uid'], (float) $job['amount'], 1, 0, 0, 'Isolated pay-at-hotel regression')),
    'reconcile' => $container->get(App\Service\PayAtHotelSettlementService::class)->generateDue(),
    'refund-queue' => $container->get(App\Service\Payment\RefundSettleService::class)->processQueue(),
    default => throw new RuntimeException('Unknown fixture action'),
};
echo 'PAH_RESULT=' . json_encode($result, JSON_THROW_ON_ERROR) . PHP_EOL;
