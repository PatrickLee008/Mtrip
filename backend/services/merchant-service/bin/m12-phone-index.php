<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(1);
define('BASE_PATH', dirname(__DIR__));
require BASE_PATH . '/vendor/autoload.php';
putenv('SCAN_CACHEABLE=true');
Hyperf\Di\ClassLoader::init();
$container = require BASE_PATH . '/config/container.php';
$database = $container->get(Hyperf\Contract\ConfigInterface::class)->get('databases.default.database');
if (! in_array($database, ['mtrip_business', 'mtrip_m12_s1_test'], true)) {
    throw new RuntimeException('Unexpected database; review deployment before indexing');
}
$apply = in_array('--apply', $argv, true);
echo ($apply ? 'APPLY ' : 'DRY-RUN ') . json_encode($container->get(App\Service\MerchantPhoneIndexService::class)->run($apply)) . PHP_EOL;
