<?php

declare(strict_types=1);

use function Hyperf\Support\env;

return [
    'base_url' => env('MTRIP_GUIDE_HUB_URL', 'https://guide-hub-production-m6ybjs.laravel.cloud/api'),
    'app_id' => env('MTRIP_GUIDE_HUB_APP_ID', ''),
    'app_secret' => env('MTRIP_GUIDE_HUB_APP_SECRET', ''),
    'merchant_app_slug' => env('MTRIP_GUIDE_HUB_MERCHANT_SLUG', ''),
];
