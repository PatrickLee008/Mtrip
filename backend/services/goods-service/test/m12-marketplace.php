<?php
declare(strict_types=1);
require __DIR__ . '/M12Bootstrap.php';

use App\Controller\App\GoodsController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Merchant\MarketplaceReader;

UserContext::set(['user_id' => 99101, 'site_id' => 991]);
$controller = $container->get(GoodsController::class);
$call = function (string $method, array $params = []) use ($controller) { setRequest($params); return $controller->$method()['data']; };
$merchant = $app = $market = 0;
$goods = $properties = $businesses = [];
$key = 's5-consumer-' . bin2hex(random_bytes(4));
try {
    $merchant = merchantFixture();
    $app = (int) Db::table('merchant_application')->insertGetId(['site_id' => 991, 'merchant_id' => $merchant, 'app_no' => $key, 'company_name' => 'S5 consumer', 'country' => 'Myanmar']);
    $scope = ['site_id' => 991, 'entity_type' => 'listing', 'business_type' => 'hotel', 'country_code' => 'MM', 'market_key' => $key];
    $market = (int) Db::table('ranking_market')->insertGetId($scope);
    $configs = [];
    foreach ([200, 100, 50] as $i => $price) {
        $b = $businesses[] = (int) Db::table('merchant_application_business')->insertGetId(['site_id' => 991, 'application_id' => $app, 'business_name' => 'S5 hotel ' . $i, 'business_type' => 'hotel', 'kyc_status' => 1]);
        $p = $properties[] = (int) Db::table('merchant_store')->insertGetId(['site_id' => 991, 'merchant_id' => $merchant, 'source_business_id' => $b, 'store_name' => 'S5 hotel', 'business_type' => 'hotel', 'country_code' => 'MM', 'city_key' => $key, 'status' => 1, 'display_enabled' => 1]);
        $g = $goods[] = (int) Db::table('goods_info')->insertGetId(['site_id' => 991, 'merchant_id' => $merchant, 'goods_name' => $key . ' hotel ' . $i, 'goods_type' => 1, 'status' => 3]);
        Db::table('hotel_room_type')->insert(['site_id' => 991, 'goods_id' => $g, 'room_name' => 'Room', 'base_price' => $price, 'base_price_citizen' => $price - 10, 'status' => 1, 'publish_status' => 2]);
        Db::table('goods_review')->insert(['site_id' => 991, 'goods_id' => $g, 'user_id' => 99101, 'order_id' => $g, 'rating' => $i + 3, 'content' => 'S5 review', 'status' => 1]);
        $rankingId = (int) Db::table('ranking_listing')->insertGetId(['market_id' => $market, 'property_id' => $p, 'goods_id' => $g, 'business_id' => $b, 'site_id' => 991, 'rank' => $i + 1]);
        $configs[] = ['id' => $rankingId, 'property_id' => $p, 'goods_id' => $g, 'business_id' => $b, 'rank' => $i + 1, 'pinned' => $i === 0 ? 1 : 0, 'featured' => $i === 1 ? 1 : 0, 'status' => 1];
    }
    $query = ['goodsType' => 1, 'countryCode' => 'MM', 'cityKey' => $key];
    check($call('list', $query)['total'] === 0, 'S5 C-end draft-only hotels not discoverable');
    rejects(40401, fn () => $call('detail', ['id' => $goods[0]]), 'S5 C-end unpublished hotel detail unavailable');
    Db::table('ranking_market')->where('id', $market)->update(['version' => 1, 'published_version' => 1, 'published_json' => json_encode($configs)]);
    $list = $call('list', $query);
    check(array_column($list['list'], 'id') === $goods, 'S5 C-end default sort follows published priority');
    check($list['list'][0]['minPrice'] === 200.0 && $list['list'][0]['minPriceCitizen'] === 190.0, 'S5 C-end real room prices retained');
    check($list['list'][0]['rating'] === 3.0, 'S5 C-end real review rating');
    check(array_column($call('list', $query + ['sortBy' => 'price_asc'])['list'], 'id') === array_reverse($goods), 'S5 explicit price sort overrides pinned ranking');
    check(array_column($call('list', $query + ['sortBy' => 'rating'])['list'], 'id') === array_reverse($goods), 'S5 explicit rating sort overrides pinned ranking');
    $page = $call('list', $query + ['page' => 2, 'pageSize' => 1]);
    check($page['total'] === 3 && $page['list'][0]['id'] === $goods[1], 'S5 C-end pag paging and stable order');
    check($call('list', $query + ['keyword' => 'no-match'])['total'] === 0, 'S5 C-end keyword empty does not fall back');
    check($call('list', array_replace($query, ['cityKey' => $key . '-other']))['total'] === 0, 'S5 C-end city isolation');
    check($call('list', $query + ['priceMax' => 100])['total'] === 2, 'S5 C-end price filter retained');
    rejects(40001, fn () => $call('list', $query + ['priceMin' => 'invalid']), 'S5 malformed numeric filter rejected');
    check($list['list'][0]['reviewCount'] === 1, 'S5 C-end real review count');
    check($call('detail', ['id' => $goods[0]])['id'] === $goods[0], 'S5 eligible hotel detail works');
    Db::table('ranking_listing')->where('market_id', $market)->update(['rank' => 100, 'status' => 2]);
    check(array_column($call('list', $query)['list'], 'id') === $goods, 'S5 C-end draft flags never leak');
    $home = $call('home');
    check(array_column($home['recommend'], 'id') === $goods && isset($home['destinations']), 'S5 home uses published hotels and destination contract');
    $published = MarketplaceReader::published(991, 'listing', 'MM', $key);
    check($home['recommend'] === $published, 'S5 home uses shared consumer projection');
    Db::table('merchant_info')->where('id', $merchant)->update(['status' => 4]);
    check($call('list', $query)['total'] === 0 && $call('home')['recommend'] === [], 'S5 suspended merchant hidden from search and home');
    rejects(40401, fn () => $call('detail', ['id' => $goods[0]]), 'S5 suspended hotel detail unavailable');
    $ticket = $goods[] = (int) Db::table('goods_info')->insertGetId(['site_id' => 991, 'supplier_id' => 991, 'goods_name' => $key . ' ticket', 'goods_type' => 2, 'status' => 3]);
    check(array_column($call('list', ['goodsType' => 2, 'keyword' => $key])['list'], 'id') === [$ticket], 'S5 existing ticket path unchanged');
    UserContext::set(['site_id' => 992]);
    check($call('list', $query)['total'] === 0, 'S5 C-end forged query cannot override context site');
} finally {
    Db::table('ranking_listing')->where('market_id', $market)->delete();
    Db::table('ranking_market')->where('id', $market)->delete();
    Db::table('goods_review')->whereIn('goods_id', $goods)->delete();
    Db::table('hotel_room_type')->whereIn('goods_id', $goods)->delete();
    Db::table('goods_info')->whereIn('id', $goods)->delete();
    Db::table('merchant_store')->whereIn('id', $properties)->delete();
    Db::table('merchant_application_business')->whereIn('id', $businesses)->delete();
    Db::table('merchant_application')->where('id', $app)->delete();
    Db::table('merchant_info')->where('id', $merchant)->delete();
}
