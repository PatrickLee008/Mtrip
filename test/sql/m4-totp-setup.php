<?php
// 为测试账号 4001 补写 2FA 密钥(种子数据未写),密钥取已知测试值,便于生成 TOTP
// 用法: docker exec mtrip-merchant-service-1 php /tmp/m4-totp-setup.php
declare(strict_types=1);

$secret = 'JBSWY3DPEHPK3PXP';
$key = hash('sha256', getenv('MTRIP_AES_KEY') ?: 'mtrip-dev-aes-key-change-me', true);
$iv = random_bytes(12);
$tag = '';
$ct = openssl_encrypt($secret, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
$enc = base64_encode($iv . $tag . $ct);

$pdo = new PDO('mysql:host=mtrip-mysql-1;dbname=mtrip_business;charset=utf8mb4', 'mtrip', 'mtrip@2026');
$st = $pdo->prepare('UPDATE merchant_admin SET two_fa_secret_enc = ?, two_fa_method = ?, two_fa_enrolled_at = NOW(), last_accepted_totp_step = -1 WHERE id = 4001');
$st->execute([$enc, 'google_authenticator']);
echo 'updated rows=', $st->rowCount(), PHP_EOL;

// 立即输出当前/下一窗口 TOTP
function totpCode(string $secret, int $step): string {
    $alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = '';
    foreach (str_split($secret) as $ch) $bits .= str_pad(decbin(strpos($alpha, $ch)), 5, '0', STR_PAD_LEFT);
    $k = '';
    foreach (str_split($bits, 8) as $b) if (strlen($b) === 8) $k .= chr(bindec($b));
    $hash = hash_hmac('sha1', pack('N2', intdiv($step, 4294967296), $step % 4294967296), $k, true);
    $off = ord($hash[19]) & 15;
    $num = unpack('N', substr($hash, $off, 4))[1] & 0x7fffffff;
    return str_pad((string) ($num % 1000000), 6, '0', STR_PAD_LEFT);
}
$step = intdiv(time(), 30);
echo 'code_now=', totpCode($secret, $step), PHP_EOL;
echo 'code_next=', totpCode($secret, $step + 1), PHP_EOL;
echo 'seconds_left=', ($step + 1) * 30 - time(), PHP_EOL;
