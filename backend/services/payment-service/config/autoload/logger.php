<?php

declare(strict_types=1);

use Monolog\Formatter\LineFormatter;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Level;

return [
    'default' => [
        'handler' => [
            'class' => RotatingFileHandler::class,
            'constructor' => [
                'filename' => BASE_PATH . '/runtime/logs/hyperf.log',
                'maxFiles' => 14,
                'level' => Level::Info,
            ],
        ],
        'formatter' => [
            'class' => LineFormatter::class,
            'constructor' => [
                'format' => null,
                'dateFormat' => 'Y-m-d H:i:s',
                'allowInlineLineBreaks' => true,
            ],
        ],
    ],
];
