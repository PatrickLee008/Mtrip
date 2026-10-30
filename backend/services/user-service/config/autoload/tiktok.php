<?php

declare(strict_types=1);

use function Hyperf\Support\env;

return [
    'enabled' => (bool) env('MTRIP_TIKTOK_ENABLED', false),
    'client_key' => (string) env('MTRIP_TIKTOK_CLIENT_KEY', ''),
    'client_secret' => (string) env('MTRIP_TIKTOK_CLIENT_SECRET', ''),
    'web_origins' => array_filter(array_map('trim', explode(',', (string) env('MTRIP_TIKTOK_WEB_ORIGINS', '')))),
    'terms_url' => (string) env('MTRIP_TIKTOK_TERMS_URL', ''),
    'privacy_url' => (string) env('MTRIP_TIKTOK_PRIVACY_URL', ''),
    'consent_version' => (string) env('MTRIP_TIKTOK_CONSENT_VERSION', '2026-10-30'),
];
