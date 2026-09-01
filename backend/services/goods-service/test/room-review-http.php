<?php

declare(strict_types=1);

require __DIR__ . '/RoomReviewBootstrap.php';

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Support\JwtHelper;

use function Hyperf\Config\config;

function api(string $path, string $token, ?array $body = null): array
{
    $ch = curl_init('http://gateway' . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'], CURLOPT_TIMEOUT => 15]);
    if ($body !== null) curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE)]);
    $raw = curl_exec($ch);
    if ($raw === false) throw new RuntimeException(curl_error($ch));
    $result = json_decode((string) $raw, true);
    if (! is_array($result) || (int) ($result['code'] ?? -1) !== 0) throw new RuntimeException('HTTP API failed: ' . $raw);
    return (array) $result['data'];
}

function upload(string $token): array
{
    $ch = curl_init('http://gateway/api/v1/merchant/rooms/media/upload');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token], CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => ['kind' => 'image', 'file' => new CURLFile('/tmp/room-upload.png', 'image/png', 'room-upload.png')], CURLOPT_TIMEOUT => 20]);
    $raw = curl_exec($ch);
    $result = json_decode((string) $raw, true);
    if (! is_array($result) || (int) ($result['code'] ?? -1) !== 0) throw new RuntimeException('HTTP upload failed: ' . $raw);
    return (array) $result['data'];
}

function mediaIsPublic(string $url): bool
{
    $ch = curl_init('http://gateway' . $url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $raw = curl_exec($ch);
    return $raw !== false
        && curl_getinfo($ch, CURLINFO_RESPONSE_CODE) === 200
        && str_starts_with((string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE), 'image/');
}

$goodsId = $roomId = 0; $uploadedUrl = '';
try {
    $account = (array) Db::table('merchant_admin')->where('username', 'codex_menu_context')->first();
    check($account !== [], 'HTTP fixture merchant account exists');
    $goodsId = (int) Db::table('goods_info')->insertGetId(['site_id' => $account['site_id'], 'merchant_id' => $account['merchant_id'], 'goods_name' => 'Room HTTP hotel', 'goods_type' => 1, 'status' => 3]);
    $secret = (string) config('mtrip.jwt_secret');
    $merchantToken = JwtHelper::issue(['admin_id' => (int) $account['id'], 'admin_name' => 'Room HTTP merchant', 'site_id' => (int) $account['site_id'], 'aud' => 'merchant', 'account_type' => 2, 'group_id' => 0, 'merchant_id' => (int) $account['merchant_id'], 'store_id' => 0, 'is_owner' => true, 'permissions' => ['mch:rooms:add', 'mch:rooms:edit', 'mch:rooms:delete', 'mch:rooms:status'], 'auth_version' => (int) $account['auth_version'], 'amr' => 'totp'], $secret, 600);
    $adminToken = JwtHelper::issue(['admin_id' => 1, 'admin_name' => 'Room HTTP reviewer', 'site_id' => 0, 'is_super' => true, 'permissions' => ['goods:audit:audit'], 'aud' => 'admin'], $secret, 600);
    $media = upload($merchantToken); $uploadedUrl = (string) $media['url'];
    check(str_starts_with($uploadedUrl, '/uploads/rooms/'), 'merchant HTTP media upload returns shared URL');
    check(mediaIsPublic($uploadedUrl), 'uploaded room image is publicly readable through gateway');
    $payload = ['goodsId' => $goodsId, 'roomName' => 'HTTP Room v1', 'roomCode' => 'HTTP-RR', 'description' => 'HTTP review', 'bedType' => '1 King Bed', 'bedCount' => 1, 'area' => '38', 'maxAdults' => 2, 'maxChildren' => 1, 'maxGuests' => 3, 'floorName' => '4-8', 'roomView' => 'Ocean View', 'smoking' => 0, 'mealPlan' => 'Breakfast Included', 'cancellationPolicy' => 'Flexible', 'checkinNotes' => 'ID', 'currency' => 'THB', 'basePrice' => 1000, 'weekendPrice' => 1200, 'extraBedPrice' => 200, 'baseStock' => 8, 'launchStock' => 4, 'images' => [$uploadedUrl], 'videoUrl' => '', 'facilities' => ['WiFi'], 'status' => 1, 'publishStatus' => 1];
    $created = api('/api/v1/merchant/rooms/save', $merchantToken, $payload);
    echo 'HTTP save keys: ' . implode(',', array_keys($created)) . "\n";
    $roomId = (int) $created['id'];
    check($roomId > 0 && (int) $created['reviewStatus'] === 1, 'merchant HTTP submit creates pending revision');
    $queue = api('/api/v1/admin/goods/room-review/list?page=1&pageSize=20&status=1&keyword=HTTP%20Room', $adminToken);
    check(in_array((int) $created['revisionId'], array_map('intval', array_column($queue['list'], 'id')), true), 'admin HTTP queue receives room submission');
    $review = api('/api/v1/admin/goods/room-review/detail?id=' . $created['revisionId'], $adminToken);
    check($review['revision']['payload']['room_name'] === 'HTTP Room v1', 'admin HTTP detail exposes submitted snapshot');
    api('/api/v1/admin/goods/room-review/audit', $adminToken, ['id' => $created['revisionId'], 'auditStatus' => 1, 'auditRemark' => 'Approved']);
    check((int) Db::table('hotel_room_type')->where('id', $roomId)->value('publish_status') === 2, 'admin HTTP approval publishes room');
    $payload['id'] = $roomId; $payload['roomName'] = 'HTTP Room v2';
    $updated = api('/api/v1/merchant/rooms/save', $merchantToken, $payload);
    check(Db::table('hotel_room_type')->where('id', $roomId)->value('room_name') === 'HTTP Room v1', 'HTTP pending edit preserves live projection');
    api('/api/v1/admin/goods/room-review/audit', $adminToken, ['id' => $updated['revisionId'], 'auditStatus' => 2, 'auditRemark' => 'Keep v1']);
    $detail = api('/api/v1/merchant/rooms/detail?id=' . $roomId, $merchantToken);
    check($detail['room']['room_name'] === 'HTTP Room v1' && $detail['latestRevision']['reject_reason'] === 'Keep v1', 'merchant HTTP detail shows rejection while live version remains');
} finally {
    if ($roomId > 0) Db::table('hotel_room_type_revision')->where('room_id', $roomId)->delete();
    if ($roomId > 0) Db::table('hotel_room_type')->where('id', $roomId)->delete();
    if ($goodsId > 0) Db::table('goods_info')->where('id', $goodsId)->delete();
    if ($uploadedUrl !== '') @unlink('/opt/www' . $uploadedUrl);
    Db::table('merchant_activity_log')->where('performed_by_id', 4025)->where('description', 'like', '%/merchant/rooms/%')->delete();
}
