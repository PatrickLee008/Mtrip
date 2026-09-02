<?php
// 清理 Hyperf 代理类/注解扫描缓存(新增注解方法未生效时使用),等价于重建 runtime/container
$root = '/opt/www/runtime/container';
$it = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
    RecursiveIteratorIterator::CHILD_FIRST
);
$n = 0;
foreach ($it as $f) {
    $f->isDir() ? rmdir($f->getPathname()) : unlink($f->getPathname());
    ++$n;
}
echo "removed {$n} entries\n";
