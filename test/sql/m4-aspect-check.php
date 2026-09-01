<?php
// 对照实验:子账号 token(无 guest-contact/message 权限)分别调旧注解端点与新注解端点
declare(strict_types=1);
$secret = getenv('MTRIP_JWT_SECRET');
function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function issueToken(string $secret, array $claims): string {
    $h = b64u(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $now = time();
    $p = b64u(json_encode(array_merge($claims, ['iat' => $now, 'exp' => $now + 600, 'jti' => bin2hex(random_bytes(8))]), JSON_UNESCAPED_UNICODE));
    return "{$h}.{$p}." . b64u(hash_hmac('sha256', "{$h}.{$p}", $secret, true));
}
$pdo = new PDO('mysql:host=mtrip-mysql-1;dbname=mtrip_business;charset=utf8mb4', 'root', 'root@2026');
$subId = (int) $pdo->query("SELECT id FROM merchant_admin WHERE username='m4e2esub'")->fetchColumn();
if ($subId <= 0) {
    $pdo->exec("INSERT INTO merchant_admin (site_id,account_type,merchant_id,group_id,store_id,username,password,real_name,mobile,is_owner,status,two_fa_status,auth_version) VALUES (3,2,1001,0,0,'m4e2esub','x','M4 E2E Sub','',0,1,1,1)");
    $subId = (int) $pdo->lastInsertId();
}
$base = ['admin_id' => $subId, 'admin_name' => 'M4 E2E Sub', 'site_id' => 3, 'aud' => 'merchant', 'account_type' => 2, 'group_id' => 0, 'merchant_id' => 1001, 'store_id' => 0, 'is_owner' => false, 'auth_version' => 1, 'amr' => 'totp'];
$token = issueToken($secret, $base + ['permissions' => ['mch:order:list']]); // 无 guest-contact / message / detail

function call(string $method, string $path, string $token, ?array $body = null): string {
    $ch = curl_init("http://127.0.0.1:9504{$path}");
    $headers = ["Authorization: Bearer {$token}"];
    if ($body !== null) { $headers[] = 'Content-Type: application/json'; curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body)); }
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_TIMEOUT => 10]);
    $raw = curl_exec($ch); curl_close($ch);
    return $raw === false ? '' : $raw;
}

echo 'old  note(no perm)      : ' . substr(call('POST', '/api/v1/merchant/order/note', $token, ['id' => 1021, 'content' => 'x']), 0, 120) . "\n";
echo 'old  guest-contact(no)  : ' . substr(call('GET', '/api/v1/merchant/order/guest-contact?id=1021', $token), 0, 120) . "\n";
echo 'new  guest-thread(no)   : ' . substr(call('GET', '/api/v1/merchant/order/guest-thread?id=1021', $token), 0, 120) . "\n";
echo 'new  guest-message(no)  : ' . substr(call('POST', '/api/v1/merchant/order/guest-message', $token, ['id' => 1021, 'content' => 'x']), 0, 120) . "\n";
echo 'old  stats(with list)   : ' . substr(call('GET', '/api/v1/merchant/order/booking-stats', $token), 0, 80) . "\n";
