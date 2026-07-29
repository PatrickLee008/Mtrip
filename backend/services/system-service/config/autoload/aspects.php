<?php

declare(strict_types=1);

use Mtrip\Shared\Aspect\PermissionAspect;

return [
    // RBAC 按钮/接口权限切面(拦截 #[Permission] 注解)
    PermissionAspect::class,
];
