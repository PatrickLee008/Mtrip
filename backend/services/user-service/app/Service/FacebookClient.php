<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Contract\ConfigInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

class FacebookClient
{
    public function __construct(protected ConfigInterface $config)
    {
    }

    public function authorizationUrl(string $redirectUri, string $state): string
    {
        return 'https://www.facebook.com/' . $this->version() . '/dialog/oauth?' . http_build_query([
            'client_id' => $this->config->get('facebook.app_id'),
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'public_profile',
            'state' => $state,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /** Tokens never leave this adapter; the account layer receives only validated identity fields. */
    public function identity(string $code, string $redirectUri): array
    {
        $appId = (string) $this->config->get('facebook.app_id');
        $secret = (string) $this->config->get('facebook.app_secret');
        $token = $this->request('/oauth/access_token', [
            'client_id' => $appId, 'client_secret' => $secret,
            'redirect_uri' => $redirectUri, 'code' => $code,
        ], '', true);
        $accessToken = $token['access_token'] ?? '';
        if (! is_string($accessToken) || $accessToken === '') {
            $this->invalid();
        }
        $debug = $this->request('/debug_token', ['input_token' => $accessToken], $appId . '|' . $secret);
        $data = $debug['data'] ?? [];
        $userId = (string) ($data['user_id'] ?? '');
        if (($data['is_valid'] ?? false) !== true || (string) ($data['app_id'] ?? '') !== $appId
            || ! preg_match('/^\d{1,128}$/D', $userId)
            || (int) ($data['expires_at'] ?? 0) <= time()
            || ((int) ($data['data_access_expires_at'] ?? 0) > 0 && (int) $data['data_access_expires_at'] <= time())
            || ! in_array('public_profile', $data['scopes'] ?? [], true)) {
            $this->invalid();
        }
        $profile = $this->request('/me', [
            'fields' => 'id,name', 'appsecret_proof' => hash_hmac('sha256', $accessToken, $secret),
        ], $accessToken);
        if ((string) ($profile['id'] ?? '') !== $userId) {
            $this->invalid();
        }
        return ['id' => $userId, 'name' => mb_substr(trim((string) ($profile['name'] ?? '')), 0, 50)];
    }

    protected function request(string $path, array $parameters, string $bearer = '', bool $post = false): array
    {
        $url = 'https://graph.facebook.com/' . $this->version() . $path;
        $body = http_build_query($parameters, '', '&', PHP_QUERY_RFC3986);
        $curl = curl_init($post ? $url : $url . '?' . $body);
        $headers = ['Accept: application/json'];
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
        // Never propagate provider bodies or cURL URLs: they may contain credentials.
        $result = is_string($raw) ? json_decode($raw, true) : null;
        if ($status !== 200 || ! is_array($result) || isset($result['error'])) {
            throw new BusinessException(ErrorCode::THIRD_PARTY_ERROR, 'Facebook authorization failed; please retry');
        }
        return $result;
    }

    private function version(): string
    {
        $version = (string) $this->config->get('facebook.graph_version', 'v24.0');
        if (! preg_match('/^v\d+\.0$/D', $version)) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, 'Invalid Facebook API version');
        }
        return $version;
    }

    private function invalid(): never
    {
        throw new BusinessException(ErrorCode::PARAM_ERROR, 'Facebook identity could not be verified');
    }
}
