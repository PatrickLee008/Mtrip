<?php

declare(strict_types=1);

namespace App\Support;

/**
 * 树形结构构建助手(菜单树 / 站点树)
 */
class TreeHelper
{
    /**
     * 平铺数组转树:按 parent_id 挂 children
     *
     * @param array $items 已按 sort 排序的行数组(须含 id/parent_id)
     */
    public static function build(array $items, int $parentId = 0, string $pidKey = 'parent_id'): array
    {
        $tree = [];
        foreach ($items as $item) {
            if ((int) $item[$pidKey] === $parentId) {
                $children = self::build($items, (int) $item['id'], $pidKey);
                if ($children !== []) {
                    $item['children'] = $children;
                }
                $tree[] = $item;
            }
        }
        return $tree;
    }

    /**
     * 收集指定节点的全部后代 id(删除校验用)
     */
    public static function childrenIds(array $items, int $parentId, string $pidKey = 'parent_id'): array
    {
        $ids = [];
        foreach ($items as $item) {
            if ((int) $item[$pidKey] === $parentId) {
                $ids[] = (int) $item['id'];
                $ids = array_merge($ids, self::childrenIds($items, (int) $item['id'], $pidKey));
            }
        }
        return $ids;
    }
}
