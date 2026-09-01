<?php
// 阶段5端到端验证:通知补齐 / 住客消息 / 同步Outbox失败重试(容器内执行)
// 用法: docker exec mtrip-order-service-1 php /tmp/m4-e2e-stage5.php
declare(strict_types=1);

$secret = getenv('MTRIP_JWT_SECRET');
if ($secret === false || $secret === '') { fwrite(STDERR, "NO JWT SECRET\n"); exit(1); }

function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }

function issueToken(string $secret, array $claims): string {
    $h = b64u(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $now = time();
    $p = b64u(json_encode(array_merge($claims, ['iat' => $now, 'exp' => $now + 3600, 'jti' => bin2hex(random_bytes(8))]), JSON_UNESCAPED_UNICODE));
    return "{$h}.{$p}." . b64u(hash_hmac('sha256', "{$h}.{$p}", $secret, true));
}

$allPerms = ['mch:order:list','mch:order:detail','mch:order:export','mch:order:confirm','mch:order:check-in','mch:order:check-out','mch:order:cancel','mch:order:refund','mch:order:no-show','mch:order:no-show-waive','mch:order:note','mch:order:sync','mch:order:voucher','mch:order:guest-contact','mch:order:message'];
$base = ['admin_id' => 4001, 'admin_name' => 'Marc Martin', 'site_id' => 3, 'aud' => 'merchant', 'account_type' => 2, 'group_id' => 0, 'merchant_id' => 1001, 'store_id' => 0, 'is_owner' => true, 'auth_version' => 1, 'amr' => 'totp'];
$token = issueToken($secret, $base + ['permissions' => $allPerms]);
// 权限负例需真实子账号(主账号 is_owner 按设计豁免,且 assertSession 会比对 JWT 与 DB):
// 临时建一个无 mch:order:message 的子账号,测完清理。幂等:先删同名残留。
$pdo0 = new PDO('mysql:host=mtrip-mysql-1;dbname=mtrip_business;charset=utf8mb4', 'root', 'root@2026', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo0->prepare("DELETE FROM merchant_admin WHERE username='m4e2esub'")->execute();
$pdo0->exec("INSERT INTO merchant_admin (site_id,account_type,merchant_id,group_id,store_id,username,password,real_name,mobile,is_owner,status,two_fa_status,auth_version) VALUES (3,2,1001,0,0,'m4e2esub','x','M4 E2E Sub','',0,1,1,1)");
$subId = (int) $pdo0->lastInsertId();
$subBase = ['admin_id' => $subId, 'admin_name' => 'M4 E2E Sub', 'site_id' => 3, 'aud' => 'merchant', 'account_type' => 2, 'group_id' => 0, 'merchant_id' => 1001, 'store_id' => 0, 'is_owner' => false, 'auth_version' => 1, 'amr' => 'totp'];
$noMsgSubToken = issueToken($secret, $subBase + ['permissions' => array_values(array_diff($allPerms, ['mch:order:message']))]);

function call(string $method, string $path, string $token, ?array $body = null): array {
    $ch = curl_init("http://127.0.0.1:9504{$path}");
    $headers = ["Authorization: Bearer {$token}"];
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    }
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_TIMEOUT => 15]);
    $raw = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$http, $raw === false ? '' : $raw];
}

$pass = 0; $fail = 0;
function expect(bool $ok, string $name, string $detail = ''): void {
    global $pass, $fail;
    if ($ok) { $pass++; echo "PASS: {$name}\n"; }
    else { $fail++; echo "FAIL: {$name} :: {$detail}\n"; }
}
function jcode(string $raw): ?int { $j = json_decode($raw, true); return is_array($j) && isset($j['code']) ? (int) $j['code'] : null; }
function jdata(string $raw): array { $j = json_decode($raw, true); return is_array($j) && isset($j['data']) && is_array($j['data']) ? $j['data'] : []; }

$pdo = new PDO('mysql:host=mtrip-mysql-1;dbname=mtrip_business;charset=utf8mb4', 'root', 'root@2026', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

// ---------- 准备:找商户1001 名下 已入住(退房用) 与 已确认(入住用) 订单 ----------
$inhouse = (int) $pdo->query("SELECT id FROM order_main WHERE merchant_id=1001 AND booking_status=3 AND deleted_at IS NULL ORDER BY id LIMIT 1")->fetchColumn();
$confirmed = (int) $pdo->query("SELECT id FROM order_main WHERE merchant_id=1001 AND booking_status=2 AND deleted_at IS NULL AND user_id>0 ORDER BY id LIMIT 1")->fetchColumn();
echo "fixture: inhouse={$inhouse} confirmed={$confirmed}\n";
if ($inhouse <= 0 || $confirmed <= 0) { fwrite(STDERR, "NO FIXTURE ORDERS\n"); exit(1); }

$notifyCount = fn (string $kw) => (int) $pdo->query("SELECT COUNT(*) FROM merchant_notify WHERE merchant_id=1001 AND category='booking' AND title LIKE " . $pdo->quote("%{$kw}%"))->fetchColumn();

// ---------- 1. 退房通知(真实状态变更一次只发一条) ----------
$before = $notifyCount('退房');
[, $raw] = call('POST', '/api/v1/merchant/order/check-out', $token, ['id' => $inhouse]);
expect(jcode($raw) === 0, 'check-out ok', substr($raw, 0, 200));
expect($notifyCount('退房') === $before + 1, 'check-out emits exactly one notification', "before={$before} after={$notifyCount('退房')}");

// ---------- 2. 幂等重复退房不重复通知 ----------
[, $raw] = call('POST', '/api/v1/merchant/order/check-out', $token, ['id' => $inhouse]);
expect(jcode($raw) === 0, 'double check-out idempotent ok', substr($raw, 0, 200));
expect($notifyCount('退房') === $before + 1, 'idempotent check-out does not re-notify', "count={$notifyCount('退房')}");

// ---------- 3. 入住通知 ----------
$before = $notifyCount('入住');
[, $raw] = call('POST', '/api/v1/merchant/order/check-in', $token, ['id' => $confirmed, 'roomNo' => '505']);
expect(jcode($raw) === 0, 'check-in ok', substr($raw, 0, 200));
expect($notifyCount('入住') === $before + 1, 'check-in emits exactly one notification', "before={$before} after={$notifyCount('入住')}");
$deep = $pdo->query("SELECT deep_link_value FROM merchant_notify WHERE merchant_id=1001 AND title LIKE '%入住%' ORDER BY id DESC LIMIT 1")->fetchColumn();
expect((string) $deep === "/order?notificationTarget={$confirmed}", 'check-in notification deep link targets booking', (string) $deep);

// ---------- 4. availableActions 含 message(已入住) ----------
[, $raw] = call('GET', "/api/v1/merchant/order/detail?id={$confirmed}", $token);
$actions = jdata($raw)['availableActions'] ?? [];
expect(in_array('message', $actions, true), 'availableActions include message for checked-in', json_encode($actions));

// ---------- 5. 住客会话:首次打开自动创建 ----------
[, $raw] = call('GET', "/api/v1/merchant/order/guest-thread?id={$confirmed}", $token);
$d = jdata($raw);
expect(jcode($raw) === 0 && ($d['conversationId'] ?? 0) > 0 && is_array($d['messages'] ?? null), 'guest-thread creates conversation', substr($raw, 0, 300));
$convId = (int) ($d['conversationId'] ?? 0);
$linked = (int) $pdo->query("SELECT COUNT(*) FROM chat_conversation WHERE id={$convId} AND order_id={$confirmed}")->fetchColumn();
expect($linked === 1, 'conversation linked with order_id', "conv={$convId}");

// ---------- 6. 发送住客消息 ----------
[, $raw] = call('POST', '/api/v1/merchant/order/guest-message', $token, ['id' => $confirmed, 'content' => '您好,您的房间已准备好,欢迎入住!(M4阶段5测试消息)']);
expect(jcode($raw) === 0 && (jdata($raw)['messageId'] ?? 0) > 0, 'guest-message ok', substr($raw, 0, 200));

// ---------- 7. 再开会话:同一会话+消息可见(sender_type=2) ----------
[, $raw] = call('GET', "/api/v1/merchant/order/guest-thread?id={$confirmed}", $token);
$d = jdata($raw);
expect(($d['conversationId'] ?? -1) === $convId, 'guest-thread reuses conversation', json_encode([$d['conversationId'] ?? null, $convId]));
$msgs = $d['messages'] ?? [];
$last = end($msgs);
expect(is_array($last) && (int) $last['sender_type'] === 2 && str_contains((string) $last['content'], 'M4阶段5测试消息'), 'merchant message visible in thread', json_encode($last, JSON_UNESCAPED_UNICODE));

// ---------- 8. 时间线留痕 ----------
$ev = (int) $pdo->query("SELECT COUNT(*) FROM order_booking_event WHERE order_id={$confirmed} AND event_type='guest_message_sent'")->fetchColumn();
expect($ev >= 1, 'timeline records guest_message_sent', "count={$ev}");

// ---------- 9. 权限:非主账号无 mch:order:message 拒绝(主账号按设计豁免) ----------
[, $raw] = call('POST', '/api/v1/merchant/order/guest-message', $noMsgSubToken, ['id' => $confirmed, 'content' => 'x']);
expect(jcode($raw) === 40301, 'subaccount guest-message without permission => 40301', substr($raw, 0, 200));
[, $raw] = call('GET', "/api/v1/merchant/order/guest-thread?id={$confirmed}", $noMsgSubToken);
expect(jcode($raw) === 40301, 'subaccount guest-thread without permission => 40301', substr($raw, 0, 200));

// ---------- 10. 越权:他商户订单会话按404 ----------
$other = (int) $pdo->query("SELECT id FROM order_main WHERE merchant_id<>1001 AND deleted_at IS NULL ORDER BY id LIMIT 1")->fetchColumn();
if ($other > 0) {
    [, $raw] = call('GET', "/api/v1/merchant/order/guest-thread?id={$other}", $token);
    expect(jcode($raw) === 40401, 'cross-merchant guest-thread => 40401', substr($raw, 0, 200));
}

// ---------- 11. 未连接时 Force Sync 仍拒绝 ----------
[, $raw] = call('POST', '/api/v1/merchant/order/sync', $token, ['id' => $confirmed, 'target' => 'pms']);
expect(jcode($raw) === 40901, 'force sync not connected => 40901', substr($raw, 0, 200));

// ---------- 12. Outbox 失败路径:插入任务等定时任务处理 ----------
$pdo->prepare("DELETE FROM order_sync_task WHERE order_id=? AND idempotency_key LIKE 'm4e2e%'")->execute([$confirmed]);
$pdo->prepare("INSERT INTO order_sync_task (site_id,merchant_id,order_id,order_no,target,action,status,retry_count,max_retry,next_retry_at,idempotency_key,payload) VALUES (3,1001,?,'M4E2E','pms','update',0,0,1,NOW(),'m4e2e:terminal','{}')")->execute([$confirmed]);
$pdo->prepare("INSERT INTO order_sync_task (site_id,merchant_id,order_id,order_no,target,action,status,retry_count,max_retry,next_retry_at,idempotency_key,payload) VALUES (3,1001,?,'M4E2E','pms','update',0,0,5,NOW(),'m4e2e:retry','{}')")->execute([$confirmed]);
echo "waiting ~75s for booking-sync-outbox crontab...\n";
sleep(75);

$t1 = $pdo->query("SELECT status,retry_count,last_error FROM order_sync_task WHERE idempotency_key='m4e2e:terminal'")->fetch(PDO::FETCH_ASSOC);
expect($t1 !== false && (int) $t1['status'] === 3 && (int) $t1['retry_count'] === 1 && str_contains((string) $t1['last_error'], '连接器不可用'), 'terminal task => status3 with error', json_encode($t1, JSON_UNESCAPED_UNICODE));
$t2 = $pdo->query("SELECT status,retry_count,next_retry_at FROM order_sync_task WHERE idempotency_key='m4e2e:retry'")->fetch(PDO::FETCH_ASSOC);
// 75秒窗口内可能被 crontab 处理多次(每次失败后按 2^(n-1) 分钟退避),只验证不变量:未终态+已重试+下次在未来
echo 'retry task row: ' . json_encode($t2, JSON_UNESCAPED_UNICODE) . "\n";
expect($t2 !== false && (int) $t2['status'] === 0 && (int) $t2['retry_count'] >= 1 && (int) $t2['retry_count'] < 5 && strtotime((string) $t2['next_retry_at']) > time(), 'retry task backoff scheduled', json_encode($t2, JSON_UNESCAPED_UNICODE));
$logs = (int) $pdo->query("SELECT COUNT(*) FROM order_sync_log WHERE order_id={$confirmed} AND status=2")->fetchColumn();
expect($logs >= 2, 'sync attempts logged as failures', "count={$logs}");
$pmsStatus = (string) $pdo->query("SELECT pms_sync_status FROM order_main WHERE id={$confirmed}")->fetchColumn();
expect($pmsStatus === 'failed', 'order pms_sync_status=failed after terminal failure', $pmsStatus);
$syncNotify = (int) $pdo->query("SELECT COUNT(*) FROM merchant_notify WHERE merchant_id=1001 AND title LIKE '%同步失败%'")->fetchColumn();
expect($syncNotify >= 1, 'merchant notified on sync terminal failure', "count={$syncNotify}");

// ---------- 13. 清理测试痕迹 ----------
$pdo->prepare("DELETE FROM order_sync_task WHERE order_id=? AND idempotency_key LIKE 'm4e2e%'")->execute([$confirmed]);
$pdo->prepare("DELETE FROM order_sync_log WHERE order_id=? AND order_no='M4E2E'")->execute([$confirmed]);
$pdo->prepare("DELETE FROM merchant_notify WHERE merchant_id=1001 AND title='同步失败'")->execute();
$pdo->prepare("UPDATE order_main SET pms_sync_status='not_connected' WHERE id=?")->execute([$confirmed]);
$pdo->prepare("DELETE FROM chat_message WHERE conversation_id=?")->execute([$convId]);
$pdo->prepare("DELETE FROM chat_conversation WHERE id=?")->execute([$convId]);
$pdo->prepare("DELETE FROM order_booking_event WHERE order_id=? AND event_type='guest_message_sent'")->execute([$confirmed]);
$pdo->prepare("DELETE FROM merchant_admin WHERE username='m4e2esub'")->execute();
echo "cleanup done\n";

echo "\nRESULT: pass={$pass} fail={$fail}\n";
exit($fail > 0 ? 1 : 0);
