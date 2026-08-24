<?php

declare(strict_types=1);

use function Hyperf\Support\env;

/**
 * 文件存储(本地):KYC 等上传文件落盘配置
 * - upload_root:容器内上传根目录,由 compose 共享卷挂载,网关以 /uploads/* 静态访问
 * - url_prefix:对外访问前缀(网关静态路由,不含具体文件路径)
 */
return [
    'upload_root' => env('UPLOAD_ROOT', '/opt/www/uploads'),
    'url_prefix' => '/uploads',
];
