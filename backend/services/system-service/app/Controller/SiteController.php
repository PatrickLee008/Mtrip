<?php

declare(strict_types=1);

namespace App\Controller;

use App\Model\SysAdmin;
use App\Model\SysSite;
use App\Model\SysSiteConfig;
use App\Support\TreeHelper;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 模块6 多站点配置:站点树 / CRUD / 启停 / 站点差异化参数
 * 非超管仅可见自身站点及其下级
 */
class SiteController extends AbstractController
{
    public function tree(): array
    {
        $rows = SysSite::query()->orderBy('sort')->orderBy('id')->get()->toArray();
        if (! AdminContext::isSuper()) {
            $rows = $this->scopeSubtree($rows, AdminContext::siteId());
            return Result::success(TreeHelper::build($rows, $this->rootParentId($rows)));
        }
        return Result::success(TreeHelper::build($rows));
    }

    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = SysSite::query();
        if (! AdminContext::isSuper()) {
            $all = SysSite::query()->get(['id', 'parent_id'])->toArray();
            $visible = array_merge([AdminContext::siteId()], TreeHelper::childrenIds($all, AdminContext::siteId()));
            $query->whereIn('id', $visible);
        }
        if (($siteName = $this->strInput('siteName')) !== '') {
            $query->where('site_name', 'like', "%{$siteName}%");
        }
        if (($siteType = $this->intInput('siteType')) > 0) {
            $query->where('site_type', $siteType);
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('status', $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderBy('sort')->orderBy('id')->forPage($page, $pageSize)->get()->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('config:site:add')]
    public function create(): array
    {
        $site = new SysSite();
        $site->parent_id = $this->intInput('parentId');
        if ($site->parent_id > 0 && ! SysSite::query()->whereKey($site->parent_id)->exists()) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '上级站点不存在');
        }
        $site->site_name = $this->requireStr('siteName');
        $this->fill($site);
        $site->save();
        return Result::success(['id' => (int) $site->id], '站点创建成功');
    }

    #[Permission('config:site:edit')]
    public function update(): array
    {
        $site = $this->findScoped($this->requireId());
        $site->site_name = $this->strInput('siteName', (string) $site->site_name);
        $parentId = $this->intInput('parentId', (int) $site->parent_id);
        if ($parentId !== (int) $site->parent_id) {
            if ($parentId === (int) $site->id) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '上级站点不能是自身');
            }
            $all = SysSite::query()->get(['id', 'parent_id'])->toArray();
            if (in_array($parentId, TreeHelper::childrenIds($all, (int) $site->id), true)) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '上级站点不能是自身下级');
            }
            $site->parent_id = $parentId;
        }
        $this->fill($site);
        $site->save();
        return Result::success(null, '站点更新成功');
    }

    #[Permission('config:site:delete')]
    public function delete(): array
    {
        $site = $this->findScoped($this->requireId());
        if (SysSite::query()->where('parent_id', $site->id)->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '存在下级站点,请先删除下级');
        }
        $adminCount = SysAdmin::query()->where('site_id', $site->id)->count();
        if ($adminCount > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "站点下仍有 {$adminCount} 个管理员账号,禁止删除");
        }
        $site->delete();
        return Result::success(null, '站点已删除');
    }

    #[Permission('config:site:status')]
    public function toggleStatus(): array
    {
        $site = $this->findScoped($this->requireId());
        $site->status = $site->status === 1 ? 2 : 1;
        $site->save();
        return Result::success(['status' => $site->status], $site->status === 1 ? '已启用' : '已停用');
    }

    /** 站点差异化配置列表 */
    public function configs(): array
    {
        $site = $this->findScoped($this->requireId('siteId'));
        $rows = SysSiteConfig::query()->where('site_id', $site->id)
            ->orderBy('config_group')->orderBy('id')->get()->toArray();
        $grouped = [];
        foreach ($rows as $row) {
            $grouped[$row['config_group']][] = $row;
        }
        return Result::success($grouped);
    }

    /** 批量保存站点差异化配置:configs = [{group, key, value, name}, ...] */
    #[Permission('config:site:edit')]
    public function saveConfigs(): array
    {
        $site = $this->findScoped($this->requireId('siteId'));
        $configs = $this->input('configs');
        if (! is_array($configs) || $configs === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 configs 不能为空');
        }
        $saved = 0;
        foreach ($configs as $item) {
            $key = trim((string) ($item['key'] ?? ''));
            if ($key === '') {
                continue;
            }
            /** @var SysSiteConfig $config */
            $config = SysSiteConfig::query()->where('site_id', $site->id)->where('config_key', $key)->first()
                ?? new SysSiteConfig(['site_id' => (int) $site->id, 'config_key' => $key]);
            $config->config_group = (string) ($item['group'] ?? ($config->config_group ?: 'local'));
            $config->config_value = (string) ($item['value'] ?? '');
            if (($name = trim((string) ($item['name'] ?? ''))) !== '') {
                $config->config_name = $name;
            }
            $config->save();
            ++$saved;
        }
        return Result::success(['saved' => $saved], '站点配置保存成功');
    }

    private function fill(SysSite $site): void
    {
        $siteType = $this->intInput('siteType', (int) ($site->site_type ?? 3));
        $site->site_type = in_array($siteType, [1, 2, 3], true) ? $siteType : 3;
        $site->site_domain = $this->strInput('siteDomain', (string) $site->site_domain);
        $site->country_code = strtoupper($this->strInput('countryCode', (string) $site->country_code));
        $site->timezone = $this->strInput('timezone', (string) ($site->timezone ?? 'UTC'));
        $site->currency = strtoupper($this->strInput('currency', (string) ($site->currency ?? 'EUR')));
        $site->language = $this->strInput('language', (string) ($site->language ?? 'en-US'));
        $site->contact_name = $this->strInput('contactName', (string) $site->contact_name);
        $site->contact_email = $this->strInput('contactEmail', (string) $site->contact_email);
        $site->sort = $this->intInput('sort', (int) $site->sort);
        $site->remark = $this->strInput('remark', (string) $site->remark);
    }

    private function findScoped(int $id): SysSite
    {
        /** @var SysSite|null $site */
        $site = SysSite::query()->find($id);
        if ($site === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '站点不存在');
        }
        if (! AdminContext::isSuper()) {
            $all = SysSite::query()->get(['id', 'parent_id'])->toArray();
            $visible = array_merge([AdminContext::siteId()], TreeHelper::childrenIds($all, AdminContext::siteId()));
            if (! in_array((int) $site->id, $visible, true)) {
                throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
            }
        }
        return $site;
    }

    /** 过滤出自身站点及全部下级行 */
    private function scopeSubtree(array $rows, int $siteId): array
    {
        $visible = array_merge([$siteId], TreeHelper::childrenIds($rows, $siteId));
        return array_values(array_filter($rows, static fn (array $row) => in_array((int) $row['id'], $visible, true)));
    }

    /** 子树根节点的 parent_id(用于从自身站点起构树) */
    private function rootParentId(array $rows): int
    {
        foreach ($rows as $row) {
            if ((int) $row['id'] === AdminContext::siteId()) {
                return (int) $row['parent_id'];
            }
        }
        return 0;
    }
}
