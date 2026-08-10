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
 * 帮助中心(Super Admin Portal · 全新)
 * 设计源:docs/redesign/super-admin-portal/modules/12-help-center.md
 * 路由前缀 /api/v1/admin/help/*(网关 map:help → system_service)
 */
class HelpController extends AbstractController
{
    // ── FAQ 文章 ───────────────────────────────────────────────

    #[Permission('help:article:list')]
    public function articles(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('help_article')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($kw = $this->strInput('keyword')) !== '') {
            $query->where('title', 'like', "%{$kw}%");
        }
        if (($cat = $this->intInput('categoryId')) > 0) {
            $query->where('category_id', $cat);
        }
        if (($aud = $this->strInput('audience')) !== '') {
            $query->where('audience', $aud);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)
            ->get(['id', 'site_id', 'title', 'category_id', 'audience', 'views', 'author', 'status', 'created_at', 'updated_at'])
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('help:article:save')]
    public function articleSave(): array
    {
        $data = [
            'title' => $this->requireStr('title'),
            'category_id' => $this->intInput('categoryId'),
            'audience' => $this->strInput('audience', 'customer'),
            'content' => (string) $this->input('content', ''),
            'status' => $this->intInput('status', 2),
        ];
        $id = $this->intInput('id');
        if ($id > 0) {
            Db::table('help_article')->where('id', $id)->whereNull('deleted_at')->update($data);
        } else {
            $data['site_id'] = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
            $data['author'] = AdminContext::adminName() ?: 'Admin';
            $id = (int) Db::table('help_article')->insertGetId($data);
        }
        return Result::success(['id' => $id], '已保存');
    }

    #[Permission('help:article:save')]
    public function articleDelete(): array
    {
        Db::table('help_article')->where('id', $this->requireId())->whereNull('deleted_at')
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }

    // ── 分类 ───────────────────────────────────────────────────

    #[Permission('help:category:list')]
    public function categories(): array
    {
        $query = Db::table('help_category')->whereNull('deleted_at');
        $this->applySiteScope($query);
        $list = $query->orderBy('sort')->orderBy('id')->get()
            ->map(static fn ($r) => (array) $r)->all();
        // 附带各分类文章数
        foreach ($list as &$row) {
            $row['article_count'] = Db::table('help_article')
                ->where('category_id', $row['id'])->whereNull('deleted_at')->count();
        }
        return Result::success($list);
    }

    #[Permission('help:category:save')]
    public function categorySave(): array
    {
        $data = [
            'name' => $this->requireStr('name'),
            'icon' => mb_substr($this->strInput('icon'), 0, 20),
            'description' => mb_substr($this->strInput('description'), 0, 255),
            'sort' => $this->intInput('sort'),
            'visible' => $this->intInput('visible', 1) === 0 ? 0 : 1,
        ];
        $id = $this->intInput('id');
        if ($id > 0) {
            Db::table('help_category')->where('id', $id)->whereNull('deleted_at')->update($data);
        } else {
            $data['site_id'] = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
            $id = (int) Db::table('help_category')->insertGetId($data);
        }
        return Result::success(['id' => $id], '已保存');
    }

    #[Permission('help:category:save')]
    public function categoryDelete(): array
    {
        $id = $this->requireId();
        if (Db::table('help_article')->where('category_id', $id)->whereNull('deleted_at')->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该分类下存在文章,不可删除');
        }
        Db::table('help_category')->where('id', $id)->whereNull('deleted_at')
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }

    // ── 公告 ───────────────────────────────────────────────────

    #[Permission('help:announcement:list')]
    public function announcements(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('help_announcement')->whereNull('deleted_at');
        $this->applySiteScope($query);
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('help:announcement:publish')]
    public function announcementSave(): array
    {
        $data = [
            'title' => $this->requireStr('title'),
            'audience' => $this->strInput('audience', 'all'),
            'content' => (string) $this->input('content', ''),
            'priority' => $this->intInput('priority', 2),
            'start_time' => $this->strInput('startTime') ?: null,
            'end_time' => $this->strInput('endTime') ?: null,
            'status' => $this->intInput('status', 4),
        ];
        $id = $this->intInput('id');
        if ($id > 0) {
            Db::table('help_announcement')->where('id', $id)->whereNull('deleted_at')->update($data);
        } else {
            $data['site_id'] = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
            $id = (int) Db::table('help_announcement')->insertGetId($data);
        }
        return Result::success(['id' => $id], '已保存');
    }

    #[Permission('help:announcement:publish')]
    public function announcementDelete(): array
    {
        Db::table('help_announcement')->where('id', $this->requireId())->whereNull('deleted_at')
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }

    // ── 搜索分析 ───────────────────────────────────────────────

    #[Permission('help:analytics:list')]
    public function searchAnalytics(): array
    {
        $base = Db::table('help_search_log');
        $this->applySiteScope($base);

        $top = (clone $base)
            ->selectRaw('keyword, COUNT(*) AS cnt, ROUND(AVG(result_count), 1) AS avg_result')
            ->groupBy('keyword')->orderByDesc('cnt')->limit(20)->get()
            ->map(static fn ($r) => (array) $r)->all();
        $noResult = (clone $base)->where('result_count', 0)
            ->selectRaw('keyword, COUNT(*) AS cnt')
            ->groupBy('keyword')->orderByDesc('cnt')->limit(20)->get()
            ->map(static fn ($r) => (array) $r)->all();

        return Result::success(['topKeywords' => $top, 'noResultKeywords' => $noResult]);
    }
}
