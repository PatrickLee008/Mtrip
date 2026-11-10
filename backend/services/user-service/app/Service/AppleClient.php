<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Contract\ConfigInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

class AppleClient
{
    public function __construct(protected ConfigInterface $config)
    {
    }

    public function authorizationUrl(string $redirectUri, string $state, string $nonce): string
    {
        return 'https://appleid.apple.com/auth/authorize?' . http_build_query([
            'client_id' => $this->config->get('apple.client_id'), 'redirect_uri' => $redirectUri,
            'response_type' => 'code', 'response_mode' => 'form_post', 'scope' => 'name email',
            'state' => $state, 'nonce' => $nonce,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public function identity(string $code, string $redirectUri, string $nonce): array
    {
        $token = $this->request('/auth/token', [
            'client_id' => $this->config->get('apple.client_id'), 'client_secret' => $this->clientSecret(),
            'grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => $redirectUri,
        ]);
        $identity = $this->verifyIdentityToken((string) ($token['id_token'] ?? ''), $nonce);
        $refresh = $token['refresh_token'] ?? '';
        if (! is_string($refresh) || strlen($refresh) > 8192) {
            $this->invalid();
        }
        return $identity + ['refreshToken' => $refresh];
    }

    public function verifyIdentityToken(string $token, string $nonce): array
    {
        if (strlen($token) > 16384 || count($parts = explode('.', $token)) !== 3) {
            $this->invalid();
        }
        [$header, $claims] = [json_decode($this->decode($parts[0]), true), json_decode($this->decode($parts[1]), true)];
        if (! is_array($header) || ! is_array($claims) || ($header['alg'] ?? '') !== 'RS256'
            || ! is_string($header['kid'] ?? null) || isset($header['crit'])) {
            $this->invalid();
        }
        // Fetch current Apple keys so newly rotated kids are accepted without trusting token-supplied URLs.
        $keys = $this->request('/auth/keys')['keys'] ?? [];
        $publicKey = null;
        foreach ($keys as $key) {
            if (($key['kid'] ?? '') === $header['kid'] && ($key['kty'] ?? '') === 'RSA'
                && ($key['alg'] ?? '') === 'RS256' && ($key['use'] ?? '') === 'sig') {
                $rsa = $this->der(0x30, $this->integer($this->decode((string) ($key['n'] ?? '')))
                    . $this->integer($this->decode((string) ($key['e'] ?? ''))));
                $spki = $this->der(0x30, hex2bin('300d06092a864886f70d0101010500') . $this->der(0x03, "\0" . $rsa));
                $publicKey = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
                break;
            }
        }
        if ($publicKey === null || openssl_verify($parts[0] . '.' . $parts[1], $this->decode($parts[2]), $publicKey, OPENSSL_ALGO_SHA256) !== 1
            || ($claims['iss'] ?? '') !== 'https://appleid.apple.com'
            || ($claims['aud'] ?? '') !== $this->config->get('apple.client_id')
            || ! is_int($claims['exp'] ?? null) || $claims['exp'] <= time()
            || ! is_int($claims['iat'] ?? null) || $claims['iat'] > time() + 60 || $claims['iat'] >= $claims['exp']
            || ! is_string($claims['nonce'] ?? null) || $nonce === '' || ! hash_equals($nonce, $claims['nonce'])
            || ! is_string($claims['sub'] ?? null) || ! preg_match('/^[A-Za-z0-9_.-]{1,128}$/D', $claims['sub'])) {
            $this->invalid();
        }
        $email = $claims['email'] ?? '';
        if (! in_array($claims['email_verified'] ?? false, [true, 'true'], true)
            || ! is_string($email) || strlen($email) > 254 || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $email = '';
        }
        return ['id' => $claims['sub'], 'email' => $email];
    }

    private function clientSecret(): string
    {
        $path = (string) $this->config->get('apple.private_key_path');
        $key = is_readable($path) ? openssl_pkey_get_private(file_get_contents($path)) : false;
        $details = $key ? openssl_pkey_get_details($key) : false;
        if (! $details || $details['type'] !== OPENSSL_KEYTYPE_EC || ($details['ec']['curve_name'] ?? '') !== 'prime256v1') {
            throw new BusinessException(ErrorCode::SERVER_ERROR, 'Apple signing key is not configured');
        }
        $encode = static fn (array $v): string => rtrim(strtr(base64_encode(json_encode($v, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
        $input = $encode(['alg' => 'ES256', 'kid' => $this->config->get('apple.key_id')]) . '.'
            . $encode(['iss' => $this->config->get('apple.team_id'), 'iat' => time(), 'exp' => time() + 300,
                'aud' => 'https://appleid.apple.com', 'sub' => $this->config->get('apple.client_id')]);
        if (! openssl_sign($input, $signature, $key, OPENSSL_ALGO_SHA256)) {
            $this->invalid();
        }
        // OpenSSL returns DER ECDSA integers; JWT requires fixed-width R || S.
        $offset = 2;
        $rLength = ord($signature[$offset + 1]);
        $r = substr($signature, $offset + 2, $rLength);
        $offset += 2 + $rLength;
        $s = substr($signature, $offset + 2, ord($signature[$offset + 1]));
        $jose = str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT) . str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
        return $input . '.' . rtrim(strtr(base64_encode($jose), '+/', '-_'), '=');
    }

    private function decode(string $value): string
    {
        if (! preg_match('/^[A-Za-z0-9_-]+$/D', $value) || ($decoded = base64_decode(strtr($value, '-_', '+/'), true)) === false) {
            $this->invalid();
        }
        return $decoded;
    }

    private function integer(string $value): string
    {
        $value = ltrim($value, "\0");
        return $this->der(0x02, ($value === '' || ord($value[0]) > 127 ? "\0" : '') . $value);
    }

    private function der(int $tag, string $value): string
    {
        $length = strlen($value);
        $bytes = ltrim(pack('N', $length), "\0");
        return chr($tag) . ($length < 128 ? chr($length) : chr(128 + strlen($bytes)) . $bytes) . $value;
    }

    protected function request(string $path, array $parameters = []): array
    {
        $curl = curl_init('https://appleid.apple.com' . $path);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 15,
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
        ]);
        if ($parameters !== []) {
            curl_setopt($curl, CURLOPT_POST, true);
            curl_setopt($curl, CURLOPT_POSTFIELDS, http_build_query($parameters, '', '&', PHP_QUERY_RFC3986));
        }
        $raw = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        $result = is_string($raw) ? json_decode($raw, true) : null;
        if ($status !== 200 || ! is_array($result) || isset($result['error'])) {
            throw new BusinessException(ErrorCode::THIRD_PARTY_ERROR, 'Apple authorization failed; please retry');
        }
        return $result;
    }

    private function invalid(): never
    {
        throw new BusinessException(ErrorCode::PARAM_ERROR, 'Apple identity could not be verified');
    }
}
