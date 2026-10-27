<?php

declare(strict_types=1);

// Run from the service root with vendor installed; query compilation never connects to a database.
require getcwd() . '/vendor/autoload.php';

use App\Controller\Admin\HelpController;
use Hyperf\Database\MySqlConnection;
use Hyperf\Database\Query\Builder;
use Mtrip\Shared\Context\AdminContext;

class HelpScopeProbe extends HelpController
{
    public int $querySiteId = 0;

    protected function intInput(string $key, int $default = 0): int
    {
        return $key === 'siteId' ? $this->querySiteId : $default;
    }

    public function scope(Builder $query): void
    {
        $this->applySiteScope($query);
    }
}

$connection = new MySqlConnection(static function () {
    throw new RuntimeException('This test must not connect to a database');
});
$controller = new HelpScopeProbe();
$cases = [
    ['super all sites', true, 0, 0, []],
    ['super selected site', true, 0, 9, [9]],
    ['site admin default', false, 7, 0, [7]],
    ['site admin cannot widen', false, 7, 9, [7]],
    ['site admin own filter', false, 7, 7, [7]],
    ['non-super zero remains restricted', false, 0, 9, [0]],
];

foreach ($cases as [$name, $super, $siteId, $querySiteId, $expected]) {
    AdminContext::set(['is_super' => $super, 'site_id' => $siteId]);
    $controller->querySiteId = $querySiteId;
    $query = $connection->table('help_article')->whereNull('deleted_at');
    $controller->scope($query);
    if ($query->getBindings() !== $expected
        || str_contains($query->toSql(), '`site_id` = ?') !== ($expected !== [])) {
        throw new RuntimeException($name . ': incorrect site scope');
    }
    echo "PASS {$name}\n";
}

AdminContext::set([]);
