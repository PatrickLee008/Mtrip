<?php

declare(strict_types=1);

use Mtrip\Shared\Merchant\Totp;
use Mtrip\Shared\Merchant\MerchantImpersonationGuard;
use Mtrip\Shared\Support\MaskHelper;

MiniTest::add('S4 RFC6238 SHA1 reference vectors including beyond 2038', static function () {
    $secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    foreach ([59 => '94287082', 1111111109 => '07081804', 1111111111 => '14050471', 1234567890 => '89005924', 2000000000 => '69279037', 20000000000 => '65353130'] as $time => $code) {
        MiniTest::assertSame($code, Totp::code($secret, intdiv($time, 30), 8));
    }
});
MiniTest::add('S4 TOTP uniqueness, time window and replay rejection', static function () {
    $secret = Totp::secret();
    MiniTest::assertSame(32, strlen($secret));
    MiniTest::assertSame(false, $secret === Totp::secret());
    $code = Totp::code($secret, 1000);
    MiniTest::assertSame(1000, Totp::matchStep($secret, $code, -1, 30000));
    MiniTest::assertSame(null, Totp::matchStep($secret, $code, 1000, 30000));
    MiniTest::assertSame(null, Totp::matchStep($secret, '12345', -1, 30000));
    MiniTest::assertSame(null, Totp::matchStep($secret, $code, -1, 30200));
});
MiniTest::add('S4 support deny by default and exact method/path allowlist', static function () {
    MiniTest::assertSame(true, MerchantImpersonationGuard::allowed('GET', '/api/v1/merchant/order/detail'));
    foreach (['auth/password', 'auth/2fa/setup', 'account/create', 'role/update', 'earnings/summary', 'order/verify', 'rooms/save', 'notifications/read', 'unknown'] as $route) {
        foreach (['GET', 'POST'] as $method) MiniTest::assertSame(false, MerchantImpersonationGuard::allowed($method, '/api/v1/merchant/' . $route));
    }
    MiniTest::assertSame(false, MerchantImpersonationGuard::allowed('GET', '/api/v1/merchant/order/detail/'));
});
MiniTest::add('S4 authentication fields are masked recursively', static function () {
    $keys = ['otp', 'twoFaCode', 'challengeToken', 'accessCode', 'oneTimePassword', 'manualKey', 'otpauthUri', 'exchangeCode', 'two_fa_secret_enc', 'oldPassword', 'newPassword'];
    $masked = MaskHelper::maskParams(['nested' => array_fill_keys($keys, 'must-not-leak')]);
    foreach ($masked['nested'] as $value) MiniTest::assertSame('***已脱敏***', $value);
});
