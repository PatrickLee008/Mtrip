<?php

declare(strict_types=1);

use App\Service\MerchantStatusService;
use Hyperf\Crontab\Crontab;

return [
    'enable' => true,
    'crontab' => [
        (new Crontab())->setName('merchant-impersonation-expiry')->setRule('* * * * *')
            ->setCallback([\App\Service\MerchantImpersonationService::class, 'expire']),
        (new Crontab())->setName('merchant-document-expiry')->setRule('* * * * *')
            ->setCallback([\App\Service\MerchantDocumentService::class, 'expireDue']),
        (new Crontab())->setName('merchant-notification-due')->setRule('* * * * *')
            ->setCallback([\App\Service\MerchantNotificationService::class, 'deliverDue']),
        (new Crontab())->setName('merchant-suspension-expiry')->setRule('* * * * *')
            ->setCallback([MerchantStatusService::class, 'expireDue']),
    ],
];
