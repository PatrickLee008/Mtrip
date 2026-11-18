<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Service\MerchantDocumentService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;

AdminContext::set(['admin_id' => 94001, 'admin_name' => 'Concurrent Reviewer', 'site_id' => 0, 'is_super' => true, 'permissions' => []]);
[$script, $docId, $version, $barrier] = $argv;
Db::transaction(static function () use ($docId, $version, $barrier): void {
    // Both requests establish their repeatable-read snapshot before either may approve its file.
    Db::table('merchant_verify_document')->where('id', (int) $docId)->first();
    echo "SNAPSHOT_READY\n";
    flush();
    $deadline = microtime(true) + 10;
    while (! is_file($barrier)) {
        if (microtime(true) > $deadline) throw new RuntimeException('Concurrent review barrier timed out');
        usleep(10000);
    }
    (new MerchantDocumentService())->review((int) $docId, ['action' => 'verify', 'expectedVersion' => (int) $version]);
});
echo "REVIEW_COMPLETE\n";
