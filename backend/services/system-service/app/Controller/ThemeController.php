<?php

declare(strict_types=1);

namespace App\Controller;

use App\Model\SysTheme;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * C端动态主题(/api/v1/app/theme/*,无需登录):
 * App 启动/前台切换时拉取当前生效主题;无生效主题回退默认主题(PRD 模块15)
 */
class ThemeController extends AbstractController
{
    /** 当前生效主题:本站或全局(site_id=0),按 status/时段/优先级择一,回退默认 */
    public function active(): array
    {
        $siteId = $this->intInput('siteId');
        if ($siteId <= 0) {
            $siteId = (int) $this->request->getHeaderLine('x-site-id');
        }
        if ($siteId <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '缺少站点标识 X-Site-Id');
        }

        $now = date('Y-m-d H:i:s');
        $active = SysTheme::query()
            ->whereIn('site_id', [$siteId, 0])
            ->where('status', 1)
            ->where(static function ($q) use ($now) {
                $q->whereNull('start_time')->orWhere('start_time', '<=', $now);
            })
            ->where(static function ($q) use ($now) {
                $q->whereNull('end_time')->orWhere('end_time', '>=', $now);
            })
            ->orderByDesc('priority')->orderByDesc('id')
            ->first(['id', 'theme_name', 'thumbnail', 'assets', 'is_default']);

        // 无命中 → 回退默认主题(is_default=1,站点优先全局兜底)
        if ($active === null) {
            $active = SysTheme::query()
                ->whereIn('site_id', [$siteId, 0])
                ->where('is_default', 1)
                ->whereNull('deleted_at')
                ->orderByDesc('site_id')->orderBy('id')
                ->first(['id', 'theme_name', 'thumbnail', 'assets', 'is_default']);
        }
        return Result::success($active?->toArray());
    }

    // ---------- 管理端主题管理(PRD 模块15)----------

    /** 主题列表(站点隔离) */
    #[Permission('config:theme:list')]
    public function adminList(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('app_theme')->whereNull('deleted_at');
        $siteId = AdminContext::scopeSiteId($this->intInput('siteId'));
        if ($siteId !== null && $siteId > 0) {
            $query->where('site_id', $siteId);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('priority')->orderByDesc('id')->forPage($page, $pageSize)
            ->get()->map(static function ($row) {
                $row = (array) $row;
                $row['assets'] = $row['assets'] ? json_decode((string) $row['assets'], true) : [];
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 新增/编辑主题 */
    #[Permission('config:theme:save')]
    public function save(): array
    {
        $assets = $this->input('assets');
        $data = [
            'theme_name' => $this->requireStr('themeName'),
            'description' => mb_substr($this->strInput('description'), 0, 255),
            'thumbnail' => $this->strInput('thumbnail'),
            'assets' => is_array($assets) ? json_encode($assets, JSON_UNESCAPED_UNICODE) : null,
            'is_default' => $this->intInput('isDefault') === 1 ? 1 : 0,
            'priority' => $this->intInput('priority'),
            'start_time' => ($s = $this->strInput('startTime')) !== '' ? $s : null,
            'end_time' => ($e = $this->strInput('endTime')) !== '' ? $e : null,
            'status' => $this->intInput('status', 2) === 1 ? 1 : 2,
        ];
        $id = $this->intInput('id');
        if ($id > 0) {
            $row = Db::table('app_theme')->where('id', $id)->whereNull('deleted_at')->first(['site_id']);
            if (! $row) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '主题不存在');
            }
            $this->assertThemeScope((int) $row->site_id);
            Db::table('app_theme')->where('id', $id)->update($data);
            return Result::success(['id' => $id], '已保存');
        }
        $data['site_id'] = AdminContext::siteId();
        $newId = (int) Db::table('app_theme')->insertGetId($data);
        return Result::success(['id' => $newId], '已保存');
    }

    /** 删除主题(软删) */
    #[Permission('config:theme:delete')]
    public function delete(): array
    {
        $id = $this->requireId();
        $row = Db::table('app_theme')->where('id', $id)->whereNull('deleted_at')->first(['site_id']);
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '主题不存在');
        }
        $this->assertThemeScope((int) $row->site_id);
        Db::table('app_theme')->where('id', $id)->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }

    /** 站点数据权限:非超管仅可操作本站主题 */
    private function assertThemeScope(int $rowSiteId): void
    {
        if (! AdminContext::isSuper() && $rowSiteId !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
    }
}
