<?php

declare(strict_types=1);

namespace Mtrip\Shared\Aspect;

use Hyperf\Di\Annotation\Aspect;
use Hyperf\Di\Aop\AbstractAspect;
use Hyperf\Di\Aop\ProceedingJoinPoint;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;

/**
 * RBAC 权限切面:拦截标注 #[Permission] 的方法,校验当前管理员权限标识(多键任一匹配)
 * 双重校验第一层(角色菜单/按钮权限),第二层站点隔离由 BaseModel/AdminContext 完成
 * 注意:必须带 #[Aspect] 注解才会被 Hyperf AspectCollector 收集并织入代理类(缺失时注解静默失效)
 */
#[Aspect]
class PermissionAspect extends AbstractAspect
{
    public array $annotations = [
        Permission::class,
    ];

    public function process(ProceedingJoinPoint $proceedingJoinPoint)
    {
        $metadata = $proceedingJoinPoint->getAnnotationMetadata();
        /** @var Permission|null $annotation */
        $annotation = $metadata->method[Permission::class] ?? null;

        if ($annotation !== null && $annotation->keys() !== []) {
            if (! AdminContext::hasAnyPermission($annotation->keys())) {
                throw new BusinessException(ErrorCode::FORBIDDEN);
            }
        }

        return $proceedingJoinPoint->process();
    }
}
