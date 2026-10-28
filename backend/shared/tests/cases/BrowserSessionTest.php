<?php

declare(strict_types=1);

use Mtrip\Shared\Auth\AdminSessionIdentity;
use Mtrip\Shared\Auth\BrowserSessionService;
use Mtrip\Shared\Exception\BusinessException;

MiniTest::add('Browser session: refresh requires a same-host origin and custom marker', static function (): void {
    BrowserSessionService::assertRefreshRequest('1', 'https://admin.example.com', 'admin.example.com', 'same-origin');
    BrowserSessionService::assertRefreshRequest('1', 'http://localhost:5173', 'localhost', 'same-site');
    BrowserSessionService::assertRefreshRequest('1', '', 'localhost', '');
    foreach ([['', 'https://admin.example.com', 'admin.example.com', 'same-origin'],
        ['1', 'https://evil.example.com', 'admin.example.com', 'same-site'],
        ['1', 'https://admin.example.com', 'admin.example.com', 'cross-site'],
        ['1', 'null', 'admin.example.com', 'same-origin']] as $args) {
        MiniTest::assertThrows(BusinessException::class, static fn () => BrowserSessionService::assertRefreshRequest(...$args), 40301);
    }
});

MiniTest::add('Browser session: authorization stamp ignores permission order but detects credential and scope changes', static function (): void {
    $stamp = AdminSessionIdentity::fingerprint('hashed-password', 1, 0, ['a', 'b']);
    MiniTest::assertSame($stamp, AdminSessionIdentity::fingerprint('hashed-password', 1, 0, ['b', 'a']));
    foreach ([['other-password', 1, 0, ['a', 'b']], ['hashed-password', 2, 0, ['a', 'b']],
        ['hashed-password', 1, 1, ['a', 'b']], ['hashed-password', 1, 0, ['a']]] as $args) {
        MiniTest::assertTrue($stamp !== AdminSessionIdentity::fingerprint(...$args));
    }
    MiniTest::assertTrue(BrowserSessionService::cookieName('admin') !== BrowserSessionService::cookieName('merchant'));
});
