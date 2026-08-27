<?php

declare(strict_types=1);

use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessPolicy as Policy;

MiniTest::add('M12: access and booking for every legacy state and blacklist overlay', static function () {
    foreach (range(0, 6) as $status) {
        MiniTest::assertSame(in_array($status, [3, 4], true), Policy::canAccess($status, false));
        MiniTest::assertSame($status === 3, Policy::canBook($status, false));
        MiniTest::assertSame(false, Policy::canAccess($status, true));
        MiniTest::assertSame(false, Policy::canBook($status, true));
    }
});
MiniTest::add('M12: ordinary suspension and activation', static function () {
    MiniTest::assertSame(4, Policy::target(3, false, false, 'suspend', false));
    MiniTest::assertSame(3, Policy::target(4, false, false, 'activate', false));
    MiniTest::assertSame(3, Policy::target(4, false, false, 'expire', false));
});
MiniTest::add('M12: blacklist removal remains suspended and requires separate privileged reactivation', static function () {
    MiniTest::assertSame(4, Policy::target(3, false, false, 'blacklist', true));
    MiniTest::assertSame(4, Policy::target(4, true, false, 'unblacklist', true));
    MiniTest::assertSame(3, Policy::target(4, false, true, 'reactivate', true));
    foreach (['activate', 'expire'] as $action) {
        MiniTest::assertThrows(BusinessException::class, fn () => Policy::target(4, false, true, $action, true), 40301);
        MiniTest::assertThrows(BusinessException::class, fn () => Policy::target(4, true, false, $action, true), 40901);
    }
    foreach (['blacklist', 'unblacklist', 'reactivate'] as $action) {
        MiniTest::assertThrows(BusinessException::class, fn () => Policy::target(4, false, false, $action, false), 40301);
    }
});
MiniTest::add('M12: operating transitions cannot bypass approval or closure', static function () {
    foreach ([0, 1, 2, 5, 6] as $status) {
        foreach (['suspend', 'activate', 'reactivate', 'blacklist', 'unblacklist', 'expire'] as $action) {
            MiniTest::assertThrows(BusinessException::class, fn () => Policy::target($status, false, false, $action, true), 40901);
        }
    }
});
MiniTest::add('M12: deadlines require valid explicit timezone and normalize to UTC', static function () {
    MiniTest::assertSame(null, Policy::deadline(null));
    MiniTest::assertSame('2026-08-27 04:30:00', Policy::deadline('2026-08-27T12:30:00+08:00'));
    MiniTest::assertSame('2026-08-27 04:30:00', Policy::deadline('2026-08-27T04:30:00.000Z'));
    foreach (['2026-02-30T00:00:00Z', '2026-08-27 12:30:00', 'tomorrow', '2026-08-27T12:30:00'] as $value) {
        MiniTest::assertThrows(BusinessException::class, fn () => Policy::deadline($value), 40001);
    }
});
