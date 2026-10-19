<?php

declare(strict_types=1);

use Hyperf\Server\Event;
use Hyperf\Server\Server;

use function Hyperf\Support\env;

return [
    'mode' => SWOOLE_PROCESS,
    'servers' => [
        [
            'name' => 'http',
            'type' => Server::SERVER_WEBSOCKET,
            'host' => '0.0.0.0',
            'port' => (int) env('HTTP_PORT', 9502),
            'sock_type' => SWOOLE_SOCK_TCP,
            'callbacks' => [
                Event::ON_REQUEST => [Hyperf\HttpServer\Server::class, 'onRequest'],
                Event::ON_OPEN => [App\Chat\ChatSocket::class, 'onOpen'],
                Event::ON_MESSAGE => [App\Chat\ChatSocket::class, 'onMessage'],
                Event::ON_CLOSE => [App\Chat\ChatSocket::class, 'onClose'],
            ],
            'options' => [
                'enable_request_lifecycle' => false,
            ],
        ],
    ],
    'settings' => [
        'enable_coroutine' => true,
        'worker_num' => (int) env('WORKER_NUM', 2),
        'pid_file' => BASE_PATH . '/runtime/hyperf.pid',
        'open_tcp_nodelay' => true,
        'max_coroutine' => 100000,
        'open_http2_protocol' => false,
        // 处理 N 个请求后平滑重建 worker,防常驻内存泄漏 OOM(避坑规范 三.1)
        'max_request' => (int) env('MAX_REQUEST', 10000),
        'max_request_grace' => 200,
        'socket_buffer_size' => 2 * 1024 * 1024,
        // 评价视频上传(ReviewMediaController 单个视频最大 50MB),默认 2MB 会被 Swoole 直接 413
        'package_max_length' => 60 * 1024 * 1024,
        'buffer_output_size' => 2 * 1024 * 1024,
    ],
    'callbacks' => [
        Event::ON_WORKER_START => [Hyperf\Framework\Bootstrap\WorkerStartCallback::class, 'onWorkerStart'],
        Event::ON_PIPE_MESSAGE => [Hyperf\Framework\Bootstrap\PipeMessageCallback::class, 'onPipeMessage'],
        Event::ON_WORKER_EXIT => [Hyperf\Framework\Bootstrap\WorkerExitCallback::class, 'onWorkerExit'],
    ],
];
