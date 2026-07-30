<?php

declare(strict_types=1);

namespace App\Support;

/**
 * 商家端菜单树构建助手(仿 system-service TreeHelper)
 */
class MenuTreeHelper
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
}
