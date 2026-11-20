<?php
declare(strict_types=1);
define('BASE_PATH', '/opt/www');
require BASE_PATH . '/vendor/autoload.php';
putenv('SCAN_CACHEABLE=false');
Hyperf\Di\ClassLoader::init();
$container = require BASE_PATH . '/config/container.php';
$db = $container->get(Hyperf\Contract\ConfigInterface::class)->get('databases.default.database');
if (! preg_match('/^prd_qa_[a-f0-9]{8}$/D', (string) $db)) throw new RuntimeException('Disposable schemas only');
$job = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
try {
    $value = Hyperf\DbConnection\Db::transaction(static function () use ($job) {
        return Mtrip\Shared\Wallet\WalletLedger::credit((int) $job['site'], (int) $job['uid'], (float) $job['amount'], 1, 0, 0, 'Isolated PRD regression');
    });
    $result = ['ok' => true, 'value' => $value];
} catch (Throwable $e) { $result = ['ok' => false, 'code' => $e->getCode(), 'message' => $e->getMessage()]; }
echo 'PRD_RESULT=' . json_encode($result, JSON_THROW_ON_ERROR) . PHP_EOL;
