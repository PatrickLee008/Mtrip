<?php

declare(strict_types=1);

namespace Mtrip\Shared\Annotation;

use Attribute;
use Hyperf\Di\Annotation\AbstractAnnotation;

/**
 * 接口权限注解:标注在控制器方法上,声明所需按钮/接口权限标识(与菜单种子 perm_key 一致)
 * 用法:#[Permission('sys:admin:add')];多键任一匹配:#[Permission(['goods:hotel:add', 'goods:ticket:add'])]
 */
#[Attribute(Attribute::TARGET_METHOD)]
class Permission extends AbstractAnnotation
{
    public function __construct(public string|array $value = '')
    {
    }

    /** 归一化为权限键数组(过滤空值) */
    public function keys(): array
    {
        $keys = is_array($this->value) ? $this->value : [$this->value];
        return array_values(array_filter($keys, static fn ($key) => $key !== ''));
    }
}
