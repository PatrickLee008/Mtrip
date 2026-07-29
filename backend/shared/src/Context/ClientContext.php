<?php

declare(strict_types=1);

namespace Mtrip\Shared\Context;

use Hyperf\Context\Context;

/**
 * 移动端客户端上下文(协程级),由 ClientSignMiddleware 注入
 */
class ClientContext
{
    private const KEY = 'mtrip.client';

    public static function set(array $client): void
    {
        Context::set(self::KEY, $client);
    }

    public static function get(): array
    {
        return Context::get(self::KEY, []);
    }

    public static function clientId(): string
    {
        return (string) (self::get()['client_id'] ?? '');
    }

    public static function siteId(): int
    {
        return (int) (self::get()['site_id'] ?? 0);
    }

    public static function ip(): string
    {
        return (string) (self::get()['ip'] ?? '');
    }
}
