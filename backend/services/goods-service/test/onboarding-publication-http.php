<?php

declare(strict_types=1);

if (getenv('MTRIP_STAGE6_SMOKE') !== '1' || getenv('APP_ENV') === 'production') {
    throw new RuntimeException('Stage 6 local smoke environment required');
}
define('BASE_PATH', '/opt/www');
require BASE_PATH . '/vendor/autoload.php';
putenv('SCAN_CACHEABLE=true');
Hyperf\Di\ClassLoader::init();
$container = require BASE_PATH . '/config/container.php';

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Support\CryptoHelper;

const STAGE6_SECRET = 'stage6-local-smoke-secret';

function stage6Check(bool $condition, string $name): void
{
    if (! $condition) throw new RuntimeException('FAIL: ' . $name);
    echo 'PASS: ' . $name . PHP_EOL;
}

function stage6Request(string $clientId, string $path): array
{
    $timestamp = (string) time();
    $nonce = bin2hex(random_bytes(12));
    $signaturePath = explode('?', $path)[0];
    $curl = curl_init('http://gateway' . $path);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json', 'X-Site-Id: 991', 'X-Client-Id: ' . $clientId,
            'X-Timestamp: ' . $timestamp, 'X-Nonce: ' . $nonce,
            'X-Sign: ' . hash_hmac('sha256', $clientId . 'GET' . $signaturePath . $timestamp . $nonce, STAGE6_SECRET),
        ],
    ]);
    $raw = curl_exec($curl);
    if ($raw === false) throw new RuntimeException('Gateway request failed: ' . curl_error($curl));
    $result = json_decode((string) $raw, true);
    if (! is_array($result)) throw new RuntimeException('Invalid gateway response: ' . $raw);
    return $result;
}

$suffix = bin2hex(random_bytes(6));
$clientId = 'stage6-' . $suffix;
$merchantId = $propertyId = $roomId = 0;
try {
    Db::connection('system')->table('sys_client')->insert([
        'site_id' => 991, 'client_id' => $clientId, 'client_name' => 'Stage 6 local smoke',
        'client_secret' => CryptoHelper::encrypt(STAGE6_SECRET, (string) getenv('MTRIP_AES_KEY')),
        'client_type' => 3, 'qps_limit' => 0,
    ]);
    $merchantId = (int) Db::table('merchant_info')->insertGetId([
        'site_id' => 991, 'merchant_name' => 'Stage 6 Smoke Hotel', 'credit_code' => 'S6-' . $suffix,
        'legal_person' => 'Smoke', 'contact_name' => 'Smoke', 'contact_phone' => '', 'status' => 3,
    ]);
    $propertyId = (int) Db::table('merchant_store')->insertGetId([
        'site_id' => 991, 'merchant_id' => $merchantId, 'store_name' => 'Stage 6 Unranked Hotel',
        'business_type' => 'hotel', 'country_code' => 'MM', 'city_key' => $clientId,
        'address' => 'Yangon', 'status' => 1, 'kyc_status' => 1, 'content_status' => 2,
        'content_approved_version' => 1, 'publish_status' => 1, 'operating_status' => 1, 'display_enabled' => 1,
    ]);
    $roomId = (int) Db::table('hotel_room_type')->insertGetId([
        'site_id' => 991, 'property_id' => $propertyId, 'room_name' => 'Stage 6 Room',
        'base_price' => 100, 'base_stock' => 2, 'status' => 1, 'publish_status' => 2, 'approved_version' => 1,
    ]);

    $list = stage6Request($clientId, '/api/v1/app/hotels/list?countryCode=MM&cityKey=' . rawurlencode($clientId));
    stage6Check(($list['code'] ?? null) === 0, 'signed hotel search returns the unified success response');
    stage6Check(($list['data']['total'] ?? 0) === 1
        && (int) ($list['data']['list'][0]['property_id'] ?? 0) === $propertyId
        && (int) ($list['data']['list'][0]['ranking_id'] ?? -1) === 0,
        'signed search returns a qualified hotel without ranking configuration');

    Db::table('merchant_store')->where('id', $propertyId)->update(['content_status' => 1]);
    $detail = stage6Request($clientId, '/api/v1/app/hotels/detail?propertyId=' . $propertyId);
    stage6Check(($detail['code'] ?? null) === 40401, 'signed detail is removed immediately when a live gate fails');
} finally {
    if ($roomId > 0) Db::table('hotel_room_type')->where('id', $roomId)->delete();
    if ($propertyId > 0) Db::table('merchant_store')->where('id', $propertyId)->delete();
    if ($merchantId > 0) Db::table('merchant_info')->where('id', $merchantId)->delete();
    Db::connection('system')->table('sys_client')->where('client_id', $clientId)->delete();
}

echo "Stage 6 signed gateway smoke passed\n";
