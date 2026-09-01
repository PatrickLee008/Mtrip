<?php
// 检查 Hyperf 运行时缓存:切面收集与 PermissionAspect 类元数据
$aspects = @file_get_contents('/opt/www/runtime/container/aspects.cache');
echo '== aspects.cache == (' . strlen((string) $aspects) . " bytes)\n";
echo substr((string) $aspects, 0, 2000) . "\n\n";

$classes = (string) @file_get_contents('/opt/www/runtime/container/classes.cache');
echo '== PermissionAspect in classes.cache == ';
$pos = strpos($classes, 'PermissionAspect');
echo $pos === false ? "NOT FOUND\n" : "found at {$pos}\n";
if ($pos !== false) {
    echo substr($classes, max(0, $pos - 200), 600) . "\n";
}

// 扫描缓存里 BookingController 的方法注解收集情况
$scan = (string) @file_get_contents('/opt/www/runtime/container/scan.cache');
echo "\n== scan.cache size: " . strlen($scan) . " ==\n";
$pos = strpos($scan, 'guestThread');
echo 'guestThread in scan.cache: ' . ($pos === false ? 'NOT FOUND' : "found at {$pos}") . "\n";
if ($pos !== false) {
    echo substr($scan, max(0, $pos - 100), 800) . "\n";
}
