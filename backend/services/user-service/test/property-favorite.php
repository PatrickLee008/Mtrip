<?php

declare(strict_types=1);

require __DIR__ . '/M12Bootstrap.php';

use App\Controller\App\FavoriteController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\UserContext;

$controller = $container->get(FavoriteController::class);
$merchants = $markets = $properties = $rooms = $favorites = [];

function favoriteCall(FavoriteController $controller, string $method, array $input = []): array
{
    setRequest($input);
    return $controller->{$method}();
}

try {
    foreach ([991, 992] as $siteId) {
        $merchant = $merchants[] = merchantFixture($siteId);
        $property = $properties[] = (int) Db::table('merchant_store')->insertGetId([
            'site_id' => $siteId, 'merchant_id' => $merchant, 'store_name' => "Favorite Property {$siteId}",
            'business_type' => 'hotel', 'country_code' => 'MM', 'city_key' => 'favorite-city',
            'status' => 1, 'kyc_status' => 1, 'content_status' => 2, 'content_approved_version' => 1, 'publish_status' => 1,
            'operating_status' => 1, 'display_enabled' => 1,
        ]);
        $rooms[] = (int) Db::table('hotel_room_type')->insertGetId([
            'site_id' => $siteId, 'property_id' => $property,
            'room_name' => 'Favorite Room', 'base_price' => 100, 'status' => 1, 'publish_status' => 2, 'approved_version' => 1,
        ]);
    }

    UserContext::set(['user_id' => 99101, 'site_id' => 991]);
    check(favoriteCall($controller, 'add', ['propertyId' => $properties[0]])['code'] === 0,
        'S6 visible unranked property can be favorited by propertyId');
    favoriteCall($controller, 'add', ['propertyId' => $properties[0]]);
    check(Db::table('user_favorite')->where('site_id', 991)->where('user_id', 99101)
        ->where('property_id', $properties[0])->where('goods_id', 0)->count() === 1,
        'F property favorite is idempotent and clears hotel goods key');
    rejects(40401, fn () => favoriteCall($controller, 'add', ['propertyId' => $properties[1]]),
        'F favorite cannot cross token site');

    $favorites[] = (int) Db::table('user_favorite')->insertGetId([
        'site_id' => 991, 'user_id' => 99101, 'property_id' => $properties[1], 'goods_id' => 0,
    ]);
    $favorites[] = (int) Db::table('user_favorite')->insertGetId([
        'site_id' => 991, 'user_id' => 99102, 'property_id' => $properties[0], 'goods_id' => 0,
    ]);
    $list = favoriteCall($controller, 'list')['data'];
    check($list['total'] === 1 && (int) $list['list'][0]['property_id'] === $properties[0],
        'F favorite list is isolated by site user and property');

    favoriteCall($controller, 'remove', ['propertyId' => $properties[0]]);
    check(favoriteCall($controller, 'list')['data']['total'] === 0,
        'F favorite removal uses propertyId');
    echo "PROPERTY FAVORITE INTEGRATION PASSED\n";
} finally {
    if ($favorites) Db::table('user_favorite')->whereIn('id', $favorites)->delete();
    Db::table('user_favorite')->whereIn('property_id', $properties)->delete();
    if ($markets) Db::table('ranking_market')->whereIn('id', $markets)->delete();
    if ($rooms) Db::table('hotel_room_type')->whereIn('id', $rooms)->delete();
    if ($properties) Db::table('merchant_store')->whereIn('id', $properties)->delete();
    if ($merchants) Db::table('merchant_info')->whereIn('id', $merchants)->delete();
}
