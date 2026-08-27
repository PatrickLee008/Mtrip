<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\Merchant\NotificationController as Inbox;
use App\Controller\MerchantDocumentController;
use App\Controller\NotificationController;
use App\Controller\VerifyController;
use App\Service\MerchantDocumentService;
use App\Service\MerchantNotificationService;
use Hyperf\DbConnection\Db;
use Hyperf\HttpMessage\Upload\UploadedFile;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;

function s3Actor(bool $super = true, int $site = 991, array $permissions = []): void {
    AdminContext::set(['admin_id' => 903, 'admin_name' => 'S3 Tester', 'site_id' => $site, 'is_super' => $super, 'permissions' => $permissions]);
}
function s3Call(object $controller, string $method, array $params = []): mixed {
    setRequest($params);
    return $controller->$method()['data'];
}
$documents = new MerchantDocumentService();
$notifications = new MerchantNotificationService();
if (($argv[1] ?? '') === '--due') { echo $notifications->deliverDue(); exit; }
if (($argv[1] ?? '') === '--review') {
    $config->set('storage.upload_root', $argv[4]);
    s3Actor();
    try { $documents->review((int) $argv[2], ['expectedVersion' => (int) $argv[3], 'action' => 'verify']); echo 'reviewed'; }
    catch (\Mtrip\Shared\Exception\BusinessException $e) { echo 'rejected:' . $e->getCode(); }
    exit;
}
$ids = $docIds = $tempFiles = $appIds = $accountIds = [];
$constraint = false;
$fixtureRoot = sys_get_temp_dir() . '/m12-s3-' . bin2hex(random_bytes(8));
mkdir($fixtureRoot, 0700);
$config->set('storage.upload_root', $fixtureRoot);
function s3File(string $content = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"): UploadedFile {
    global $tempFiles;
    $path = tempnam(sys_get_temp_dir(), 'm12-s3-');
    $tempFiles[] = $path;
    file_put_contents($path, $content);
    return new UploadedFile($path, strlen($content), UPLOAD_ERR_OK, 'fixture.pdf', 'application/pdf');
}
function s3Parallel(string $args): void {
    $command = PHP_BINARY . ' ' . escapeshellarg(__FILE__) . ' ' . $args;
    $pipes1 = $pipes2 = [];
    $p1 = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes1);
    $p2 = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes2);
    foreach ([[$p1, $pipes1], [$p2, $pipes2]] as [$process, $pipes]) {
        $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        if (proc_close($process) !== 0) throw new RuntimeException('S3 parallel child failed: ' . $out . $err);
    }
}
try {
    s3Actor();
    $id = $ids[] = merchantFixture();
    $foreign = $ids[] = merchantFixture(992);
    $docId = $docIds[] = (int) Db::table('merchant_verify_document')->insertGetId(['site_id' => 991, 'merchant_id' => $id, 'doc_type' => 'hotel_license', 'name' => 'Legacy license', 'status' => 1, 'reviewer_name' => 'Legacy reviewer', 'file_url' => '/uploads/kyc/legacy.pdf']);
    $base = ['expectedVersion' => 0, 'reason' => 'Renew hotel license', 'expiryDate' => '2030-12-31'];
    s3Actor(false, 991, ['merchant:document:verify']);
    rejects(40301, fn () => $documents->replace($docId, $base, s3File()), 'S3 review permission cannot replace');
    s3Actor(false, 992, ['merchant:document:replace']);
    rejects(40302, fn () => $documents->replace($docId, $base, s3File()), 'S3 cross-site replace denied');
    s3Actor();
    rejects(40001, fn () => $documents->replace($docId, array_replace($base, ['reason' => ' ']), s3File()), 'S3 replacement reason required');
    rejects(40001, fn () => $documents->replace($docId, $base, s3File('<script>not a PDF</script>')), 'S3 spoofed MIME denied');
    rejects(40001, fn () => $documents->replace($docId, array_replace($base, ['expiryDate' => '2030-02-30']), s3File()), 'S3 invalid expiry date denied');
    $result = $documents->replace($docId, $base, s3File());
    check($result['document_version'] === 1 && $result['status'] === 2, 'S3 replacement creates pending v1');
    $old = Db::table('merchant_verify_document_revision')->where('doc_id', $docId)->where('lifecycle_version', 0)->first();
    check($old->status === 1 && $old->reviewer_name === 'Legacy reviewer' && $old->file_url === '/uploads/kyc/legacy.pdf', 'S3 legacy file and decision retained');
    check(Db::table('merchant_info')->where('id', $id)->value('status') === 3, 'S3 document replacement does not suspend merchant');
    rejects(40901, fn () => $documents->review($docId, ['expectedVersion' => 0, 'action' => 'verify']), 'S3 stale review denied');
    rejects(40901, fn () => $documents->replace($docId, $base, s3File()), 'S3 stale replacement denied');
    $verify = $container->get(VerifyController::class);
    s3Actor(false, 991, ['merchant:verify:doc']);
    rejects(40301, fn () => s3Call($verify, 'docReview', ['docId' => $docId, 'expectedVersion' => 1, 'action' => 'verify']), 'S3 old module11 endpoint cannot bypass management review permission');
    s3Actor(false, 991, ['merchant:document:replace']);
    rejects(40301, fn () => $documents->review($docId, ['expectedVersion' => 1, 'action' => 'verify']), 'S3 replacement permission cannot review');
    rejects(40301, fn () => $documents->download($docId), 'S3 independent download permission');
    s3Actor();
    $download = $documents->download($docId);
    check(str_starts_with(base64_decode($download['content']), '%PDF') && strlen($download['sha256']) === 64, 'S3 authenticated file bytes and digest');
    foreach (['https://example.com/private.pdf', '/uploads/kyc/../../secret.pdf', '/uploads/public.pdf', '/uploads/kyc/%2e%2e/secret.pdf'] as $url) {
        rejects(40901, fn () => $documents->localPath($url), 'S3 path traversal/external storage rejected');
    }
    $foreignDoc = $docIds[] = (int) Db::table('merchant_verify_document')->insertGetId(['site_id' => 992, 'merchant_id' => $foreign, 'doc_type' => 'hotel_license']);
    s3Actor(false, 991, ['merchant:document:download', 'merchant:doc:list']);
    rejects(40302, fn () => $documents->download($foreignDoc), 'S3 cross-site download denied');
    rejects(40302, fn () => s3Call($container->get(MerchantDocumentController::class), 'history', ['docId' => $foreignDoc]), 'S3 cross-site history denied');
    s3Actor();
    s3Parallel('--review ' . $docId . ' 1 ' . escapeshellarg($fixtureRoot));
    check(Db::table('merchant_document_event')->where('doc_id', $docId)->where('action', 'verify')->count() === 1, 'S3 concurrent review has one winner');
    rejects(40901, fn () => $documents->review($docId, ['expectedVersion' => 1, 'action' => 'reject', 'reason' => 'late']), 'S3 reviewed decision cannot be overwritten');
    $revision1 = Db::table('merchant_verify_document_revision')->where('doc_id', $docId)->where('lifecycle_version', 1)->first();
    $v1Hash = $documents->download($docId, (int) $revision1->id)['sha256'];
    setRequest(['docId' => $docId]);
    \Hyperf\Context\ResponseContext::set(new \Hyperf\HttpMessage\Server\Response());
    $downloadResponse = $container->get(MerchantDocumentController::class)->download();
    check($downloadResponse->getHeaderLine('Cache-Control') === 'no-store, private', 'S3 document responses prohibit cache');
    $documents->replace($docId, array_replace($base, ['expectedVersion' => 1]), s3File("%PDF-1.5\nnew version\n%%EOF"));
    check($documents->download($docId, (int) $revision1->id)['sha256'] === $v1Hash, 'S3 old file bytes remain downloadable after replacement');
    $before = Db::table('merchant_verify_document')->where('id', $docId)->first();
    Db::statement("ALTER TABLE merchant_document_event ADD CONSTRAINT s3_fail_event CHECK (NOT(doc_id = {$docId} AND version = 2 AND action = 'verify'))"); $constraint = true;
    try { $documents->review($docId, ['expectedVersion' => 2, 'action' => 'verify']); throw new RuntimeException('Expected audit failure'); }
    catch (\Hyperf\Database\Exception\QueryException $e) { check(true, 'S3 injected audit failure surfaced'); }
    check(Db::table('merchant_verify_document')->where('id', $docId)->value('status') === $before->status, 'S3 audit failure rolls back review');
    Db::statement('ALTER TABLE merchant_document_event DROP CHECK s3_fail_event'); $constraint = false;
    $documents->review($docId, ['expectedVersion' => 2, 'action' => 'reject', 'reason' => 'Incomplete supporting evidence']);
    $documents->resubmit($docId, ['expectedVersion' => 2, 'reason' => 'Please supply a valid license']);
    check(Db::table('merchant_verify_document')->where('id', $docId)->value('status') === 5 && Db::table('merchant_notify')->where('merchant_id', $id)->count() === 1, 'S3 resubmission request delivers in-app notice');
    $expireDoc = $docIds[] = (int) Db::table('merchant_verify_document')->insertGetId(['site_id' => 991, 'merchant_id' => $id, 'doc_type' => 'tax_cert', 'status' => 1, 'expiry_date' => '2020-01-01']);
    $documents->expireDue(); $documents->expireDue();
    check(Db::table('merchant_document_event')->where('doc_id', $expireDoc)->where('action', 'expire')->count() === 1, 'S3 expiry event appended exactly once');
    $history = s3Call($container->get(MerchantDocumentController::class), 'history', ['docId' => $docId]);
    check(! isset($history['document']['file_url']) && !isset($history['revisions'][0]['file_url']) && count($history['revisions']) === 3, 'S3 metadata hides storage URL and retains versions');
    $list = s3Call($verify, 'documents', ['merchantId' => $id]);
    check($list['total'] === 2 && !isset($list['list'][0]['file_url']), 'S3 document library returns safe metadata');

    $send = ['requestId' => 's3-' . bin2hex(random_bytes(12)), 'title' => 'Test notification', 'message' => 'Synthetic S3 message', 'channels' => ['inapp']];
    foreach (['email', 'sms', 'push', 'unknown'] as $channel) {
        rejects($channel === 'unknown' ? 40001 : 40901, fn () => $notifications->send($id, array_replace($send, ['channels' => ['inapp', $channel]])), 'S3 unsupported channel rejects entire send');
    }
    check(Db::table('merchant_notify')->where('request_id', $send['requestId'])->count() === 0, 'S3 rejected channels have no delivery side effects');
    $receipt = $notifications->send($id, $send);
    check($receipt['deliveries'][0]['status'] === 'delivered', 'S3 immediate in-app delivered');
    check($notifications->send($id, $send)['id'] === $receipt['id'], 'S3 send retry idempotent');
    rejects(40901, fn () => $notifications->send($id, array_replace($send, ['message' => 'changed'])), 'S3 same request changed payload rejected');
    s3Actor(false, 992, ['merchant:list:notify']);
    rejects(40302, fn () => $notifications->send($id, $send), 'S3 notification cross-site denied');
    s3Actor();
    foreach ([['deepLinkType' => 'external_url', 'deepLinkValue' => 'javascript:alert(1)'], ['deepLinkType' => 'page', 'deepLinkValue' => '//evil.test'], ['deepLinkType' => 'booking_detail', 'deepLinkValue' => '99999999']] as $link) {
        rejects($link['deepLinkType'] === 'booking_detail' ? 40302 : 40001, fn () => $notifications->send($id, array_replace($send, $link, ['requestId' => 's3-' . bin2hex(random_bytes(12))])), 'S3 deep-link allowlist and ownership');
    }
    foreach (['2030-01-01 12:00:00', '2020-01-01T00:00:00Z', '2030-02-30T00:00:00Z'] as $badTime) {
        rejects(40001, fn () => $notifications->send($id, array_replace($send, ['requestId' => 's3-' . bin2hex(random_bytes(12)), 'sendType' => 2, 'sendAt' => $badTime])), 'S3 invalid/past/unzoned schedule rejected');
    }
    $scheduled = $notifications->send($id, array_replace($send, ['requestId' => 's3-' . bin2hex(random_bytes(12)), 'sendType' => 2, 'sendAt' => gmdate('Y-m-d\TH:i:s\Z', time()+3600)]));
    check($scheduled['deliveries'][0]['status'] === 'scheduled', 'S3 future message is scheduled not delivered');
    $inbox = $container->get(Inbox::class);
    MerchantContext::set(['admin_id' => 9301, 'merchant_id' => $id, 'account_type' => 2, 'site_id' => 991, 'permissions' => ['mch:notifications:read']]);
    s3Actor(false, 991, ['mch:notifications:read']);
    $mail = s3Call($inbox, 'index');
    check(!in_array($scheduled['id'], array_column($mail['list'], 'id')), 'S3 future message hidden from inbox');
    $unread = s3Call($inbox, 'summary')['unread'];
    s3Call($inbox, 'read', ['id' => $receipt['id']]); s3Call($inbox, 'read', ['id' => $receipt['id']]);
    check(s3Call($inbox, 'summary')['unread'] === $unread-1, 'S3 read is idempotent per account');
    MerchantContext::set(array_replace(MerchantContext::get(), ['admin_id' => 9302]));
    check(s3Call($inbox, 'summary')['unread'] === $unread, 'S3 other account remains unread');
    MerchantContext::set(array_replace(MerchantContext::get(), ['merchant_id' => $foreign, 'site_id' => 992]));
    check(s3Call($inbox, 'index')['total'] === 0, 'S3 other merchant cannot read messages');
    s3Actor();
    Db::table('merchant_notify')->where('id', $scheduled['id'])->update(['send_at' => '2020-01-01 00:00:00']);
    s3Parallel('--due');
    check(Db::table('merchant_notify_delivery')->where('notify_id', $scheduled['id'])->value('attempts') === 1, 'S3 concurrent scheduler delivers once');
    check(Db::table('merchant_notify')->where('id', $scheduled['id'])->value('status') === 1, 'S3 scheduled message now delivered');
    $templateId = (int) Db::table('notify_template')->insertGetId(['site_id' => 992, 'title' => 'Foreign S3', 'message' => 'test']);
    try { rejects(40302, fn () => $notifications->send($id, array_replace($send, ['requestId' => 's3-' . bin2hex(random_bytes(12)), 'templateId' => $templateId])), 'S3 cross-site template rejected'); }
    finally { Db::table('notify_template')->where('id', $templateId)->delete(); }
    for ($i = 0; $i < 425; ++$i) Db::table('merchant_activity_log')->insert(['site_id' => 991, 'merchant_id' => $id, 'activity_type' => 'profile_update', 'description' => 'S3-export-' . $i]);
    s3Actor(false, 991, ['merchant:activity:list']);
    rejects(40301, fn () => s3Call($verify, 'activities', ['export' => 1]), 'S3 export has separate permission');
    s3Actor(false, 991, ['merchant:activity:list', 'merchant:activity:export']);
    $export = s3Call($verify, 'activities', ['keyword' => 'S3-export-', 'export' => 1, 'pageSize' => 200]);
    $exportIds = array_column($export['list'], 'id'); $snapshot = $export['snapshotId'];
    Db::table('merchant_activity_log')->insert(['site_id' => 991, 'merchant_id' => $id, 'activity_type' => 'profile_update', 'description' => 'S3-export-after']);
    while ($export['nextBeforeId'] !== null) {
        $export = s3Call($verify, 'activities', ['keyword' => 'S3-export-', 'export' => 1, 'pageSize' => 200, 'snapshotId' => $snapshot, 'beforeId' => $export['nextBeforeId']]);
        $exportIds = array_merge($exportIds, array_column($export['list'], 'id'));
    }
    check(count($exportIds) === 425 && count(array_unique($exportIds)) === 425, 'S3 export >200 complete without duplicates or new events');
    check(s3Call($verify, 'activities', ['siteId' => 992, 'merchantId' => $foreign])['total'] === 0, 'S3 forged site filter cannot leak activity');
    s3Actor();
    $accountIds[] = $account = (int) Db::table('merchant_admin')->insertGetId(['site_id' => 991, 'merchant_id' => $id, 'account_type' => 2, 'username' => 's3-' . bin2hex(random_bytes(6)), 'password' => password_hash('S3-test-secret123', PASSWORD_BCRYPT), 'is_owner' => 1, 'status' => 1]);
    $auth = new \App\Service\Merchant\MerchantAuthService();
    $auth->login((string) Db::table('merchant_admin')->where('id', $account)->value('username'), 'S3-test-secret123', '127.0.0.1');
    $login = Db::table('merchant_activity_log')->where('target_account_id', $account)->where('activity_type', 'login')->first();
    check($login && $login->actor_type === 'merchant' && (int) $login->performed_by_id === $account, 'S3 login actor belongs to actual merchant account');
    $auth->updatePassword($account, 'S3-test-secret123', 'S3-next-secret456');
    check(Db::table('merchant_activity_log')->where('target_account_id', $account)->where('activity_type', 'account_change')->count() === 1, 'S3 password change audited without secret');
    check(!str_contains(json_encode(Db::table('merchant_activity_log')->where('merchant_id', $id)->get()->all()), 'secret123'), 'S3 secrets absent from activity logs');
    $historyController = $container->get(\App\Controller\MerchantActivityController::class);
    Db::table('merchant_warning')->insert(['site_id' => 991, 'merchant_id' => $id, 'reason' => 'S3 synthetic warning', 'issued_by' => 'Test reviewer']);
    Db::table('compliance_history')->insert(['site_id' => 991, 'merchant_id' => $id, 'event' => 'S3 synthetic compliance', 'reviewer' => 'Test reviewer']);
    Db::table('merchant_verify_timeline')->insert(['site_id' => 991, 'merchant_id' => $id, 'action' => 'S3 synthetic action', 'note' => 'S3 synthetic verification']);
    foreach (['status', 'warning', 'compliance', 'verification'] as $source) {
        $rows = s3Call($historyController, 'history', ['source' => $source, 'merchantId' => $id]);
        check(isset($rows['list']) && ($source === 'status' || $rows['total'] === 1), 'S3 authoritative source readable: ' . $source);
    }
    s3Actor(false, 991, ['merchant:activity:list']);
    rejects(40301, fn () => s3Call($historyController, 'history', ['source' => 'warning']), 'S3 warning source requires its own permission');
    s3Actor(false, 992, ['merchant:activity:list', 'platform:warning:list']);
    check(s3Call($historyController, 'history', ['source' => 'warning', 'merchantId' => $id, 'siteId' => 991])['total'] === 0, 'S3 warning history cross-site isolation');
    s3Actor();
    $loggedIn = $auth->login((string) Db::table('merchant_admin')->where('id', $account)->value('username'), 'S3-next-secret456', '127.0.0.1');
    $middleware = new \Mtrip\Shared\Middleware\MerchantAuthMiddleware($config);
    $request = (new \Hyperf\HttpMessage\Server\Request('POST', '/api/v1/merchant/rooms/update'))->withHeader('Authorization', 'Bearer ' . $loggedIn['token']);
    $success = new class implements \Psr\Http\Server\RequestHandlerInterface {
        public function handle(\Psr\Http\Message\ServerRequestInterface $request): \Psr\Http\Message\ResponseInterface {
            return (new \Hyperf\HttpMessage\Server\Response())->withBody(new \Hyperf\HttpMessage\Stream\SwooleStream('{"code":0,"data":null}'));
        }
    };
    $middleware->process($request, $success);
    check(Db::table('merchant_activity_log')->where('target_account_id', $account)->where('activity_type', 'operation')->count() === 1, 'S3 successful operation captures actual actor without payload');
    $failure = new class implements \Psr\Http\Server\RequestHandlerInterface {
        public function handle(\Psr\Http\Message\ServerRequestInterface $request): \Psr\Http\Message\ResponseInterface {
            return (new \Hyperf\HttpMessage\Server\Response())->withBody(new \Hyperf\HttpMessage\Stream\SwooleStream('{"code":40001,"data":null}'));
        }
    };
    $middleware->process($request, $failure);
    check(Db::table('merchant_activity_log')->where('target_account_id', $account)->where('activity_type', 'operation')->count() === 1, 'S3 failed operation not logged as success');
    s3Actor();
    $currentRevision = Db::table('merchant_verify_document_revision')->where('doc_id', $docId)->where('lifecycle_version', 2)->first();
    $currentFile = $documents->localPath($currentRevision->file_url);
    file_put_contents($currentFile, '%PDF-1.7 tampered fixture');
    rejects(40901, fn () => $documents->download($docId), 'S3 current file digest mismatch is denied');
    $large = $documents->replace($docId, ['expectedVersion' => 2, 'reason' => 'Large fixture'], s3File('%PDF-1.4' . str_repeat(' ', 10 * 1024 * 1024 - 8)));
    check($large['document_version'] === 3 && strlen(base64_decode($documents->download($docId)['content'])) === 10 * 1024 * 1024, 'S3 10MB document roundtrip');
    rejects(40001, fn () => $documents->replace($docId, ['expectedVersion' => 3, 'reason' => 'Oversized fixture'], s3File('%PDF-1.4' . str_repeat(' ', 10 * 1024 * 1024))), 'S3 oversized document denied');
} finally {
    if ($constraint) Db::statement('ALTER TABLE merchant_document_event DROP CHECK s3_fail_event');
    $notificationIds = $ids ? Db::table('merchant_notify')->whereIn('merchant_id', $ids)->pluck('id')->all() : [];
    if ($notificationIds) foreach (['merchant_notify_read', 'merchant_notify_delivery'] as $table) Db::table($table)->whereIn('notify_id', $notificationIds)->delete();
    if ($docIds) foreach (['merchant_document_event', 'merchant_verify_document_revision'] as $table) Db::table($table)->whereIn('doc_id', $docIds)->delete();
    if ($docIds) Db::table('merchant_verify_document')->whereIn('id', $docIds)->delete();
    if ($accountIds) Db::table('merchant_admin')->whereIn('id', $accountIds)->delete();
    if ($ids) foreach (['merchant_warning', 'compliance_history', 'merchant_verify_timeline', 'merchant_notify', 'merchant_activity_log', 'merchant_info'] as $table) Db::table($table)->whereIn($table === 'merchant_info' ? 'id' : 'merchant_id', $ids)->delete();
    foreach ($tempFiles as $path) if (is_file($path)) unlink($path);
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($fixtureRoot, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($files as $item) { $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname()); }
    rmdir($fixtureRoot);
}
echo "S3 document/activity/notification suite complete\n";
