<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 管理端筛选/排序项配置(PRD 模块3):后台可配 C 端筛选面板与排序菜单
 * 键受后端白名单约束(与 GoodsController::applyFilters/applySort 落地键一致)
 */
class AdminFilterController extends AbstractAdminController
{
    private const FILTER_KEYS = ['price', 'star', 'amenity', 'breakfast', 'free_cancel', 'review_score'];
    private const SORT_KEYS = ['default', 'price_asc', 'price_desc', 'star', 'rating', 'distance', 'sales'];

    // ---------- 筛选项 ----------
    public function filterList(): array
    {
        $query = Db::table('goods_filter_config')->whereNull('deleted_at');
        $this->applySiteScope($query);
        $list = $query->orderBy('sort')->orderBy('id')->get()
            ->map(static function ($row) {
                $row = (array) $row;
                $row['options'] = $row['options'] ? json_decode((string) $row['options'], true) : [];
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::success($list);
    }

    #[Permission('goods:filter:save')]
    public function filterSave(): array
    {
        $key = $this->requireStr('filterKey');
        if (! in_array($key, self::FILTER_KEYS, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '筛选键不在支持范围');
        }
        $options = $this->input('options');
        $data = [
            'filter_key' => $key,
            'filter_name' => mb_substr($this->requireStr('filterName'), 0, 100),
            'filter_name_en' => mb_substr($this->strInput('filterNameEn'), 0, 100),
            'filter_type' => in_array($this->intInput('filterType', 2), [1, 2, 3], true) ? $this->intInput('filterType', 2) : 2,
            'options' => is_array($options) ? json_encode($options, JSON_UNESCAPED_UNICODE) : null,
            'sort' => $this->intInput('sort'),
            'status' => $this->intInput('status', 1) === 2 ? 2 : 1,
        ];
        return $this->upsert('goods_filter_config', $data);
    }

    #[Permission('goods:filter:delete')]
    public function filterDelete(): array
    {
        return $this->softDelete('goods_filter_config');
    }

    // ---------- 排序项 ----------
    public function sortList(): array
    {
        $query = Db::table('goods_sort_config')->whereNull('deleted_at');
        $this->applySiteScope($query);
        $list = $query->orderBy('sort')->orderBy('id')->get()
            ->map(static function ($row) {
                $row = (array) $row;
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::success($list);
    }

    #[Permission('goods:filter:save')]
    public function sortSave(): array
    {
        $key = $this->requireStr('sortKey');
        if (! in_array($key, self::SORT_KEYS, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '排序键不在支持范围');
        }
        $data = [
            'sort_key' => $key,
            'sort_name' => mb_substr($this->requireStr('sortName'), 0, 100),
            'sort_name_en' => mb_substr($this->strInput('sortNameEn'), 0, 100),
            'sort' => $this->intInput('sort'),
            'status' => $this->intInput('status', 1) === 2 ? 2 : 1,
        ];
        return $this->upsert('goods_sort_config', $data);
    }

    #[Permission('goods:filter:delete')]
    public function sortDelete(): array
    {
        return $this->softDelete('goods_sort_config');
    }

    /** 通用 upsert(按 id 更新或新增,新增落当前管理员站点) */
    private function upsert(string $table, array $data): array
    {
        $id = $this->intInput('id');
        if ($id > 0) {
            $row = Db::table($table)->where('id', $id)->whereNull('deleted_at')->first(['site_id']);
            if (! $row) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '配置不存在');
            }
            $this->assertSiteScope((int) $row->site_id);
            Db::table($table)->where('id', $id)->update($data);
            return Result::success(['id' => $id], '已保存');
        }
        $data['site_id'] = AdminContext::siteId();
        $newId = (int) Db::table($table)->insertGetId($data);
        return Result::success(['id' => $newId], '已保存');
    }

    /** 通用软删 */
    private function softDelete(string $table): array
    {
        $id = $this->requireId();
        $row = Db::table($table)->where('id', $id)->whereNull('deleted_at')->first(['site_id']);
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '配置不存在');
        }
        $this->assertSiteScope((int) $row->site_id);
        Db::table($table)->where('id', $id)->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }
}
