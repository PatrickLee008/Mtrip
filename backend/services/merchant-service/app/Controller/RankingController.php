<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * Marketplace Ranking(Super Admin Portal 模块 03,整改 Phase C)
 * 需求源:docs/redesign/需求分析-商户管理模块.md §3.9
 * 前缀 /api/v1/admin/merchant/ranking/*(网关 merchant 前缀已注册,零改动)
 *
 * 发布机制(C5):表内即草稿态,发布时递增 published_version 并写审计;
 * C 端按 published_version 读取的接口契约预留(消费者端接入另行排期)
 */
class RankingController extends AbstractController
{
    /** 商家排名列表:businessType/city/status/keyword 筛选,featured 置顶 + rank 升序 */
    #[Permission('merchant:ranking:list')]
    public function listings(): array
    {
        $query = Db::table('ranking_listing')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($type = $this->strInput('businessType')) !== '') {
            $query->where('business_type', $type);
        }
        if (($city = $this->strInput('city')) !== '') {
            $query->where('city', $city);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        if (($kw = $this->strInput('keyword')) !== '') {
            $query->where(function ($q) use ($kw) {
                $q->where('business_name', 'like', "%{$kw}%")
                    ->orWhere('merchant_name', 'like', "%{$kw}%");
            });
        }
        $list = $query->orderByDesc('featured')->orderBy('rank')->get()
            ->map(static fn ($r) => (array) $r)->all();
        $cities = Db::table('ranking_listing')->whereNull('deleted_at')->distinct()->pluck('city')->all();
        return Result::success([
            'list' => $list,
            'cities' => array_values(array_filter($cities)),
        ]);
    }

    /** 批量保存排序/置顶(items=[{id,rank,featured}]),仅记录发生变化的行 */
    #[Permission('merchant:ranking:save')]
    public function saveOrder(): array
    {
        $items = (array) $this->input('items', []);
        if ($items === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'items 不能为空');
        }
        $changes = [];
        Db::transaction(function () use ($items, &$changes) {
            foreach ($items as $item) {
                $id = (int) ($item['id'] ?? 0);
                if ($id <= 0) {
                    continue;
                }
                $row = Db::table('ranking_listing')->where('id', $id)->whereNull('deleted_at')->first();
                if (! $row) {
                    continue;
                }
                $this->assertSiteScope((int) $row->site_id);
                $rank = (int) ($item['rank'] ?? 0) ?: (int) $row->rank;
                $featured = isset($item['featured']) ? (int) $item['featured'] : (int) $row->featured;
                if ((int) $row->rank === $rank && (int) $row->featured === $featured) {
                    continue;
                }
                Db::table('ranking_listing')->where('id', $id)->update([
                    'rank' => $rank,
                    'featured' => $featured,
                ]);
                $changes[] = [
                    'entity_id' => $id,
                    'name' => (string) $row->business_name,
                    'from' => (int) $row->rank,
                    'to' => $rank,
                    'action' => (int) $row->featured === $featured ? 'reorder' : ($featured === 1 ? 'pin' : 'unpin'),
                ];
            }
        });
        foreach ($changes as $c) {
            $this->pushHistory('listing', $c['entity_id'], $c['name'], $c['action'], $c['from'], $c['to']);
        }
        return Result::success(null, '排序已保存');
    }

    /** 单条商家置顶/取消置顶 */
    #[Permission('merchant:ranking:save')]
    public function pin(): array
    {
        $id = $this->requireId();
        $row = $this->findListing($id);
        $pinned = $this->intInput('pinned', 1) === 1 ? 1 : 0;
        Db::table('ranking_listing')->where('id', $id)->update(['featured' => $pinned]);
        $this->pushHistory('listing', $id, (string) $row['business_name'], $pinned === 1 ? 'pin' : 'unpin', 0, 0);
        return Result::success(null, $pinned === 1 ? '已置顶' : '已取消置顶');
    }

    /** 发布(C5):当前草稿整体发布,递增版本并写审计 */
    #[Permission('merchant:ranking:publish')]
    public function publish(): array
    {
        $listing = Db::table('ranking_listing')->whereNull('deleted_at');
        $dest = Db::table('ranking_destination')->whereNull('deleted_at');
        $siteId = AdminContext::scopeSiteId($this->intInput('siteId'));
        if ($siteId !== null && $siteId > 0) {
            $listing->where('site_id', $siteId);
            $dest->where('site_id', $siteId);
        }
        Db::transaction(function () use ($listing, $dest) {
            $listing->update([
                'published_version' => (int) (clone $listing)->max('published_version') + 1,
                'publisher_id' => AdminContext::adminId(),
            ]);
            $dest->update([
                'published_version' => (int) (clone $dest)->max('published_version') + 1,
            ]);
        });
        $this->pushHistory('listing', 0, 'All listings', 'publish', 0, 0, 'version +1');
        $this->pushHistory('destination', 0, 'All destinations', 'publish', 0, 0, 'version +1');
        return Result::success(null, '已发布,消费者端将按新排序展示');
    }

    /** 排名历史(审计) */
    #[Permission('merchant:ranking:list')]
    public function history(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('ranking_history');
        $this->applySiteScope($query);
        if (($et = $this->strInput('entityType')) !== '') {
            $query->where('entity_type', $et);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 热门目的地列表:region/status 筛选,featured 置顶 + rank 升序 */
    #[Permission('merchant:ranking:list')]
    public function destinations(): array
    {
        $query = Db::table('ranking_destination')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($region = $this->strInput('region')) !== '') {
            $query->where('region', $region);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $list = $query->orderByDesc('featured')->orderBy('rank')->get()
            ->map(static fn ($r) => (array) $r)->all();
        $regions = Db::table('ranking_destination')->whereNull('deleted_at')->distinct()->pluck('region')->all();
        return Result::success([
            'list' => $list,
            'regions' => array_values(array_filter($regions)),
        ]);
    }

    /** 新增目的地 */
    #[Permission('merchant:ranking:add')]
    public function destinationAdd(): array
    {
        $name = $this->requireStr('name');
        $region = $this->requireStr('region');
        $query = Db::table('ranking_destination')->whereNull('deleted_at');
        $siteId = AdminContext::scopeSiteId($this->intInput('siteId'));
        if ($siteId !== null && $siteId > 0) {
            $query->where('site_id', $siteId);
        }
        $rank = (int) (clone $query)->max('rank') + 1;
        $id = Db::table('ranking_destination')->insertGetId([
            'site_id' => $siteId ?? 0,
            'name' => mb_substr($name, 0, 100),
            'region' => mb_substr($region, 0, 100),
            'tagline' => mb_substr($this->strInput('tagline'), 0, 200),
            'image_url' => mb_substr($this->strInput('imageUrl'), 0, 500),
            'rank' => $rank,
            'featured' => 0,
            'status' => 1,
            'published_version' => 0,
            'last_updated_by' => AdminContext::adminId(),
        ]);
        $this->pushHistory('destination', $id, $name, 'add', 0, $rank);
        return Result::success(['id' => $id], '目的地已新增');
    }

    /** 更新目的地(名称/区域/标语/图片/状态/置顶/排序) */
    #[Permission('merchant:ranking:add')]
    public function destinationUpdate(): array
    {
        $id = $this->requireId();
        $row = $this->findDestination($id);
        $data = [];
        foreach ([
            'name' => 'name',
            'region' => 'region',
            'tagline' => 'tagline',
            'image_url' => 'imageUrl',
            'status' => 'status',
            'featured' => 'featured',
            'rank' => 'rank',
        ] as $column => $param) {
            $value = $this->input($param);
            if ($value !== null && $value !== '') {
                $data[$column] = is_string($value) ? mb_substr(trim($value), 0, 500) : (int) $value;
            }
        }
        if ($data === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '没有可更新的字段');
        }
        Db::table('ranking_destination')->where('id', $id)->update($data);
        $this->pushHistory(
            'destination',
            $id,
            (string) ($data['name'] ?? $row['name']),
            'update',
            (int) $row['rank'],
            (int) ($data['rank'] ?? $row['rank']),
        );
        return Result::success(null, '目的地已更新');
    }

    /** 目的地置顶/取消置顶 */
    #[Permission('merchant:ranking:save')]
    public function destinationPin(): array
    {
        $id = $this->requireId();
        $row = $this->findDestination($id);
        $pinned = $this->intInput('pinned', 1) === 1 ? 1 : 0;
        Db::table('ranking_destination')->where('id', $id)->update(['featured' => $pinned]);
        $this->pushHistory('destination', $id, (string) $row['name'], $pinned === 1 ? 'pin' : 'unpin', 0, 0);
        return Result::success(null, $pinned === 1 ? '已置顶' : '已取消置顶');
    }

    // ── 私有助手 ──────────────────────────────────────────────

    private function findListing(int $id): array
    {
        $row = Db::table('ranking_listing')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '排名条目不存在');
        }
        $row = (array) $row;
        $this->assertSiteScope((int) $row['site_id']);
        return $row;
    }

    private function findDestination(int $id): array
    {
        $row = Db::table('ranking_destination')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '目的地不存在');
        }
        $row = (array) $row;
        $this->assertSiteScope((int) $row['site_id']);
        return $row;
    }

    /** 写排名审计 */
    private function pushHistory(string $type, int $entityId, string $name, string $action, int $from, int $to, string $note = ''): void
    {
        Db::table('ranking_history')->insert([
            'site_id' => AdminContext::siteId(),
            'entity_type' => $type,
            'entity_id' => $entityId,
            'entity_name' => mb_substr($name, 0, 150),
            'action' => $action,
            'from_rank' => $from,
            'to_rank' => $to,
            'note' => mb_substr($note, 0, 255),
            'operator_id' => AdminContext::adminId(),
            'operator_name' => AdminContext::adminName(),
        ]);
    }
}
