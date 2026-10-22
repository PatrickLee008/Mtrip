<?php

declare(strict_types=1);

use App\Service\FacebookClient;
use App\Service\FacebookLoginService;
use App\Service\UserAuthService;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\RedisLock;

require_once __DIR__ . '/../../../services/user-service/app/Service/UserAuthService.php';
require_once __DIR__ . '/../../../services/user-service/app/Service/FacebookLoginService.php';

final class FacebookLoginTestConfig implements Hyperf\Contract\ConfigInterface
{
    public function __construct(private array $overrides)
    {
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return array_replace([
            'facebook.enabled' => true, 'facebook.app_id' => '123', 'facebook.app_secret' => 'test-only',
            'facebook.web_origins' => ['https://web.example'], 'facebook.consent_version' => 'test-version',
            'facebook.terms_url' => 'https://web.example/terms', 'facebook.privacy_url' => 'https://web.example/privacy',
        ], $this->overrides)[$key] ?? $default;
    }
}

function facebookLoginForSettings(array $overrides = []): FacebookLoginService
{
    $config = new FacebookLoginTestConfig($overrides);
    $redis = new Redis();
    return new FacebookLoginService($config, $redis, new FacebookClient($config), new UserAuthService($config, new RedisLock($redis)));
}

foreach ([
    'disabled' => ['facebook.enabled' => false], 'missing secret' => ['facebook.app_secret' => ''],
    'missing app' => ['facebook.app_id' => ''], 'missing privacy' => ['facebook.privacy_url' => ''],
    'missing terms' => ['facebook.terms_url' => ''], 'insecure policy' => ['facebook.privacy_url' => 'http://web.example/privacy'],
] as $label => $overrides) {
    MiniTest::add('Facebook settings: fails closed when ' . $label, static function () use ($overrides): void {
        MiniTest::assertThrows(BusinessException::class, static fn () => facebookLoginForSettings($overrides)->settings('https://web.example'));
    });
}

MiniTest::add('Facebook settings: returns only public policies and consent', static function (): void {
    MiniTest::assertSame([
        'termsUrl' => 'https://web.example/terms', 'privacyUrl' => 'https://web.example/privacy', 'consentVersion' => 'test-version',
    ], facebookLoginForSettings()->settings('https://web.example'));
});
