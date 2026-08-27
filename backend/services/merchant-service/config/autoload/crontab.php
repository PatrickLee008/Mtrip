<?php

declare(strict_types=1);

use App\Service\MerchantStatusService;
use Hyperf\Crontab\Crontab;

return [
    'enable' => true,
    'crontab' => [
        (new Crontab())->setName('merchant-suspension-expiry')->setRule('* * * * *')
            ->setCallback([MerchantStatusService::class, 'expireDue']),
    ],
];
