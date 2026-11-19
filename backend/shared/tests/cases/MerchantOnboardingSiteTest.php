<?php
declare(strict_types=1);

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantOnboardingSite;

MiniTest::add('New merchant: super admin always creates in site 7', static function (): void {
    foreach ([0, 1, 6, 7] as $siteId) MiniTest::assertSame(7, MerchantOnboardingSite::forAdmin(true, $siteId));
});

MiniTest::add('New merchant: scoped admins retain site isolation', static function (): void {
    MiniTest::assertSame(7, MerchantOnboardingSite::forAdmin(false, 7));
    foreach ([0, 1, 6, 991] as $siteId) {
        MiniTest::assertThrows(BusinessException::class, static fn () => MerchantOnboardingSite::forAdmin(false, $siteId), ErrorCode::NO_DATA_PERMISSION);
    }
});

MiniTest::add('New merchant: final approval rejects legacy sites before creating a merchant', static function (): void {
    MerchantOnboardingSite::assertNewMerchant(7);
    foreach ([0, 1, 6, 991] as $siteId) {
        MiniTest::assertThrows(BusinessException::class, static fn () => MerchantOnboardingSite::assertNewMerchant($siteId), ErrorCode::DATA_CONFLICT);
    }
});
