<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;

// Read-only: use normalized plaintext to also detect missing or stale search hashes.
$pdo = new PDO('mysql:host=' . getenv('DB_HOST') . ';port=' . (getenv('DB_PORT') ?: '3306')
    . ';dbname=' . getenv('DB_BUSINESS_DATABASE'), getenv('DB_USERNAME'), getenv('DB_PASSWORD'));
$aes = (string) getenv('MTRIP_AES_KEY');
if ($aes === '') throw new RuntimeException('MTRIP_AES_KEY is required');
$groups = [];
$anomalies = [];
foreach ([['merchant_application', 'registration_phone', 'registration_phone_index', 'registration_phone_released_at'],
    ['merchant_admin', 'mobile', 'mobile_index', 'mobile_released_at']] as [$table, $field, $index, $released]) {
    foreach ($pdo->query('SELECT * FROM ' . $table)->fetchAll(PDO::FETCH_ASSOC) as $row) {
        if (($row[$released] ?? null) !== null) continue;
        if ($table === 'merchant_admin' && ((int) $row['account_type'] !== 2 || (int) $row['is_owner'] !== 1)) continue;
        if ($row[$field] === '') {
            if ((string) $row[$index] !== '') $anomalies[] = ['table' => $table, 'id' => (int) $row['id'], 'reason' => 'missing_encrypted_mobile'];
            continue;
        }
        try {
            $mobile = preg_replace('/[\s().-]+/', '', trim(CryptoHelper::decrypt($row[$field], $aes)));
            if (! preg_match('/^\+[1-9]\d{6,14}$/D', $mobile)) throw new RuntimeException('Invalid mobile');
            $hash = hash_hmac('sha256', 'merchant-registration-phone-v1:' . $mobile, $aes);
            if (! hash_equals($hash, (string) $row[$index])) {
                $anomalies[] = ['table' => $table, 'id' => (int) $row['id'], 'reason' => 'missing_or_stale_hash'];
            }
            $groups[$hash]['mobile'] = MaskHelper::mobile($mobile);
            $groups[$hash][$table][] = array_intersect_key($row, array_flip(
                ['id', 'site_id', 'merchant_id', 'username', 'status', 'registration_status', 'account_status', 'deleted_at', 'is_owner', 'account_type']
            ));
        } catch (Throwable) {
            $anomalies[] = ['table' => $table, 'id' => (int) $row['id'], 'reason' => 'invalid_encrypted_mobile'];
        }
    }
}
$conflicts = [];
foreach ($groups as $group) {
    $apps = $group['merchant_application'] ?? [];
    $accounts = $group['merchant_admin'] ?? [];
    $linked = count($apps) === 1 && count($accounts) === 1 && (int) $apps[0]['merchant_id'] > 0
        && (int) $apps[0]['merchant_id'] === (int) $accounts[0]['merchant_id']
        && (int) $accounts[0]['is_owner'] === 1 && (int) $accounts[0]['account_type'] === 2;
    if (count($apps) > 1 || count($accounts) > 1 || ($apps !== [] && $accounts !== [] && ! $linked)) $conflicts[] = $group;
}
echo json_encode(['conflicts' => $conflicts, 'anomalies' => $anomalies], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
exit($conflicts === [] && $anomalies === [] ? 0 : 2);
