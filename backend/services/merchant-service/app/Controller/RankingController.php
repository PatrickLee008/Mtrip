<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\MarketplaceService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Support\Result;

/** M12 S5: explicit market scope, no legacy demo/global publish fallback. */
class RankingController extends AbstractController
{
    #[Inject]
    protected MarketplaceService $marketplace;

    private function params(): array
    {
        $params = [];
        foreach (['siteId', 'businessType', 'countryCode', 'cityKey', 'region', 'entityType', 'expectedVersion', 'note',
            'id', 'ids', 'propertyId', 'goodsId', 'pinned', 'featured', 'status', 'name', 'tagline', 'imageUrl',
            'destinationCountry', 'destinationCity', 'displayEnabled', 'expectedPropertyVersion'] as $key) {
            $value = $this->input($key);
            if ($value !== null) $params[$key] = $value;
        }
        return $params;
    }

    #[Permission('merchant:ranking:list')]
    public function listings(): array { return Result::success($this->marketplace->read($this->marketplace->scope($this->params(), 'listing'))); }

    #[Permission('merchant:ranking:list')]
    public function destinations(): array { return Result::success($this->marketplace->read($this->marketplace->scope($this->params(), 'destination'))); }

    #[Permission('merchant:ranking:list')]
    public function candidates(): array { return Result::success($this->marketplace->candidates($this->marketplace->scope($this->params(), 'listing'))); }

    #[Permission('merchant:ranking:list')]
    public function preview(): array
    {
        return Result::success($this->marketplace->preview($this->marketplace->scope($this->params(), $this->strInput('entityType', 'listing')), $this->strInput('view') === 'published'));
    }

    #[Permission('merchant:property:bind')]
    public function addListing(): array { return Result::success($this->marketplace->addListing($this->marketplace->scope($this->params(), 'listing'), $this->params())); }

    #[Permission('merchant:property:bind')]
    public function propertyDisplay(): array { return Result::success($this->marketplace->propertyDisplay($this->marketplace->scope($this->params(), 'listing'), $this->params())); }

    #[Permission('merchant:ranking:save')]
    public function saveOrder(): array { return Result::success($this->marketplace->reorder($this->marketplace->scope($this->params(), $this->strInput('entityType', 'listing')), $this->params())); }

    #[Permission('merchant:ranking:save')]
    public function pin(): array { return Result::success($this->marketplace->flags($this->marketplace->scope($this->params(), 'listing'), $this->params())); }

    #[Permission('merchant:ranking:save')]
    public function destinationPin(): array { return Result::success($this->marketplace->flags($this->marketplace->scope($this->params(), 'destination'), $this->params())); }

    #[Permission('merchant:ranking:publish')]
    public function publish(): array { return Result::success($this->marketplace->publish($this->marketplace->scope($this->params(), $this->strInput('entityType', 'listing')), $this->params())); }

    #[Permission('merchant:ranking:add')]
    public function destinationAdd(): array { return Result::success($this->marketplace->destination($this->marketplace->scope($this->params(), 'destination'), $this->params(), true)); }

    #[Permission('merchant:ranking:add')]
    public function destinationUpdate(): array { return Result::success($this->marketplace->destination($this->marketplace->scope($this->params(), 'destination'), $this->params(), false)); }

    #[Permission('merchant:ranking:list')]
    public function history(): array
    {
        $scope = $this->marketplace->scope($this->params(), $this->strInput('entityType', 'listing'));
        $marketId = Db::table('ranking_market')->where($scope)->value('id');
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('ranking_history')->where('market_id', $marketId ?? 0)->where('site_id', $scope['site_id']);
        $total = (clone $query)->count();
        $rows = $query->orderByDesc('id')->forPage($page, $pageSize)->get()->map(static function ($r) {
            $r = (array) $r;
            foreach (['before_json', 'after_json'] as $key) $r[$key] = json_decode($r[$key] ?? 'null', true);
            return $r;
        })->all();
        return Result::page($rows, $total, $page, $pageSize);
    }
}
