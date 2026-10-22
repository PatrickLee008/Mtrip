<?php

declare(strict_types=1);

use function Hyperf\Support\env;

return [
    'enabled' => (bool) env('MTRIP_FACEBOOK_ENABLED', false),
    'app_id' => (string) env('MTRIP_FACEBOOK_APP_ID', ''),
    'app_secret' => (string) env('MTRIP_FACEBOOK_APP_SECRET', ''),
    'graph_version' => (string) env('MTRIP_FACEBOOK_GRAPH_VERSION', 'v24.0'),
    'web_origins' => array_filter(array_map('trim', explode(',', (string) env('MTRIP_FACEBOOK_WEB_ORIGINS', '')))),
    'terms_url' => (string) env('MTRIP_FACEBOOK_TERMS_URL', ''),
    'privacy_url' => (string) env('MTRIP_FACEBOOK_PRIVACY_URL', ''),
    'consent_version' => (string) env('MTRIP_FACEBOOK_CONSENT_VERSION', '2026-10-21'),
];
