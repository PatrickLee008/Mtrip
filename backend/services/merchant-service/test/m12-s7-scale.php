<?php
declare(strict_types=1);

if (getenv('MTRIP_S7_ISOLATED') !== '1') throw new RuntimeException('Dedicated S7 container required');
require __DIR__ . '/M12Bootstrap.php'; // Enforces the dedicated integration database.

use App\Controller\MerchantController;
use App\Controller\MerchantActivityController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;

// Transaction rollback removes only this run's synthetic records; no schema or existing data edits.
$db = Db::connection();
$db->beginTransaction();
try {
    $key = 's7-scale-' . bin2hex(random_bytes(5));
    AdminContext::set(['admin_id' => 907, 'admin_name' => 'S7 scale', 'site_id' => 991, 'is_super' => true, 'permissions' => []]);
    for ($batch = 0; $batch < 10; ++$batch) {
        $rows = [];
        for ($i = 0; $i < 100; ++$i) $rows[] = ['site_id' => 991, 'merchant_name' => $key . '-' . ($batch * 100 + $i),
            'credit_code' => $key . '-' . ($batch * 100 + $i), 'legal_person' => 'Synthetic', 'contact_name' => 'Synthetic', 'contact_phone' => '', 'status' => 3];
        Db::table('merchant_info')->insert($rows);
    }
    $merchantId = (int) Db::table('merchant_info')->where('merchant_name', $key . '-0')->value('id');
    for ($batch = 0; $batch < 10; ++$batch) {
        $rows = [];
        for ($i = 0; $i < 500; ++$i) $rows[] = ['site_id' => 991, 'merchant_id' => $merchantId, 'event' => $key . '-' . ($batch * 500 + $i), 'reviewer' => 'S7 scale'];
        Db::table('compliance_history')->insert($rows);
    }
    $directory = $container->get(MerchantController::class);
    $history = $container->get(MerchantActivityController::class);
    $plans = [];
    foreach (['directory' => [$directory, 'index', ['siteId' => 991, 'keyword' => $key, 'page' => 25, 'pageSize' => 20]],
        'history' => [$history, 'history', ['siteId' => 991, 'merchantId' => $merchantId, 'source' => 'compliance', 'page' => 100, 'pageSize' => 20]]] as $name => [$controller, $method, $input]) {
        $times = [];
        $db->enableQueryLog();
        $db->flushQueryLog();
        for ($run = 0; $run < 10; ++$run) {
            setRequest($input);
            $start = microtime(true);
            $data = $controller->$method()['data'];
            $times[] = round((microtime(true) - $start) * 1000, 2);
            if ($data['total'] !== ($name === 'directory' ? 1000 : 5000) || count($data['list']) !== 20) throw new RuntimeException('Scale pagination mismatch');
        }
        $queries = $db->getQueryLog();
        $db->disableQueryLog();
        foreach ($queries as $query) {
            if (str_starts_with(strtolower($query['query']), 'select') && !isset($plans[$query['query']])) {
                $plans[$query['query']] = true;
                echo 'EXPLAIN ' . $name . ' ' . $query['query'] . ' ' . json_encode($db->select('EXPLAIN ' . $query['query'], $query['bindings'])) . "\n";
            }
        }
        sort($times);
        echo "BASELINE $name rows=" . $data['total'] . ' page=' . $input['page'] . ' runs=10 median_ms=' . $times[4] . ' max_ms=' . end($times) . "\n";
    }
    $ids = []; $cursor = 0; $snapshot = 0; $start = microtime(true);
    do {
        setRequest(['siteId' => 991, 'merchantId' => $merchantId, 'source' => 'compliance', 'export' => 1, 'pageSize' => 200, 'snapshotId' => $snapshot, 'beforeId' => $cursor]);
        $page = $history->history()['data'];
        $ids = array_merge($ids, array_column($page['list'], 'id'));
        $snapshot = $page['snapshotId']; $cursor = $page['nextBeforeId'];
    } while ($cursor !== null);
    check(count($ids) === 5000 && count(array_unique($ids)) === 5000, 'S7 scale export 5000 rows without omission or duplicate');
    echo 'BASELINE export rows=5000 elapsed_ms=' . round((microtime(true) - $start) * 1000, 2) . "\n";
} finally {
    $db->rollBack();
}
check(!Db::table('merchant_info')->where('merchant_name', 'like', $key . '%')->exists(), 'S7 scale fixture transaction fully rolled back');
