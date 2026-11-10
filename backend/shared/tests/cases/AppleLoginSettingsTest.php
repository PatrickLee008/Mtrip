<?php

declare(strict_types=1);

use App\Service\AppleClient;
use App\Service\AppleLoginService;
use App\Service\UserAuthService;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\RedisLock;

require_once __DIR__ . '/../../../services/user-service/app/Service/UserAuthService.php';
require_once __DIR__ . '/../../../services/user-service/app/Service/AppleClient.php';
require_once __DIR__ . '/../../../services/user-service/app/Service/AppleLoginService.php';

final class AppleLoginTestConfig implements Hyperf\Contract\ConfigInterface
{
    public function __construct(private array $overrides)
    {
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return array_replace([
            'apple.enabled' => true, 'apple.client_id' => 'com.mtrip.test.web', 'apple.team_id' => 'TESTTEAM01',
            'apple.key_id' => 'TESTKEY001', 'apple.private_key_path' => __FILE__,
            'apple.web_origins' => ['https://web.example'], 'apple.consent_version' => 'test-version',
            'apple.terms_url' => 'https://web.example/terms', 'apple.privacy_url' => 'https://web.example/privacy',
        ], $this->overrides)[$key] ?? $default;
    }
}

function appleLoginForSettings(array $overrides = []): AppleLoginService
{
    $config = new AppleLoginTestConfig($overrides);
    $redis = new Redis();
    return new AppleLoginService($config, $redis, new AppleClient($config), new UserAuthService($config, new RedisLock($redis)));
}

foreach ([
    'disabled' => ['apple.enabled' => false], 'missing key' => ['apple.private_key_path' => '/no-such-apple-key'],
    'invalid team' => ['apple.team_id' => 'bad'], 'invalid key id' => ['apple.key_id' => 'bad'],
    'missing app' => ['apple.client_id' => ''], 'missing privacy' => ['apple.privacy_url' => ''],
    'missing terms' => ['apple.terms_url' => ''], 'insecure policy' => ['apple.privacy_url' => 'http://web.example/privacy'],
    'missing consent version' => ['apple.consent_version' => ''],
] as $label => $overrides) {
    MiniTest::add('Apple settings: fails closed when ' . $label, static function () use ($overrides): void {
        MiniTest::assertThrows(BusinessException::class, static fn () => appleLoginForSettings($overrides)->settings('https://web.example'));
    });
}

MiniTest::add('Apple settings: returns only public policies and consent', static function (): void {
    MiniTest::assertSame([
        'termsUrl' => 'https://web.example/terms', 'privacyUrl' => 'https://web.example/privacy', 'consentVersion' => 'test-version',
    ], appleLoginForSettings()->settings('https://web.example'));
});
