<?php

declare(strict_types=1);

use App\Service\TikTokClient;
use Mtrip\Shared\Exception\BusinessException;

require_once __DIR__ . '/../../../services/user-service/app/Service/TikTokClient.php';

final class TikTokTestConfig implements Hyperf\Contract\ConfigInterface
{
    public function get(string $key, mixed $default = null): mixed
    {
        return ['tiktok.client_key' => 'test_client-key', 'tiktok.client_secret' => 'test-secret'][$key] ?? $default;
    }
}

final class TikTokTestClient extends TikTokClient
{
    public array $calls = [];

    public function __construct(private array $responses)
    {
        parent::__construct(new TikTokTestConfig());
    }

    protected function request(string $path, array $parameters, string $bearer = '', bool $post = false): array
    {
        $this->calls[] = compact('path', 'parameters', 'bearer', 'post');
        return array_shift($this->responses);
    }
}

function tiktokResponses(array $token = [], array $user = [], string $error = 'ok'): array
{
    return [
        array_replace(['access_token' => 'test-access', 'open_id' => 'open.user_123-abc',
            'token_type' => 'Bearer', 'expires_in' => 86400, 'scope' => 'user.info.basic'], $token),
        ['data' => ['user' => array_replace(['open_id' => 'open.user_123-abc', 'display_name' => 'Example'], $user)],
            'error' => ['code' => $error]],
    ];
}

MiniTest::add('TikTok: confidential Web authorization uses client_key and minimal scope', static function (): void {
    $url = (new TikTokTestClient([]))->authorizationUrl('https://web.example/api/v1/auth/tiktok/callback', 'random-state');
    MiniTest::assertSame('www.tiktok.com', parse_url($url, PHP_URL_HOST));
    MiniTest::assertSame('/v2/auth/authorize/', parse_url($url, PHP_URL_PATH));
    parse_str(parse_url($url, PHP_URL_QUERY), $params);
    MiniTest::assertSame('test_client-key', $params['client_key']);
    MiniTest::assertSame('code', $params['response_type']);
    MiniTest::assertSame('random-state', $params['state']);
    MiniTest::assertSame('user.info.basic', $params['scope']);
    MiniTest::assertSame('https://web.example/api/v1/auth/tiktok/callback', $params['redirect_uri']);
    MiniTest::assertTrue(! isset($params['client_secret']));
});

MiniTest::add('TikTok: exchanges code on server and matches opaque open_id with user info', static function (): void {
    $client = new TikTokTestClient(tiktokResponses());
    MiniTest::assertSame(['id' => 'open.user_123-abc', 'name' => 'Example'], $client->identity('auth-code', 'https://web.example/callback'));
    MiniTest::assertSame('/v2/oauth/token/', $client->calls[0]['path']);
    MiniTest::assertSame(true, $client->calls[0]['post']);
    MiniTest::assertSame('authorization_code', $client->calls[0]['parameters']['grant_type']);
    MiniTest::assertSame('test-secret', $client->calls[0]['parameters']['client_secret']);
    MiniTest::assertSame('https://web.example/callback', $client->calls[0]['parameters']['redirect_uri']);
    MiniTest::assertSame('/v2/user/info/', $client->calls[1]['path']);
    MiniTest::assertSame('open_id,display_name', $client->calls[1]['parameters']['fields']);
    MiniTest::assertSame('test-access', $client->calls[1]['bearer']);
});

foreach ([
    'missing access token' => ['access_token' => ''], 'missing identity' => ['open_id' => ''],
    'invalid identity' => ['open_id' => '../bad'], 'expired token' => ['expires_in' => 0],
    'missing expiry' => ['expires_in' => null], 'missing scope' => ['scope' => ''],
    'wrong token type' => ['token_type' => 'Basic'],
] as $label => $token) {
    MiniTest::add('TikTok: rejects ' . $label, static function () use ($token): void {
        $client = new TikTokTestClient(tiktokResponses($token));
        MiniTest::assertThrows(BusinessException::class, static fn () => $client->identity('code', 'https://web.example/callback'));
        MiniTest::assertSame(1, count($client->calls));
    });
}

MiniTest::add('TikTok: rejects token/profile mismatch and failed user-info response', static function (): void {
    foreach ([tiktokResponses([], ['open_id' => 'other']), tiktokResponses([], [], 'access_token_invalid')] as $responses) {
        MiniTest::assertThrows(BusinessException::class, static fn () => (new TikTokTestClient($responses))->identity('code', 'https://web.example/callback'));
    }
});

MiniTest::add('TikTok: missing display name does not fabricate contact details', static function (): void {
    MiniTest::assertSame(['id' => 'open.user_123-abc', 'name' => ''], (new TikTokTestClient(tiktokResponses([], ['display_name' => ''])))->identity('code', 'https://web.example/callback'));
});
