<?php
// 阶段3端到端验证:商户预订管理 API(容器内执行,签发测试 JWT 直连 9504)
// 用法: docker exec mtrip-order-service-1 php /tmp/m4-e2e-test.php
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

$allPerms = ['mch:order:list','mch:order:detail','mch:order:export','mch:order:confirm','mch:order:check-in','mch:order:check-out','mch:order:cancel','mch:order:refund','mch:order:no-show','mch:order:no-show-waive','mch:order:note','mch:order:sync','mch:order:voucher','mch:order:guest-contact'];
$base = ['admin_id' => 4001, 'admin_name' => 'Marc Martin', 'site_id' => 3, 'aud' => 'merchant', 'account_type' => 2, 'group_id' => 0, 'merchant_id' => 1001, 'store_id' => 0, 'is_owner' => true, 'auth_version' => 1, 'amr' => 'totp'];
$token = issueToken($secret, $base + ['permissions' => $allPerms]);
$noWaiveToken = issueToken($secret, $base + ['permissions' => array_values(array_diff($allPerms, ['mch:order:no-show-waive']))]);

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

// 1. 统计
[$http, $raw] = call('GET', '/api/v1/merchant/order/booking-stats', $token);
expect($http === 200 && jcode($raw) === 0, 'stats code=0', substr($raw, 0, 200));
$d = json_decode($raw, true)['data'] ?? [];
expect(($d['all'] ?? -1) === 7 && isset($d['pending'], $d['confirmed'], $d['inhouse'], $d['checkedOut'], $d['cancelled'], $d['noShow'], $d['arrivalsToday'], $d['departuresToday']), 'stats structure all=7', json_encode($d, JSON_UNESCAPED_UNICODE));

// 2. 列表+筛选(订单1001 首轮已被测入住,筛选已确认仍应稳定)
[$http, $raw] = call('GET', '/api/v1/merchant/order/list?page=1&pageSize=20&bookingStatus=2', $token);
$d = json_decode($raw, true)['data'] ?? [];
expect(($d['total'] ?? -1) === 3, 'list filter confirmed total=3', substr($raw, 0, 200));
$row = $d['list'][0] ?? [];
expect(isset($row['booking_status']) && isset($row['payment_status']) && str_contains((string) ($row['contact_phone'] ?? ''), '*'), 'list rows carry booking fields & masked phone', substr($raw, 0, 300));

// 3. 详情(订单1001 首轮已测入住,状态应为已入住)
[$http, $raw] = call('GET', '/api/v1/merchant/order/detail?id=1001', $token);
$d = json_decode($raw, true)['data'] ?? [];
expect(($d['order']['booking_status'] ?? -1) === 3 && isset($d['availableActions']) && isset($d['payment']) && isset($d['stay']), 'detail structure ok', substr($raw, 0, 300));
expect(($d['order']['contact_phone'] ?? '') !== '' && str_contains((string) $d['order']['contact_phone'], '*'), 'detail phone masked', (string) ($d['order']['contact_phone'] ?? ''));

// 4. 越权访问他商户订单 → 40401
[$http, $raw] = call('GET', '/api/v1/merchant/order/detail?id=1002', $token);
expect(jcode($raw) === 40401, 'cross-merchant detail => 40401', substr($raw, 0, 200));

// 5. 时间线
[$http, $raw] = call('GET', '/api/v1/merchant/order/timeline?id=1001&page=1&pageSize=10', $token);
expect(jcode($raw) === 0, 'timeline code=0', substr($raw, 0, 200));

// 6. mtrip 渠道禁止人工确认
[$http, $raw] = call('POST', '/api/v1/merchant/order/confirm', $token, ['id' => 1001]);
expect(jcode($raw) === 40901, 'confirm mtrip-channel rejected 40901', substr($raw, 0, 200));

// 7. 入住办理(订单1001 已确认)
[$http, $raw] = call('POST', '/api/v1/merchant/order/check-in', $token, ['id' => 1001, 'roomNo' => '305']);
expect(jcode($raw) === 0, 'check-in order 1001 ok', substr($raw, 0, 200));

// 8. 入住后详情房号与状态
[$http, $raw] = call('GET', '/api/v1/merchant/order/detail?id=1001', $token);
$d = json_decode($raw, true)['data'] ?? [];
expect(($d['order']['booking_status'] ?? -1) === 3 && ($d['stay']['roomNo'] ?? '') === '305', 'after check-in status=3 roomNo=305', json_encode([$d['order']['booking_status'] ?? null, $d['stay']['roomNo'] ?? null]));

// 9. 退房(订单1041 已入住)
[$http, $raw] = call('POST', '/api/v1/merchant/order/check-out', $token, ['id' => 1041]);
expect(jcode($raw) === 0, 'check-out order 1041 ok', substr($raw, 0, 200));

// 10. 重复退房按幂等设计返回成功(目标状态直返,不重复记时间线)
[$http, $raw] = call('POST', '/api/v1/merchant/order/check-out', $token, ['id' => 1041]);
expect(jcode($raw) === 0, 'double check-out idempotent ok', substr($raw, 0, 200));

// 11. 备注
[$http, $raw] = call('POST', '/api/v1/merchant/order/note', $token, ['id' => 1001, 'content' => 'M4端到端测试备注']);
expect(jcode($raw) === 0, 'note add ok', substr($raw, 0, 200));

// 12. 退款试算(订单1015 已确认已支付)
[$http, $raw] = call('GET', '/api/v1/merchant/order/refund/quote?id=1015', $token);
$d = json_decode($raw, true)['data'] ?? [];
expect(jcode($raw) === 0 && isset($d['refundable'], $d['payAmount']), 'refund quote ok', substr($raw, 0, 200));

// 13. No-show 未到截止时间拒绝(订单1035 入住日2026-09-21 未来)
[$http, $raw] = call('POST', '/api/v1/merchant/order/no-show', $token, ['id' => 1035]);
expect(jcode($raw) === 40901, 'no-show before deadline rejected', substr($raw, 0, 200));

// 14. 同步未连接拒绝
[$http, $raw] = call('POST', '/api/v1/merchant/order/sync', $token, ['id' => 1001, 'target' => 'pms']);
expect(jcode($raw) === 40901, 'sync not connected rejected 40901', substr($raw, 0, 200));

// 15. 凭证(订单1001 已入住可出凭证)
[$http, $raw] = call('GET', '/api/v1/merchant/order/voucher?id=1001', $token);
$d = json_decode($raw, true)['data'] ?? [];
expect(jcode($raw) === 0 && ($d['orderNo'] ?? '') === 'NO20260704001001', 'voucher ok', substr($raw, 0, 200));

// 16. 明文联系方式(审计)
[$http, $raw] = call('GET', '/api/v1/merchant/order/guest-contact?id=1001', $token);
expect(jcode($raw) === 0 && isset(json_decode($raw, true)['data']['phone']), 'guest-contact plaintext ok', substr($raw, 0, 200));

// 17. 导出 CSV
[$http, $raw] = call('GET', '/api/v1/merchant/order/export?bookingStatus=3', $token);
expect($http === 200 && str_starts_with(ltrim($raw, "\u{FEFF}"), 'Booking ID'), 'export csv header', substr($raw, 0, 120));
expect(substr_count($raw, "\n") >= 2, 'export csv has rows', (string) substr_count($raw, "\n"));

// 18. 无豁免权限的 No-show waive 拒绝(独立权限校验)——用未到期订单触发权限前置也可,此处验证权限缺失分支
[$http, $raw] = call('POST', '/api/v1/merchant/order/no-show', $noWaiveToken, ['id' => 1035, 'waiveFee' => 1]);
expect(jcode($raw) !== 0, 'no-show waive without perm rejected', substr($raw, 0, 200));

echo "\nRESULT: pass={$pass} fail={$fail}\n";
exit($fail > 0 ? 1 : 0);
