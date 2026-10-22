<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

class FacebookLoginService
{
    public const COOKIE = '__Host-mtrip_fb';
    public const CALLBACK = '/api/v1/auth/facebook/callback';
    public const COMPLETE = '/auth/facebook/complete';
    public const SESSION_TTL = 600;

    public function __construct(
        protected ConfigInterface $config,
        protected Redis $redis,
        protected FacebookClient $client,
        protected UserAuthService $auth,
    ) {
    }

    public function settings(string $origin): array
    {
        $this->assertOrigin($origin);
        return [
            'termsUrl' => (string) $this->config->get('facebook.terms_url'),
            'privacyUrl' => (string) $this->config->get('facebook.privacy_url'),
            'consentVersion' => (string) $this->config->get('facebook.consent_version'),
        ];
    }

    public function start(int $siteId, string $origin, string $browser, string $returnTo, string $consentVersion): array
    {
        $settings = $this->settings($origin);
        if ($siteId <= 0 || ! hash_equals($settings['consentVersion'], $consentVersion)
            || ! in_array($returnTo, ['home', 'more'], true)) {
            $this->invalid();
        }
        if (! Db::connection('system')->table('sys_site')->where('id', $siteId)->where('status', 1)->whereNull('deleted_at')->exists()) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'Site is unavailable');
        }
        $state = bin2hex(random_bytes(32));
        $this->store('state', $state, [
            'siteId' => $siteId, 'origin' => $origin, 'browser' => hash('sha256', $browser),
            'returnTo' => $returnTo, 'consentVersion' => $consentVersion, 'consentAt' => date('Y-m-d H:i:s'),
            'appId' => (string) $this->config->get('facebook.app_id'),
        ], self::SESSION_TTL);
        return ['authorizationUrl' => $this->client->authorizationUrl($origin . self::CALLBACK, $state)];
    }

    /** The state chooses the destination; request Host/forwarded headers cannot choose a redirect. */
    public function callback(string $state, string $browser, string $code, string $error): string
    {
        $session = $this->consume('state', $state, $browser);
        $origin = $session['origin'];
        $this->assertOrigin($origin);
        if (! hash_equals((string) $this->config->get('facebook.app_id'), $session['appId'])) {
            $this->invalid();
        }
        $destination = $origin . self::COMPLETE;
        if ($error !== '') {
            return $destination . '#error=' . ($error === 'access_denied' ? 'cancelled' : 'failed');
        }
        try {
            if ($code === '' || strlen($code) > 8192) {
                $this->invalid();
            }
            $identity = $this->client->identity($code, $origin . self::CALLBACK);
            $account = $this->auth->facebookAccount(
                (int) $session['siteId'], $session['appId'], $identity['id'], $identity['name'],
                $session['consentVersion'], $session['consentAt'],
            );
            $ticket = bin2hex(random_bytes(32));
            $this->store('ticket', $ticket, $session + $account, 60);
            return $destination . '#ticket=' . $ticket;
        } catch (BusinessException $e) {
            return $destination . '#error=' . ($e->getCode() === ErrorCode::FORBIDDEN ? 'restricted' : 'failed');
        } catch (\Throwable) {
            return $destination . '#error=failed';
        }
    }

    public function exchange(int $siteId, string $origin, string $browser, string $ticket, string $ip): array
    {
        $this->assertOrigin($origin);
        $session = $this->consume('ticket', $ticket, $browser, $siteId, $origin);
        if (! hash_equals((string) $this->config->get('facebook.app_id'), $session['appId'])) {
            $this->invalid();
        }
        $result = $this->auth->facebookSession((int) $session['userId'], $siteId, $ip);
        return $result + ['isNewUser' => (bool) $session['isNewUser'], 'returnTo' => $session['returnTo']];
    }

    private function assertOrigin(string $origin): void
    {
        if (! $this->config->get('facebook.enabled', false)
            || ! preg_match('/^\d+$/D', (string) $this->config->get('facebook.app_id', ''))
            || (string) $this->config->get('facebook.app_secret', '') === '') {
            throw new BusinessException(ErrorCode::SERVER_ERROR, 'Facebook login is not configured');
        }
        foreach (['terms_url', 'privacy_url'] as $key) {
            if (! filter_var($this->config->get('facebook.' . $key, ''), FILTER_VALIDATE_URL)
                || parse_url($this->config->get('facebook.' . $key), PHP_URL_SCHEME) !== 'https') {
                throw new BusinessException(ErrorCode::SERVER_ERROR, 'Facebook login policies are not configured');
            }
        }
        $parts = parse_url($origin);
        if (! is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['path'])
            || isset($parts['query']) || isset($parts['fragment'])
            || ! in_array($origin, $this->config->get('facebook.web_origins', []), true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'Use the configured HTTPS Facebook login entry');
        }
    }

    private function store(string $kind, string $value, array $data, int $ttl): void
    {
        $this->redis->setex($this->key($kind, $value), $ttl, json_encode($data, JSON_THROW_ON_ERROR));
    }

    /** Check binding and consume in one operation, without letting a wrong browser burn the credential. */
    private function consume(string $kind, string $value, string $browser, int $siteId = 0, string $origin = ''): array
    {
        if (! preg_match('/^[a-f0-9]{64}$/D', $value) || ! preg_match('/^[a-f0-9]{64}$/D', $browser)) {
            $this->invalid();
        }
        $lua = <<<'LUA'
local raw = redis.call('get', KEYS[1])
if not raw then return false end
local data = cjson.decode(raw)
if data.browser ~= ARGV[1] then return false end
if ARGV[2] ~= '0' and (tostring(data.siteId) ~= ARGV[2] or data.origin ~= ARGV[3]) then return false end
redis.call('del', KEYS[1])
return raw
LUA;
        $raw = $this->redis->eval($lua, [$this->key($kind, $value), hash('sha256', $browser), (string) $siteId, $origin], 1);
        if (! is_string($raw)) {
            $this->invalid();
        }
        return json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    }

    private function key(string $kind, string $value): string
    {
        return 'mtrip:facebook:' . $kind . ':' . hash('sha256', $value);
    }

    private function invalid(): never
    {
        throw new BusinessException(ErrorCode::PARAM_ERROR, 'Facebook login expired or invalid; please retry');
    }
}
