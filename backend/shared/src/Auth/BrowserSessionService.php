<?php

declare(strict_types=1);

namespace Mtrip\Shared\Auth;

use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use Hyperf\HttpMessage\Stream\SwooleStream;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Redis\Redis;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessGuard;
use Mtrip\Shared\Support\JwtHelper;
use Psr\Http\Message\ResponseInterface;

/** Browser sessions are independent of App credentials and support impersonation. */
final class BrowserSessionService
{
    public function __construct(private Redis $redis, private ConfigInterface $config)
    {
    }

    public function policy(): array
    {
        $values = Db::connection('system')->table('sys_config')->whereIn('config_key', ['jwt_expire_minutes', 'jwt_refresh_days'])
            ->whereNull('deleted_at')->pluck('config_value', 'config_key')->toArray();
        return [
            'access' => max(5, min(120, (int) ($values['jwt_expire_minutes'] ?? 30))) * 60,
            'session' => max(1, min(30, (int) ($values['jwt_refresh_days'] ?? 7))) * 86400,
        ];
    }

    public function start(array $data, string $realm): array
    {
        $claims = JwtHelper::verify($data['token'], $this->secret());
        if (isset($claims['impersonation_session_id'])) return ['data' => $data];
        if ($realm === 'admin') AdminSessionIdentity::assertSession($claims);
        $policy = $this->policy();
        $sid = bin2hex(random_bytes(24));
        $claims['aud'] = $realm;
        $claims['sid'] = $sid;
        $claims['session_version'] = (int) $this->redis->get($this->versionKey($realm, (int) $claims['admin_id']));
        unset($claims['iat'], $claims['exp'], $claims['jti']);
        $session = ['claims' => $claims, 'expires_at' => time() + $policy['session'], 'generation' => 1, 'rotated_at' => time()];
        $session['refresh_hash'] = hash('sha256', $this->credential($sid, 1, $realm));
        $this->redis->setex($this->key($sid, $realm), $policy['session'], json_encode($session));
        return $this->result($session, $data, $realm, $policy['access']);
    }

    public function loginResponse(array $data, string $realm, RequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        if (! isset($data['token'])) return $response->withHeader('Cache-Control', 'no-store');
        return $this->respond($response, $this->start($data, $realm), $realm, $this->secure($request));
    }

    public function refreshResponse(string $realm, RequestInterface $request, ResponseInterface $response, callable $renew): ResponseInterface
    {
        self::assertRefreshRequest($request->getHeaderLine('X-Mtrip-Refresh'), $request->getHeaderLine('Origin'),
            $request->getHeaderLine('Host'), $request->getHeaderLine('Sec-Fetch-Site'));
        $session = $this->refresh((string) ($request->getCookieParams()[self::cookieName($realm)] ?? ''), $realm, $renew);
        return $this->respond($response, $session, $realm, $this->secure($request));
    }

    public function logoutResponse(string $realm, RequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $token = substr($request->getHeaderLine('Authorization'), 7);
        $claims = JwtHelper::verify($token, $this->secret());
        if (isset($claims['impersonation_session_id'])) return $response;
        $this->revoke($token, $realm);
        return $this->cookie($response, '', $realm, 0, $this->secure($request));
    }

    public function refresh(string $cookie, string $realm, callable $renew): array
    {
        [$sid, $generation] = $this->parseCredential($cookie, $realm);
        $key = $this->key($sid, $realm);
        $session = $this->read($sid, $realm);
        $this->assertIdentity($session['claims'], $realm);
        // Rebuild the profile and permission claims using the domain's normal issuer.
        $data = $renew($session['claims']);
        $claims = JwtHelper::verify($data['token'], $this->secret());
        foreach (['admin_id', 'site_id', 'account_type', 'group_id', 'merchant_id', 'store_id', 'is_owner', 'auth_version', 'amr'] as $field) {
            if (($claims[$field] ?? null) !== ($session['claims'][$field] ?? null)) $this->expired();
        }
        $claims['sid'] = $sid;
        $claims['aud'] = $realm;
        $claims['session_version'] = $session['claims']['session_version'];
        if ($realm === 'admin') $claims['security_stamp'] = $session['claims']['security_stamp'];
        unset($claims['iat'], $claims['exp'], $claims['jti']);
        $nextHash = hash('sha256', $this->credential($sid, $generation + 1, $realm));
        // Atomic rotation also lets a lost response or a concurrent tab reuse the previous credential for 15 seconds.
        $raw = $this->redis->eval(<<<'LUA'
local raw = redis.call('GET', KEYS[1])
if not raw then return false end
local s = cjson.decode(raw)
local now = tonumber(ARGV[1])
local generation = tonumber(ARGV[2])
if s.expires_at <= now then redis.call('DEL', KEYS[1]); return false end
if generation == s.generation and s.refresh_hash == ARGV[3] then
    s.generation = s.generation + 1
    s.refresh_hash = ARGV[4]
    s.rotated_at = now
    s.claims = cjson.decode(ARGV[5])
    raw = cjson.encode(s)
    redis.call('SETEX', KEYS[1], s.expires_at - now, raw)
elseif generation ~= s.generation - 1 or now - s.rotated_at > 15 then
    redis.call('DEL', KEYS[1]); return false
end
return raw
LUA, [$key, time(), $generation, hash('sha256', $cookie), $nextHash, json_encode($claims)], 1);
        if (! is_string($raw) || $raw === '') $this->expired();
        return $this->result(json_decode($raw, true), $data, $realm, $this->policy()['access']);
    }

    public function assertAccess(array $claims, string $realm): void
    {
        if (! isset($claims['sid'])) return; // Existing tokens live out their original, short expiry.
        $session = $this->read((string) $claims['sid'], $realm);
        if ((int) $session['claims']['admin_id'] !== (int) ($claims['admin_id'] ?? 0)) $this->expired();
        if ($realm === 'admin') $this->assertIdentity($claims, $realm);
    }

    public function revokeAccount(string $realm, int $id): void
    {
        $key = $this->versionKey($realm, $id);
        $this->redis->incr($key);
        $this->redis->expire($key, 31 * 86400);
    }

    public function revoke(string $token, string $realm): void
    {
        $claims = JwtHelper::verify($token, $this->secret());
        if (isset($claims['sid']) && ($claims['aud'] ?? '') === $realm) $this->redis->del($this->key($claims['sid'], $realm));
    }

    public function respond(ResponseInterface $response, array $session, string $realm, bool $secure): ResponseInterface
    {
        $body = json_decode((string) $response->getBody(), true);
        $body['data'] = $session['data'];
        $response = $response->withBody(new SwooleStream(json_encode($body, JSON_UNESCAPED_UNICODE)))->withHeader('Cache-Control', 'no-store');
        if (isset($session['cookie'])) $response = $this->cookie($response, $session['cookie'], $realm, $session['maxAge'], $secure);
        return $response;
    }

    public function cookie(ResponseInterface $response, string $value, string $realm, int $maxAge, bool $secure): ResponseInterface
    {
        return $response->withAddedHeader('Set-Cookie', self::cookieName($realm) . '=' . $value
            . '; Path=/api/v1/' . $realm . '/auth; Max-Age=' . $maxAge . '; HttpOnly; SameSite=Strict' . ($secure ? '; Secure' : ''))
            ->withHeader('Cache-Control', 'no-store');
    }

    public static function cookieName(string $realm): string
    {
        return 'mtrip_' . $realm . '_refresh';
    }

    public static function assertRefreshRequest(string $marker, string $origin, string $host, string $fetchSite): void
    {
        if ($marker !== '1' || $fetchSite === 'cross-site'
            || ($origin !== '' && strtolower((string) parse_url($origin, PHP_URL_HOST)) !== strtolower(explode(':', $host)[0]))) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '刷新会话请求来源无效');
        }
    }

    private function result(array $session, array $data, string $realm, int $accessTtl): array
    {
        $remaining = $session['expires_at'] - time();
        if ($remaining <= 0) $this->expired();
        $ttl = min($accessTtl, $remaining);
        $data['token'] = JwtHelper::issue($session['claims'], $this->secret(), $ttl);
        $data['expiresAt'] = time() + $ttl;
        $data['sessionExpiresAt'] = $session['expires_at'];
        return ['data' => $data, 'cookie' => $this->credential($session['claims']['sid'], $session['generation'], $realm), 'maxAge' => $remaining];
    }

    private function read(string $sid, string $realm): array
    {
        if (! preg_match('/^[a-f0-9]{48}$/D', $sid)) $this->expired();
        $session = json_decode((string) $this->redis->get($this->key($sid, $realm)), true);
        if (! is_array($session) || $session['expires_at'] <= time() || ($session['claims']['aud'] ?? '') !== $realm) $this->expired();
        return $session;
    }

    private function assertIdentity(array $claims, string $realm): void
    {
        if ((int) ($claims['session_version'] ?? 0) !== (int) $this->redis->get($this->versionKey($realm, (int) $claims['admin_id']))) $this->expired();
        if ($realm === 'admin') AdminSessionIdentity::assertSession($claims);
        else MerchantAccessGuard::assertSession($claims);
    }

    private function credential(string $sid, int $generation, string $realm): string
    {
        $value = $sid . '.' . $generation;
        return $value . '.' . hash_hmac('sha256', 'browser-refresh:' . $realm . ':' . $value, $this->secret());
    }

    private function parseCredential(string $cookie, string $realm): array
    {
        if (! preg_match('/^([a-f0-9]{48})\.([1-9][0-9]{0,8})\.[a-f0-9]{64}$/D', $cookie, $parts)
            || ! hash_equals($this->credential($parts[1], (int) $parts[2], $realm), $cookie)) $this->expired();
        return [$parts[1], (int) $parts[2]];
    }

    private function secret(): string
    {
        $secret = (string) $this->config->get('mtrip.jwt_secret', '');
        if ($secret === '') throw new BusinessException(ErrorCode::SERVER_ERROR, 'JWT 密钥未配置');
        return $secret;
    }

    private function secure(RequestInterface $request): bool
    {
        return $request->getUri()->getScheme() === 'https' || $request->getHeaderLine('X-Forwarded-Proto') === 'https';
    }

    private function key(string $sid, string $realm): string
    {
        return 'mtrip:browser-session:' . $realm . ':' . $sid;
    }

    private function versionKey(string $realm, int $id): string
    {
        return 'mtrip:browser-version:' . $realm . ':' . $id;
    }

    private function expired(): never
    {
        throw new BusinessException(ErrorCode::UNAUTHORIZED, '登录会话已失效，请重新登录');
    }
}
