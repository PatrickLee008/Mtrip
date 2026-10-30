<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Contract\ConfigInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

class TikTokClient
{
    public function __construct(protected ConfigInterface $config)
    {
    }

    public function authorizationUrl(string $redirectUri, string $state): string
    {
        return 'https://www.tiktok.com/v2/auth/authorize/?' . http_build_query([
            'client_key' => $this->config->get('tiktok.client_key'),
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'user.info.basic',
            'state' => $state,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /** Only server-exchanged, matching token/profile identities reach the account layer. */
    public function identity(string $code, string $redirectUri): array
    {
        $token = $this->request('/v2/oauth/token/', [
            'client_key' => $this->config->get('tiktok.client_key'),
            'client_secret' => $this->config->get('tiktok.client_secret'),
            'grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => $redirectUri,
        ], '', true);
        $accessToken = $token['access_token'] ?? '';
        $subject = $token['open_id'] ?? '';
        if (! is_string($accessToken) || $accessToken === ''
            || ! is_string($subject) || ! preg_match('/^[A-Za-z0-9_.-]{1,128}$/D', $subject)
            || strcasecmp((string) ($token['token_type'] ?? ''), 'Bearer') !== 0
            || (int) ($token['expires_in'] ?? 0) <= 0
            || ! in_array('user.info.basic', explode(',', (string) ($token['scope'] ?? '')), true)) {
            $this->invalid();
        }
        $profile = $this->request('/v2/user/info/', ['fields' => 'open_id,display_name'], $accessToken);
        if (($profile['error']['code'] ?? '') !== 'ok'
            || ($profile['data']['user']['open_id'] ?? '') !== $subject) {
            $this->invalid();
        }
        return ['id' => $subject, 'name' => mb_substr(trim((string) ($profile['data']['user']['display_name'] ?? '')), 0, 50)];
    }

    protected function request(string $path, array $parameters, string $bearer = '', bool $post = false): array
    {
        $url = 'https://open.tiktokapis.com' . $path;
        $body = http_build_query($parameters, '', '&', PHP_QUERY_RFC3986);
        $curl = curl_init($post ? $url : $url . '?' . $body);
        $headers = ['Accept: application/json'];
        if ($post) {
            $headers[] = 'Content-Type: application/x-www-form-urlencoded';
        }
        if ($bearer !== '') {
            $headers[] = 'Authorization: Bearer ' . $bearer;
        }
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 15,
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        if ($post) {
            curl_setopt($curl, CURLOPT_POST, true);
            curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
        }
        $raw = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        // Provider responses can contain credentials; never propagate them to errors or logs.
        $result = is_string($raw) ? json_decode($raw, true) : null;
        if ($status !== 200 || ! is_array($result)
            || ($post && isset($result['error']))
            || (! $post && ($result['error']['code'] ?? '') !== 'ok')) {
            throw new BusinessException(ErrorCode::THIRD_PARTY_ERROR, 'TikTok authorization failed; please retry');
        }
        return $result;
    }

    private function invalid(): never
    {
        throw new BusinessException(ErrorCode::PARAM_ERROR, 'TikTok identity could not be verified');
    }
}
