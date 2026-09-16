<?php
declare(strict_types=1);
require __DIR__ . '/M12Bootstrap.php';

use App\Controller\App\GoodsController;
use App\Controller\App\HotelController;
use App\Controller\Merchant\ReviewController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Merchant\MarketplaceReader;

UserContext::set(['user_id' => 99101, 'site_id' => 991]);
$hotels = $container->get(HotelController::class);
$goodsController = $container->get(GoodsController::class);
$merchantReviews = $container->get(ReviewController::class);
$hotelCall = function (string $method, array $params = []) use ($hotels) { setRequest($params); return $hotels->$method()['data']; };
$goodsCall = function (string $method, array $params = []) use ($goodsController) { setRequest($params); return $goodsController->$method()['data']; };
$merchant = $market = 0;
$properties = $rooms = $reviews = $goods = [];
$key = 'f-consumer-' . bin2hex(random_bytes(4));
try {
    $merchant = merchantFixture();
    $scope = ['site_id' => 991, 'entity_type' => 'listing', 'business_type' => 'hotel', 'country_code' => 'MM', 'market_key' => $key];
    $market = (int) Db::table('ranking_market')->insertGetId($scope);
    $configs = [];
    foreach ([200, 100, 50] as $i => $price) {
        $property = $properties[] = (int) Db::table('merchant_store')->insertGetId([
            'site_id' => 991, 'merchant_id' => $merchant, 'store_name' => $key . ' hotel ' . $i,
            'business_type' => 'hotel', 'country_code' => 'MM', 'city_key' => $key, 'address' => 'Yangon ' . $i,
            'images' => json_encode(['https://example.com/' . $i . '.jpg']), 'facilities' => json_encode(['wifi']),
            'star_level' => 4, 'status' => 1, 'kyc_status' => 1, 'content_status' => 2,
            'content_approved_version' => 1, 'publish_status' => 1, 'operating_status' => 1, 'display_enabled' => 1,
        ]);
        $room = $rooms[] = (int) Db::table('hotel_room_type')->insertGetId([
            'site_id' => 991, 'property_id' => $property, 'room_name' => 'Room ' . $i,
            'base_price' => $price, 'base_price_citizen' => $price - 10, 'base_stock' => 5,
            'status' => 1, 'publish_status' => 2, 'approved_version' => 1,
        ]);
        $reviews[] = (int) Db::table('goods_review')->insertGetId([
            'site_id' => 991, 'property_id' => $property, 'goods_id' => 0, 'user_id' => 99101,
            'order_id' => 990000 + $i, 'rating' => $i + 3, 'content' => 'Property review', 'status' => 1,
        ]);
        if ($i < 2) {
            $rankingId = (int) Db::table('ranking_listing')->insertGetId([
                'market_id' => $market, 'property_id' => $property,
                'site_id' => 991, 'rank' => 2 - $i,
            ]);
            $configs[] = ['id' => $rankingId, 'property_id' => $property, 'rank' => 2 - $i,
                'pinned' => 0, 'featured' => 0, 'status' => 1];
        }
    }

    $query = ['countryCode' => 'MM', 'cityKey' => $key];
    $unranked = $hotelCall('list', $query);
    check($unranked['total'] === 3, 'S6 all qualified unranked properties are searchable');
    check(array_column($unranked['list'], 'property_id') === $properties,
        'S6 unranked search has deterministic property order');
    $global = array_column(MarketplaceReader::searchable(991), null, 'property_id');
    check(($global[$properties[2]]['country_code'] ?? '') === 'MM'
        && ($global[$properties[2]]['city_key'] ?? '') === $key,
        'S6 unscoped search keeps each property location');
    check($hotelCall('detail', ['propertyId' => $properties[2]])['property_id'] === $properties[2],
        'S6 unranked property detail is available');
    check($goodsCall('home')['recommend'] === [], 'S6 recommendation remains ranking-only');
    Db::table('ranking_market')->where('id', $market)->update(['version' => 1, 'published_version' => 1, 'published_json' => json_encode($configs)]);

    $list = $hotelCall('list', $query);
    check(array_column($list['list'], 'property_id') === [$properties[1], $properties[0], $properties[2]],
        'S6 published ranking orders configured properties without excluding unranked properties');
    check((int) $list['list'][2]['ranking_id'] === 0, 'S6 unranked property exposes no ranking identity');
    check($list['list'][1]['minPrice'] === 200.0 && $list['list'][1]['minPriceCitizen'] === 190.0, 'F property rooms provide both prices');
    check($list['list'][1]['rating'] === 3.0 && $list['list'][1]['reviewCount'] === 1, 'F property reviews provide rating summary');
    check(array_column($hotelCall('list', $query + ['sortBy' => 'price_asc'])['list'], 'property_id') === array_reverse($properties), 'F explicit price sort overrides ranking');
    check($hotelCall('list', $query + ['amenities' => 'wifi'])['total'] === 3, 'F property facilities filter retained');
    check($hotelCall('list', array_replace($query, ['cityKey' => $key . '-other']))['total'] === 0, 'F city isolation');
    rejects(40001, fn () => $hotelCall('list', $query + ['priceMin' => 'invalid']), 'F malformed numeric filter rejected');

    $detail = $hotelCall('detail', ['propertyId' => $properties[2]]);
    check($detail['id'] === $properties[2] && $detail['property_id'] === $properties[2], 'F detail identity is Property');
    check($detail['skus'][0]['room_type_id'] === $rooms[2], 'F detail rooms expose room type identity');
    check(! array_intersect(['site_id', 'goods_id', 'room_code', 'base_stock', 'launch_stock', 'refund_policy',
        'status', 'publish_status', 'approved_version', 'status_version', 'submitted_at', 'created_at', 'updated_at', 'deleted_at'], array_keys($detail['skus'][0])),
        'F detail room projection excludes merchant workflow and internal stock fields');
    $calendar = $hotelCall('calendar', ['propertyId' => $properties[2], 'roomTypeId' => $rooms[2], 'days' => 1]);
    check($calendar['propertyId'] === $properties[2] && $calendar['roomTypeId'] === $rooms[2] && count($calendar['calendar']) === 1, 'F calendar uses property and room type IDs');
    check($hotelCall('reviews', ['propertyId' => $properties[2]])['total'] === 1, 'F public reviews are property scoped');

    $home = $goodsCall('home');
    check(array_column($home['recommend'], 'property_id') === [$properties[1], $properties[0]],
        'S6 home recommendation uses only the published ranking');
    check(! str_contains(json_encode($configs), 'goods_id'), 'F published fixture contains no goods IDs');
    check(MarketplaceReader::published(991, 'listing', 'MM', $key) === $home['recommend'], 'F home and shared reader projections match');

    foreach ([['merchant_info', $merchant, 'status', 4, 3], ['merchant_store', $properties[0], 'kyc_status', 0, 1],
        ['merchant_store', $properties[0], 'content_status', 1, 2], ['merchant_store', $properties[0], 'content_approved_version', 0, 1],
        ['merchant_store', $properties[0], 'publish_status', 0, 1],
        ['merchant_store', $properties[0], 'operating_status', 0, 1], ['merchant_store', $properties[0], 'display_enabled', 0, 1],
        ['hotel_room_type', $rooms[0], 'publish_status', 1, 2], ['hotel_room_type', $rooms[0], 'approved_version', 0, 1]] as [$table, $id, $column, $bad, $good]) {
        Db::table($table)->where('id', $id)->update([$column => $bad]);
        check(! in_array($properties[0], array_column(MarketplaceReader::searchable(991, 'MM', $key), 'property_id'), true),
            'S6 live search gate excludes ' . $table . '.' . $column);
        Db::table($table)->where('id', $id)->update([$column => $good]);
    }

    setRequest([]);
    MerchantContext::set([
        'admin_id' => 99110, 'site_id' => 991, 'merchant_id' => $merchant, 'account_type' => 2,
        'is_owner' => false, 'property_ids' => $properties, 'selected_property_id' => $properties[0],
    ]);
    AdminContext::set(['admin_id' => 99110, 'site_id' => 991, 'permissions' => ['mch:reviews:reply']]);
    $selectedReviews = $merchantReviews->index()['data'];
    check($selectedReviews['total'] === 1 && (int) $selectedReviews['list'][0]['property_id'] === $properties[0],
        'F merchant reviews are narrowed to the selected property');
    setRequest(['id' => $reviews[1], 'content' => 'Cross-property reply']);
    rejects(40401, fn () => $merchantReviews->reply(), 'F selected property cannot reply to another property review');
    setRequest(['id' => $reviews[0], 'content' => 'Property reply']);
    check($merchantReviews->reply()['code'] === 0, 'F selected property can reply to its own review');
    MerchantContext::set([]);

    $ticket = $goods[] = (int) Db::table('goods_info')->insertGetId([
        'site_id' => 991, 'supplier_id' => 991, 'goods_name' => $key . ' ticket', 'goods_type' => 2, 'status' => 3,
    ]);
    check(array_column($goodsCall('list', ['goodsType' => 2, 'keyword' => $key])['list'], 'id') === [$ticket], 'F ticket goods path remains unchanged');
    UserContext::set(['site_id' => 992]);
    check($hotelCall('list', $query)['total'] === 0, 'F token site cannot be overridden by query');
} finally {
    Db::table('ranking_listing')->where('market_id', $market)->delete();
    Db::table('ranking_market')->where('id', $market)->delete();
    if ($reviews) Db::table('goods_review')->whereIn('id', $reviews)->delete();
    if ($rooms) Db::table('hotel_room_type')->whereIn('id', $rooms)->delete();
    if ($goods) Db::table('goods_info')->whereIn('id', $goods)->delete();
    if ($properties) Db::table('merchant_store')->whereIn('id', $properties)->delete();
    if ($merchant) Db::table('merchant_info')->where('id', $merchant)->delete();
}
