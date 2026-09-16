<?php

declare(strict_types=1);

if (getenv('MTRIP_STAGE7_E2E') !== '1') {
    throw new RuntimeException('Stage 7 E2E environment required');
}
require __DIR__ . '/M12Bootstrap.php';

use App\Controller\App\GoodsController;
use App\Controller\App\HotelController;
use App\Service\RoomReviewService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Context\UserContext;

function stage7GoodsApplication(string $key): array
{
    $row = Db::table('merchant_application')->where('reg_number', 'STAGE7-' . $key)->first();
    if (! $row) throw new RuntimeException('Stage 7 application not found');
    return (array) $row;
}

function stage7GoodsProperties(array $application): array
{
    return Db::table('merchant_store as p')
        ->join('merchant_application_business as b', 'b.id', '=', 'p.source_business_id')
        ->where('b.application_id', $application['id'])->orderBy('b.id')
        ->get(['p.*'])->map(static fn ($row) => (array) $row)->all();
}

function stage7GoodsMerchant(array $application, int $propertyId): void
{
    $accountId = (int) Db::table('merchant_admin')->where('merchant_id', $application['merchant_id'])
        ->where('account_type', 2)->where('is_owner', 1)->value('id');
    MerchantContext::set([
        'admin_id' => $accountId, 'admin_name' => 'Stage 7 Owner',
        'site_id' => (int) $application['site_id'], 'merchant_id' => (int) $application['merchant_id'],
        'account_type' => 2, 'group_id' => 0, 'store_id' => 0, 'is_owner' => true,
        'selected_property_id' => $propertyId,
    ]);
}

function stage7HotelCall(HotelController $controller, string $method, array $input = []): array
{
    setRequest($input);
    return $controller->{$method}()['data'];
}

$mode = $argv[1] ?? 'room';
$key = (string) getenv('MTRIP_STAGE7_KEY');
if (! preg_match('/^[0-9]{8,24}$/D', $key)) throw new RuntimeException('Invalid Stage 7 key');
$application = stage7GoodsApplication($key);
$properties = stage7GoodsProperties($application);
if (count($properties) !== 2) throw new RuntimeException('Expected two Stage 7 properties');
$property = $properties[0];

if ($mode === 'room') {
    stage7GoodsMerchant($application, (int) $property['id']);
    $service = new RoomReviewService();
    $payload = [
        'room_name' => 'Stage 7 Room Draft', 'room_code' => 'S7-' . substr($key, -8),
        'description' => 'Stage 7 room', 'bed_type' => 'King', 'bed_count' => 1, 'area' => '36',
        'max_adults' => 2, 'max_children' => 1, 'max_guests' => 3, 'floor_name' => '3-5',
        'room_view' => 'City', 'smoking' => 0, 'breakfast' => 1, 'meal_plan' => 'Breakfast Included',
        'cancellation_policy' => 'Free cancellation', 'currency' => \App\Service\RoomContentService::siteCurrency((int) $property['site_id']), 'checkin_notes' => 'ID required',
        'base_price' => 120, 'weekend_price' => 140, 'extra_bed_price' => 20,
        'base_stock' => 6, 'launch_stock' => 4, 'images' => ['https://example.test/stage7-room.jpg'],
        'video_url' => '', 'facilities' => ['WiFi'], 'status' => 1, 'sort' => 1,
    ];
    Db::table('hotel_room_media')->insert(['site_id' => $property['site_id'], 'property_id' => $property['id'], 'uploaded_by' => MerchantContext::adminId(), 'kind' => 'image', 'url' => 'https://example.test/stage7-room.jpg', 'mime' => 'image/jpeg', 'size_bytes' => 1024]);
    $created = $service->save($property, 0, $payload, true);
    AdminContext::set(['admin_id' => 97003, 'admin_name' => 'Stage 7 Room Reviewer',
        'site_id' => (int) $application['site_id'], 'is_super' => false]);
    $service->audit((int) $created['revisionId'], 2, 'Please improve the room name');
    check((int) Db::table('hotel_room_type_revision')->where('id', $created['revisionId'])->value('status') === 3,
        'E2E reviewer rejects the first room version with a reason');

    stage7GoodsMerchant($application, (int) $property['id']);
    $payload['room_name'] = 'Stage 7 Approved Room';
    $resubmitted = $service->save($property, (int) $created['id'], $payload, true);
    check((int) $resubmitted['version'] === 2, 'E2E rejected room resubmits as a new version');
    AdminContext::set(['admin_id' => 97003, 'admin_name' => 'Stage 7 Room Reviewer',
        'site_id' => (int) $application['site_id'], 'is_super' => false]);
    $service->audit((int) $resubmitted['revisionId'], 1, 'Approved');
    check((int) Db::table('hotel_room_type')->where('id', $created['id'])->value('approved_version') === 2,
        'E2E approved room version becomes the live room');

    stage7GoodsMerchant($application, (int) $property['id']);
    $payload['room_name'] = 'Stage 7 Pending Room';
    $pending = $service->save($property, (int) $created['id'], $payload, true);
    check((int) $pending['version'] === 3
        && Db::table('hotel_room_type')->where('id', $created['id'])->value('room_name') === 'Stage 7 Approved Room',
        'E2E pending room update preserves the approved live room');
    Db::table('goods_review')->insert([
        'site_id' => (int) $application['site_id'], 'property_id' => (int) $property['id'],
        'goods_id' => 0, 'user_id' => 97007, 'order_id' => (int) ('97' . substr($key, -8)),
        'rating' => 5, 'content' => 'Stage 7 verified guest review', 'status' => 1,
    ]);
    check(Db::table('hotel_room_type')->where('property_id', $properties[1]['id'])->count() === 0,
        'E2E same-name second property remains isolated by property ID');
    echo "Stage 7 room review chain complete\n";
    exit(0);
}

UserContext::set(['user_id' => 97007, 'site_id' => (int) $application['site_id']]);
$hotels = $container->get(HotelController::class);
$goods = $container->get(GoodsController::class);
$query = ['countryCode' => 'MM', 'cityKey' => 'stage7-city'];

if ($mode === 'visible') {
    $list = stage7HotelCall($hotels, 'list', $query);
    check($list['total'] === 1 && (int) $list['list'][0]['property_id'] === (int) $property['id'],
        'E2E public search returns only the published first property');
    check((int) $list['list'][0]['ranking_id'] === 0 && (int) $list['list'][0]['rank'] === 0,
        'E2E unranked published property exposes zero ranking identity');
    $detail = stage7HotelCall($hotels, 'detail', ['propertyId' => $property['id']]);
    $room = $detail['roomTypes'][0] ?? [];
    check((int) $detail['property_id'] === (int) $property['id']
        && ($room['room_name'] ?? '') === 'Stage 7 Approved Room',
        'E2E detail uses propertyId and keeps the approved room projection');
    check(! array_intersect(['site_id', 'goods_id', 'room_code', 'base_stock', 'launch_stock', 'refund_policy',
        'status', 'publish_status', 'approved_version', 'status_version', 'submitted_at', 'created_at', 'updated_at', 'deleted_at'], array_keys($room)),
        'E2E public room projection excludes merchant workflow and internal stock fields');
    $calendar = stage7HotelCall($hotels, 'calendar', [
        'propertyId' => $property['id'], 'roomTypeId' => $room['room_type_id'], 'days' => 2,
    ]);
    check((int) $calendar['propertyId'] === (int) $property['id']
        && (int) $calendar['roomTypeId'] === (int) $room['room_type_id']
        && count($calendar['calendar']) === 2,
        'E2E room calendar uses propertyId and roomTypeId');
    check(stage7HotelCall($hotels, 'reviews', ['propertyId' => $property['id']])['total'] === 1,
        'E2E public reviews are scoped to the published property');
    setRequest([]);
    check($goods->home()['data']['recommend'] === [],
        'E2E ordinary publication does not enter the independent recommendation ranking');
    echo "Stage 7 public hotel visibility complete\n";
    exit(0);
}

if ($mode === 'hidden') {
    check(stage7HotelCall($hotels, 'list', $query)['total'] === 0,
        'E2E offline property leaves public search immediately');
    rejects(40401, fn () => stage7HotelCall($hotels, 'detail', ['propertyId' => $property['id']]),
        'E2E offline property detail is unavailable');
    echo "Stage 7 public hotel offline gate complete\n";
    exit(0);
}

throw new RuntimeException('Unknown Stage 7 goods mode');
