<?php

declare(strict_types=1);

use function Hyperf\Support\env;

return [
    'enabled' => (bool) env('MTRIP_APPLE_ENABLED', false),
    'client_id' => (string) env('MTRIP_APPLE_CLIENT_ID', 'com.mtrip.clientapp.web'),
    'team_id' => (string) env('MTRIP_APPLE_TEAM_ID', '64VH8HZJ2Q'),
    'key_id' => (string) env('MTRIP_APPLE_KEY_ID', '87P2XFHN9U'),
    'private_key_path' => (string) env('MTRIP_APPLE_PRIVATE_KEY_PATH', '/run/secrets/apple/AuthKey.p8'),
    'web_origins' => array_filter(array_map('trim', explode(',', (string) env('MTRIP_APPLE_WEB_ORIGINS', '')))),
    'terms_url' => (string) env('MTRIP_APPLE_TERMS_URL', ''),
    'privacy_url' => (string) env('MTRIP_APPLE_PRIVACY_URL', ''),
    'consent_version' => (string) env('MTRIP_APPLE_CONSENT_VERSION', '2026-11-10'),
];
