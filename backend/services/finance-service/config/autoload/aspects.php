<?php

declare(strict_types=1);

/**
 * 显式切面注册:不依赖注解扫描收集时序,保证切面恒生效。
 * 背景:共享包 PermissionAspect 在部分服务重启扫描时未进入 aspects.cache,
 * 导致 #[Permission] 注解静默失效;显式注册后由 AspectCollector 直接合并。
 */
return [
    \Mtrip\Shared\Aspect\PermissionAspect::class,
];
