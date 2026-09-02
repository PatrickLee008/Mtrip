<?php
// 独立脚本:解密商户账号 4001 的 2FA 密钥并生成当前/下一窗口 TOTP(用于真实登录验收)
// 用法: docker exec mtrip-merchant-service-1 php /tmp/m4-totp.php
declare(strict_types=1);

$pdo = new PDO('mysql:host=mtrip-mysql-1;dbname=mtrip_business;charset=utf8mb4', 'mtrip', 'mtrip@2026');
$enc = (string) $pdo->query('SELECT two_fa_secret_enc, two_fa_status FROM merchant_admin WHERE id = 4001')->fetchColumn();
$row = $pdo->query('SELECT two_fa_secret_enc, two_fa_status, status FROM merchant_admin WHERE id = 4001')->fetch(PDO::FETCH_ASSOC);
echo 'status=', $row['status'], ' two_fa_status=', $row['two_fa_status'], PHP_EOL;
if ($row['two_fa_secret_enc'] === '') { echo 'EMPTY_SECRET', PHP_EOL; exit(0); }

// CryptoHelper::decrypt 等价实现: AES-256-GCM, key=sha256(MTRIP_AES_KEY), base64(iv12+tag16+ct)
$key = hash('sha256', getenv('MTRIP_AES_KEY') ?: 'mtrip-dev-aes-key-change-me', true);
$raw = base64_decode($row['two_fa_secret_enc'], true);
$iv = substr($raw, 0, 12);
$tag = substr($raw, 12, 16);
$secret = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
if ($secret === false) { echo 'DECRYPT_FAIL', PHP_EOL; exit(1); }
echo 'secret=', $secret, PHP_EOL;

// Totp::code 等价实现: RFC 6238 SHA1 6位
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
echo 'step=', $step, PHP_EOL;
echo 'code_now=', totpCode($secret, $step), PHP_EOL;
echo 'code_next=', totpCode($secret, $step + 1), PHP_EOL;
echo 'seconds_left=', ($step + 1) * 30 - time(), PHP_EOL;
