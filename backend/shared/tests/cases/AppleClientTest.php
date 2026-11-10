<?php

declare(strict_types=1);

use App\Service\AppleClient;
use Mtrip\Shared\Exception\BusinessException;

final class AppleTestConfig implements Hyperf\Contract\ConfigInterface
{
    public function get(string $key, mixed $default = null): mixed
    {
        return ['apple.client_id' => 'com.mtrip.test.web', 'apple.team_id' => 'TESTTEAM01',
            'apple.key_id' => 'TESTKEY001', 'apple.private_key_path' => AppleTestClient::$keyPath][$key] ?? $default;
    }
}

if (is_file(__DIR__ . '/../../../services/user-service/app/Service/AppleClient.php')) {
    require_once __DIR__ . '/../../../services/user-service/app/Service/AppleClient.php';
}

MiniTest::add('Apple: cryptographic client is available', static function (): void {
    MiniTest::assertTrue(class_exists(AppleClient::class));
});

if (! class_exists(AppleClient::class)) {
    return;
}

final class AppleTestClient extends AppleClient
{
    public static string $keyPath = '';
    public array $calls = [];
    public array $responses = [];

    public function __construct()
    {
        parent::__construct(new AppleTestConfig());
    }

    protected function request(string $path, array $parameters = []): array
    {
        $this->calls[] = compact('path', 'parameters');
        return array_shift($this->responses);
    }
}

function appleB64(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function appleFixture(array $claims = [], array $header = []): array
{
    $rsa = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    $details = openssl_pkey_get_details($rsa);
    $input = appleB64(json_encode(array_replace(['alg' => 'RS256', 'kid' => 'test-rsa'], $header))) . '.'
        . appleB64(json_encode(array_replace(['iss' => 'https://appleid.apple.com', 'aud' => 'com.mtrip.test.web',
            'sub' => 'apple.subject.123', 'iat' => time(), 'exp' => time() + 300, 'nonce' => 'test-nonce',
            'email' => 'relay@privaterelay.appleid.com', 'email_verified' => 'true'], $claims)));
    openssl_sign($input, $signature, $rsa, OPENSSL_ALGO_SHA256);
    return [$input . '.' . appleB64($signature), ['keys' => [[
        'kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'kid' => 'test-rsa',
        'n' => appleB64($details['rsa']['n']), 'e' => appleB64($details['rsa']['e']),
    ]]]];
}

MiniTest::add('Apple: authorization binds nonce and uses form_post without secrets', static function (): void {
    $url = (new AppleTestClient())->authorizationUrl('https://web.example/callback', 'state', 'nonce');
    MiniTest::assertSame('appleid.apple.com', parse_url($url, PHP_URL_HOST));
    parse_str(parse_url($url, PHP_URL_QUERY), $p);
    MiniTest::assertSame('form_post', $p['response_mode']);
    MiniTest::assertSame('code', $p['response_type']);
    MiniTest::assertSame('name email', $p['scope']);
    MiniTest::assertSame('nonce', $p['nonce']);
    MiniTest::assertTrue(! isset($p['client_secret']));
});

MiniTest::add('Apple: exchanges code, validates RSA signature and signs ES256 client secret', static function (): void {
    $ec = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
    openssl_pkey_export($ec, $pem);
    AppleTestClient::$keyPath = tempnam(sys_get_temp_dir(), 'apple-test-');
    file_put_contents(AppleTestClient::$keyPath, $pem);
    try {
        [$token, $jwks] = appleFixture();
        $client = new AppleTestClient();
        $client->responses = [['id_token' => $token, 'refresh_token' => 'refresh-test'], $jwks];
        $identity = $client->identity('code', 'https://web.example/callback', 'test-nonce');
        MiniTest::assertSame('apple.subject.123', $identity['id']);
        MiniTest::assertSame('relay@privaterelay.appleid.com', $identity['email']);
        MiniTest::assertSame('refresh-test', $identity['refreshToken']);
        $p = $client->calls[0]['parameters'];
        MiniTest::assertSame('authorization_code', $p['grant_type']);
        MiniTest::assertSame('https://web.example/callback', $p['redirect_uri']);
        [$h, $c, $s] = explode('.', $p['client_secret']);
        $claims = json_decode(base64_decode(strtr($c, '-_', '+/')), true);
        MiniTest::assertSame('TESTTEAM01', $claims['iss']);
        MiniTest::assertSame('com.mtrip.test.web', $claims['sub']);
        MiniTest::assertTrue($claims['exp'] > time() && $claims['exp'] <= time() + 600);
        $signature = base64_decode(strtr($s, '-_', '+/'));
        MiniTest::assertSame(64, strlen($signature));
        $integer = static function (string $v): string {
            $v = ltrim($v, "\0");
            if ($v === '' || ord($v[0]) > 127) $v = "\0" . $v;
            return "\x02" . chr(strlen($v)) . $v;
        };
        $body = $integer(substr($signature, 0, 32)) . $integer(substr($signature, 32));
        MiniTest::assertSame(1, openssl_verify($h . '.' . $c, "\x30" . chr(strlen($body)) . $body, openssl_pkey_get_details($ec)['key'], OPENSSL_ALGO_SHA256));
    } finally {
        unlink(AppleTestClient::$keyPath);
    }
});

foreach ([
    'issuer' => ['iss' => 'https://evil.example'], 'audience' => ['aud' => 'other'],
    'expired' => ['exp' => time() - 1], 'future issuance' => ['iat' => time() + 600],
    'nonce' => ['nonce' => 'other'], 'missing nonce' => ['nonce' => null],
    'empty subject' => ['sub' => ''], 'missing expiry' => ['exp' => null],
] as $label => $claims) {
    MiniTest::add('Apple: rejects invalid ' . $label, static function () use ($claims): void {
        [$token, $jwks] = appleFixture($claims);
        $client = new AppleTestClient();
        $client->responses = [$jwks];
        MiniTest::assertThrows(BusinessException::class, static fn () => $client->verifyIdentityToken($token, 'test-nonce'));
    });
}

MiniTest::add('Apple: rejects unknown kid, algorithm confusion and forged signature', static function (): void {
    foreach ([['kid' => 'unknown'], ['alg' => 'HS256'], []] as $header) {
        [$token, $jwks] = appleFixture([], $header);
        if ($header === []) { [$token] = appleFixture(); }
        $client = new AppleTestClient();
        $client->responses = [$jwks];
        MiniTest::assertThrows(BusinessException::class, static fn () => $client->verifyIdentityToken($token, 'test-nonce'));
    }
});

MiniTest::add('Apple: unverified email is discarded; missing profile is accepted', static function (): void {
    [$token, $jwks] = appleFixture(['email_verified' => false]);
    $client = new AppleTestClient();
    $client->responses = [$jwks];
    MiniTest::assertSame('', $client->verifyIdentityToken($token, 'test-nonce')['email']);
});
