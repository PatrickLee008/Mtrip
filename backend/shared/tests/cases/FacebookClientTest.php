<?php

declare(strict_types=1);

use App\Service\FacebookClient;
use Mtrip\Shared\Exception\BusinessException;

require_once __DIR__ . '/../../../services/user-service/app/Service/FacebookClient.php';

final class FacebookTestConfig implements Hyperf\Contract\ConfigInterface
{
    public function get(string $key, mixed $default = null): mixed
    {
        return ['facebook.app_id' => '123', 'facebook.app_secret' => 'test-secret', 'facebook.graph_version' => 'v24.0'][$key] ?? $default;
    }
}

final class FacebookTestClient extends FacebookClient
{
    public array $calls = [];

    public function __construct(private array $responses)
    {
        parent::__construct(new FacebookTestConfig());
    }

    protected function request(string $path, array $parameters, string $bearer = '', bool $post = false): array
    {
        $this->calls[] = compact('path', 'parameters', 'bearer', 'post');
        return array_shift($this->responses);
    }
}

function facebookResponses(array $debug = [], array $profile = []): array
{
    return [
        ['access_token' => 'test-access-token'],
        ['data' => array_replace([
            'is_valid' => true, 'app_id' => '123', 'user_id' => '456', 'expires_at' => time() + 3600,
            'data_access_expires_at' => time() + 86400, 'scopes' => ['public_profile'],
        ], $debug)],
        array_replace(['id' => '456', 'name' => 'Example'], $profile),
    ];
}

MiniTest::add('Facebook: authorization code URL has exact callback, state and minimal scope', static function (): void {
    $url = (new FacebookTestClient([]))->authorizationUrl('https://web.example/api/v1/auth/facebook/callback', 'random-state');
    MiniTest::assertSame('www.facebook.com', parse_url($url, PHP_URL_HOST));
    parse_str(parse_url($url, PHP_URL_QUERY), $params);
    MiniTest::assertSame('code', $params['response_type']);
    MiniTest::assertSame('random-state', $params['state']);
    MiniTest::assertSame('public_profile', $params['scope']);
    MiniTest::assertSame('https://web.example/api/v1/auth/facebook/callback', $params['redirect_uri']);
    MiniTest::assertTrue(! isset($params['client_secret']));
});

MiniTest::add('Facebook: validates token ownership and profile, returns no credentials or email', static function (): void {
    $client = new FacebookTestClient(facebookResponses());
    MiniTest::assertSame(['id' => '456', 'name' => 'Example'], $client->identity('auth-code', 'https://web.example/callback'));
    MiniTest::assertSame(true, $client->calls[0]['post']);
    MiniTest::assertSame('https://web.example/callback', $client->calls[0]['parameters']['redirect_uri']);
    MiniTest::assertSame('123|test-secret', $client->calls[1]['bearer']);
    MiniTest::assertSame(hash_hmac('sha256', 'test-access-token', 'test-secret'), $client->calls[2]['parameters']['appsecret_proof']);
});

foreach ([
    'invalid token' => ['is_valid' => false], 'wrong app' => ['app_id' => 'other'],
    'expired token' => ['expires_at' => time() - 10], 'missing expiry' => ['expires_at' => 0],
    'expired data access' => ['data_access_expires_at' => time() - 10],
    'invalid subject' => ['user_id' => '../456'], 'missing permission' => ['scopes' => []],
] as $label => $debug) {
    MiniTest::add('Facebook: rejects ' . $label, static function () use ($debug): void {
        $client = new FacebookTestClient(facebookResponses($debug));
        MiniTest::assertThrows(BusinessException::class, static fn () => $client->identity('code', 'https://web.example/callback'));
        MiniTest::assertSame(2, count($client->calls));
    });
}

MiniTest::add('Facebook: rejects mismatched profile identity', static function (): void {
    $client = new FacebookTestClient(facebookResponses([], ['id' => '789']));
    MiniTest::assertThrows(BusinessException::class, static fn () => $client->identity('code', 'https://web.example/callback'));
});

MiniTest::add('Facebook: missing email and missing name do not block a verified identity', static function (): void {
    $client = new FacebookTestClient(facebookResponses([], ['name' => '']));
    MiniTest::assertSame(['id' => '456', 'name' => ''], $client->identity('code', 'https://web.example/callback'));
});

MiniTest::add('Facebook: rejects code response without an access token', static function (): void {
    $client = new FacebookTestClient([[]]);
    MiniTest::assertThrows(BusinessException::class, static fn () => $client->identity('code', 'https://web.example/callback'));
});
