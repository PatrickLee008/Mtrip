<?php

declare(strict_types=1);

// Read-only integration check. Run from a booted local system-service with development data.
use App\Controller\Admin\GlobalSearchController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;

define('BASE_PATH', getcwd());
require BASE_PATH . '/vendor/autoload.php';
putenv('SCAN_CACHEABLE=true');
Hyperf\Di\ClassLoader::init();
require BASE_PATH . '/config/container.php';

class SearchProbe extends GlobalSearchController
{
    public array $params = [];

    protected function strInput(string $key, string $default = ''): string
    {
        return trim((string) ($this->params[$key] ?? $default));
    }

    protected function intInput(string $key, int $default = 0): int
    {
        return (int) ($this->params[$key] ?? $default);
    }
}

function verify(bool $ok, string $name): void
{
    if (! $ok) throw new RuntimeException($name);
    echo "PASS {$name}\n";
}

$probe = new SearchProbe();
foreach ([
    'merchant' => ['merchant_info', 'merchant_name', 'merchant:list:list'],
    'booking' => ['order_main', 'order_no', 'order:all:list'],
    'affiliate' => ['affiliate_partner', 'name', 'affiliate:partner:list'],
    'campaign' => ['marketing_campaign', 'title', 'marketing:campaign:list'],
    'user' => ['sys_admin', 'username', 'sys:admin:list'],
] as $category => [$table, $title, $permission]) {
    $row = Db::connection($category === 'user' ? 'default' : 'business')->table($table)
        ->whereNull('deleted_at')->orderByDesc('id')->first(['id', 'site_id', $title]);
    $probe->params = ['category' => $category, 'keyword' => $row ? $row->{$title} : 'search-check'];
    AdminContext::set(['is_super' => false, 'site_id' => 1, 'permissions' => []]);
    try {
        $probe->index();
        throw new RuntimeException("Missing permission check for {$category}");
    } catch (BusinessException $e) {
        verify($e->getCode() === ErrorCode::FORBIDDEN, "{$category} permission");
    }
    AdminContext::set(['is_super' => true]);
    $hits = $probe->index()['data'];
    verify(count($hits) <= 8, "{$category} limited results");
    if (! $row) {
        verify($hits === [], "{$category} empty source");
        continue;
    }
    verify($hits[0]['id'] === (string) $row->id, "{$category} exact match first");
    $otherSite = (int) $row->site_id + 1;
    $probe->params['siteId'] = $otherSite;
    verify(! in_array((string) $row->id, array_column($probe->index()['data'], 'id'), true), "{$category} selected site");
    AdminContext::set(['site_id' => $otherSite, 'permissions' => [$permission]]);
    $probe->params['siteId'] = (int) $row->site_id;
    verify(! in_array((string) $row->id, array_column($probe->index()['data'], 'id'), true), "{$category} enforced account site");
}
