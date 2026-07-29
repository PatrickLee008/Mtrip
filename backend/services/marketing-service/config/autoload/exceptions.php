<?php

declare(strict_types=1);

use Mtrip\Shared\Exception\Handler\AppExceptionHandler;

return [
    'handler' => [
        'http' => [
            Hyperf\HttpServer\Exception\Handler\HttpExceptionHandler::class,
            AppExceptionHandler::class,
        ],
    ],
];
