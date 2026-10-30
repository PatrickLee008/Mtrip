<?php

declare(strict_types=1);

use App\Service\TikTokClient;
use App\Service\TikTokLoginService;
use App\Service\UserAuthService;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\RedisLock;

require_once __DIR__ . '/../../../services/user-service/app/Service/UserAuthService.php';
require_once __DIR__ . '/../../../services/user-service/app/Service/TikTokClient.php';
require_once __DIR__ . '/../../../services/user-service/app/Service/TikTokLoginService.php';

final class TikTokLoginTestConfig implements Hyperf\Contract\ConfigInterface
{
    public function __construct(private array $overrides)
    {
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return array_replace([
            'tiktok.enabled' => true, 'tiktok.client_key' => 'test_client-key', 'tiktok.client_secret' => 'test-only',
            'tiktok.web_origins' => ['https://web.example'], 'tiktok.consent_version' => 'test-version',
            'tiktok.terms_url' => 'https://web.example/terms', 'tiktok.privacy_url' => 'https://web.example/privacy',
        ], $this->overrides)[$key] ?? $default;
    }
}

function tiktokLoginForSettings(array $overrides = []): TikTokLoginService
{
    $config = new TikTokLoginTestConfig($overrides);
    $redis = new Redis();
    return new TikTokLoginService($config, $redis, new TikTokClient($config), new UserAuthService($config, new RedisLock($redis)));
}

foreach ([
    'disabled' => ['tiktok.enabled' => false], 'missing secret' => ['tiktok.client_secret' => ''],
    'missing app' => ['tiktok.client_key' => ''], 'missing privacy' => ['tiktok.privacy_url' => ''],
    'missing terms' => ['tiktok.terms_url' => ''], 'insecure policy' => ['tiktok.privacy_url' => 'http://web.example/privacy'],
    'missing consent version' => ['tiktok.consent_version' => ''],
] as $label => $overrides) {
    MiniTest::add('TikTok settings: fails closed when ' . $label, static function () use ($overrides): void {
        MiniTest::assertThrows(BusinessException::class, static fn () => tiktokLoginForSettings($overrides)->settings('https://web.example'));
    });
}

MiniTest::add('TikTok settings: returns only public policies and consent', static function (): void {
    MiniTest::assertSame([
        'termsUrl' => 'https://web.example/terms', 'privacyUrl' => 'https://web.example/privacy', 'consentVersion' => 'test-version',
    ], tiktokLoginForSettings()->settings('https://web.example'));
});
