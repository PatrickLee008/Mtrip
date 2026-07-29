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
 * 商品分类管理:树形列表 / 保存(带 id 编辑,不带新增) / 删除
 * 两级分类,parent_id=0 为根;删除须无子分类且无关联商品
 */
class AdminCategoryController extends AbstractAdminController
{
    /** 分类树:按类型筛选,children 嵌套(两级) */
    public function index(): array
    {
        $query = Db::table('goods_category')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($type = $this->intInput('goodsType')) > 0) {
            $query->where('goods_type', $type);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $rows = $query->orderBy('sort')->orderBy('id')->get()
            ->map(static function ($row) {
                $row = (array) $row;
                unset($row['deleted_at']);
                return $row;
            })->all();

        $tree = [];
        $children = [];
        foreach ($rows as $row) {
            if ((int) $row['parent_id'] === 0) {
                $tree[$row['id']] = $row + ['children' => []];
            } else {
                $children[] = $row;
            }
        }
        foreach ($children as $row) {
            if (isset($tree[$row['parent_id']])) {
                $tree[$row['parent_id']]['children'][] = $row;
            } else {
                $tree[$row['id']] = $row + ['children' => []];
            }
        }
        return Result::success(array_values($tree));
    }

    /** 保存分类:带 id 编辑,不带 id 新增;父分类须同站点同类型且为根 */
    #[Permission(['goods:category:add', 'goods:category:edit'])]
    public function save(): array
    {
        $id = $this->intInput('id');
        $data = [
            'category_name' => $this->requireStr('categoryName'),
            'icon' => $this->strInput('icon'),
            'sort' => $this->intInput('sort'),
            'status' => $this->intInput('status', 1) === 2 ? 2 : 1,
        ];

        if ($id > 0) {
            $category = $this->findScoped($id);
            if ($this->input('parentId') !== null) {
                $parentId = $this->intInput('parentId');
                if ($parentId === (int) $category['id']) {
                    throw new BusinessException(ErrorCode::PARAM_ERROR, '父分类不能是自身');
                }
                $data['parent_id'] = $this->validParent($parentId, (int) $category['site_id'], (int) $category['goods_type']);
            }
            Db::table('goods_category')->where('id', $category['id'])->update($data);
            return Result::success(['id' => (int) $category['id']], '分类已更新');
        }

        $goodsType = $this->intInput('goodsType', 1);
        if (! in_array($goodsType, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 goodsType 不正确');
        }
        $siteId = AdminContext::isSuper() ? $this->requireId('siteId') : AdminContext::siteId();
        $data['site_id'] = $siteId;
        $data['goods_type'] = $goodsType;
        $data['parent_id'] = $this->validParent($this->intInput('parentId'), $siteId, $goodsType);
        $newId = (int) Db::table('goods_category')->insertGetId($data);
        return Result::success(['id' => $newId], '分类已创建');
    }

    /** 删除分类(软删):须无子分类且无关联商品 */
    #[Permission('goods:category:delete')]
    public function remove(): array
    {
        $category = $this->findScoped($this->requireId());
        $childCount = Db::table('goods_category')
            ->where('parent_id', $category['id'])->whereNull('deleted_at')->count();
        if ($childCount > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "存在 {$childCount} 个子分类,禁止删除");
        }
        $goodsCount = Db::table('goods_info')
            ->where('category_id', $category['id'])->where('status', '<>', 5)
            ->whereNull('deleted_at')->count();
        if ($goodsCount > 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, "存在 {$goodsCount} 个关联商品,禁止删除");
        }
        Db::table('goods_category')->where('id', $category['id'])
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '分类已删除');
    }

    /** 取分类并校验站点数据权限 */
    private function findScoped(int $id): array
    {
        $category = Db::table('goods_category')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $category) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '分类不存在');
        }
        $category = (array) $category;
        $this->assertSiteScope((int) $category['site_id']);
        return $category;
    }

    /** 校验父分类:0=根;否则须同站点同类型且自身为根(仅两级) */
    private function validParent(int $parentId, int $siteId, int $goodsType): int
    {
        if ($parentId <= 0) {
            return 0;
        }
        $parent = Db::table('goods_category')
            ->where('id', $parentId)->whereNull('deleted_at')->first();
        if (! $parent) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '父分类不存在');
        }
        $parent = (array) $parent;
        if ((int) $parent['site_id'] !== $siteId || (int) $parent['goods_type'] !== $goodsType) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '父分类须为同站点同类型分类');
        }
        if ((int) $parent['parent_id'] !== 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '分类最多支持两级');
        }
        return $parentId;
    }
}
