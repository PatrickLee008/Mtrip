<?php

declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Hyperf\Context\RequestContext;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

final class MerchantSessions
{
    public static function methodEnabled(array $account, string $method): bool
    {
        $channel = str_starts_with($method, 'google:') ? substr($method, 7) : $method;
        if (! in_array($channel, ['email', 'sms'], true) || (int) $account['merchant_id'] <= 0) return true;

        return (int) Db::table('merchant_info')->where('id', $account['merchant_id'])
            ->where('site_id', $account['site_id'])->whereNull('deleted_at')->value($channel . '_login_enabled') === 1;
    }

    public static function record(array $claims, string $method, int $ttl): int
    {
        $request = RequestContext::getOrNull();
        $path = $request?->getUri()->getPath() ?? '';
        $client = str_starts_with($path, '/api/v1/app/') ? match ($request?->getHeaderLine('X-Client-Type')) {
            'app-ios' => 'ios',
            'app-android' => 'android',
            default => 'app_h5',
        } : 'web';
        $agent = (string) $request?->getHeaderLine('User-Agent');
        $device = (string) $request?->getHeaderLine('X-Mtrip-Device-Name');
        $ip = (string) ($request?->getHeaderLine('X-Real-IP') ?: ($request?->getServerParams()['remote_addr'] ?? ''));
        return (int) Db::table('merchant_login_session')->insertGetId([
            'site_id' => $claims['site_id'], 'merchant_id' => $claims['merchant_id'], 'account_id' => $claims['admin_id'],
            'auth_version' => $claims['auth_version'], 'method' => $method, 'client' => $client,
            'device_name' => mb_substr(mb_scrub(trim($device ?: $agent)), 0, 160),
            'ip_address' => filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '',
            'logged_in_at' => gmdate('Y-m-d H:i:s'), 'expires_at' => gmdate('Y-m-d H:i:s', time() + $ttl),
        ]);
    }

    public static function assertActive(array $claims): void
    {
        if (! isset($claims['merchant_session_id'])) return;
        if (! Db::table('merchant_login_session')->where('id', $claims['merchant_session_id'])
            ->where('account_id', $claims['admin_id'])->whereNull('revoked_at')->where('expires_at', '>', gmdate('Y-m-d H:i:s'))->exists()) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED, '商户会话已失效');
        }
    }

    public static function end(int $id, int $accountId): void
    {
        Db::table('merchant_login_session')->where('id', $id)->where('account_id', $accountId)
            ->whereNull('revoked_at')->update(['revoked_at' => gmdate('Y-m-d H:i:s')]);
    }
}
