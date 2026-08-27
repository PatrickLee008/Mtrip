<?php
declare(strict_types=1);

use Mtrip\Shared\Merchant\MerchantPhoneIndex;
use Mtrip\Shared\Exception\BusinessException;

MiniTest::add('M12: phone normalization exact and keyed', static function () {
    $expected = MerchantPhoneIndex::hash('+95 912-345-6789', 'key');
    foreach (['00959123456789', '959123456789', '+95 (912) 345.6789'] as $phone) {
        MiniTest::assertSame($expected, MerchantPhoneIndex::hash($phone, 'key'));
    }
    MiniTest::assertSame(64, strlen($expected));
    MiniTest::assertSame(false, $expected === MerchantPhoneIndex::hash('959123456789', 'other-key'));
    MiniTest::assertSame(false, $expected === MerchantPhoneIndex::hash('09123456789', 'key'));
});
MiniTest::add('M12: invalid phone does not create searchable digest', static function () {
    foreach (['', '1234', '*12345678', '12345678 ext9', '123456789012345678', '++959123456789', 'abc@example.test'] as $phone) {
        MiniTest::assertSame(null, MerchantPhoneIndex::hash($phone, 'key'));
    }
    MiniTest::assertThrows(BusinessException::class, fn () => MerchantPhoneIndex::hash('959123456789', ''), 50001);
});
