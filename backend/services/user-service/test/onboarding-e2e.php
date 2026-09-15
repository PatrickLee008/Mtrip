<?php

declare(strict_types=1);

if (getenv('MTRIP_STAGE7_E2E') !== '1') {
    throw new RuntimeException('Stage 7 E2E environment required');
}
require __DIR__ . '/M12Bootstrap.php';

use App\Controller\App\FavoriteController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Context\UserContext;

function stage7FavoriteCall(FavoriteController $controller, string $method, array $input = []): array
{
    setRequest($input);
    return $controller->{$method}();
}

$mode = $argv[1] ?? 'visible';
$key = (string) getenv('MTRIP_STAGE7_KEY');
if (! preg_match('/^[0-9]{8,24}$/D', $key)) throw new RuntimeException('Invalid Stage 7 key');
$application = Db::table('merchant_application')->where('reg_number', 'STAGE7-' . $key)->first();
if (! $application) throw new RuntimeException('Stage 7 application not found');
$propertyId = (int) Db::table('merchant_store as p')
    ->join('merchant_application_business as b', 'b.id', '=', 'p.source_business_id')
    ->where('b.application_id', $application->id)->orderBy('b.id')->value('p.id');
if ($propertyId < 1) throw new RuntimeException('Stage 7 property not found');

UserContext::set(['user_id' => 97007, 'site_id' => (int) $application->site_id]);
$controller = $container->get(FavoriteController::class);

if ($mode === 'visible') {
    check(stage7FavoriteCall($controller, 'add', ['propertyId' => $propertyId])['code'] === 0,
        'E2E user can favorite the published property by propertyId');
    stage7FavoriteCall($controller, 'add', ['propertyId' => $propertyId]);
    check(Db::table('user_favorite')->where('site_id', $application->site_id)->where('user_id', 97007)
        ->where('property_id', $propertyId)->where('goods_id', 0)->count() === 1,
        'E2E repeated favorite is idempotent and stores no hotel goods ID');
    $list = stage7FavoriteCall($controller, 'list')['data'];
    check($list['total'] === 1 && (int) $list['list'][0]['property_id'] === $propertyId,
        'E2E favorite list returns the same property identity');
    stage7FavoriteCall($controller, 'remove', ['propertyId' => $propertyId]);
    check(stage7FavoriteCall($controller, 'list')['data']['total'] === 0,
        'E2E favorite removal is property scoped');
    echo "Stage 7 user favorite chain complete\n";
    exit(0);
}

if ($mode === 'hidden') {
    rejects(40401, fn () => stage7FavoriteCall($controller, 'add', ['propertyId' => $propertyId]),
        'E2E user cannot newly favorite an offline property');
    echo "Stage 7 user offline favorite gate complete\n";
    exit(0);
}

throw new RuntimeException('Unknown Stage 7 user mode');
