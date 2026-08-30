<?php

declare(strict_types=1);

use function Hyperf\Support\env;

/**
 * 公共文件存储配置。
 * - local:写入共享卷 /opt/www/uploads,由网关 /uploads/* 提供公共访问。
 * - aliyun:阿里云 OSS 配置项,后台存储渠道也支持 driver=aliyun + endpoint。
 */
return [
    'upload_root' => env('UPLOAD_ROOT', '/opt/www/uploads'),
    'url_prefix' => '/uploads',
    'max_upload_size' => 100 * 1024 * 1024,
    'drivers' => [
        'local' => [
            'root' => env('UPLOAD_ROOT', '/opt/www/uploads'),
            'url_prefix' => '/uploads',
        ],
        'aliyun' => [
            'endpoint' => env('ALIYUN_OSS_ENDPOINT', ''),
            'bucket' => env('ALIYUN_OSS_BUCKET', ''),
            'access_key_id' => env('ALIYUN_OSS_ACCESS_KEY_ID', ''),
            'access_key_secret' => env('ALIYUN_OSS_ACCESS_KEY_SECRET', ''),
            'cdn_domain' => env('ALIYUN_OSS_CDN_DOMAIN', ''),
        ],
    ],
];
