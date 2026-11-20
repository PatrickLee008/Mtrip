<?php

declare(strict_types=1);

use Mtrip\Shared\Merchant\CommercialTerms;
use Mtrip\Shared\Exception\BusinessException;

function commercialInput(array $overrides = []): array
{
    return array_replace([
        'commissionPlan' => 'premium', 'commissionRate' => '8', 'transactionFeeRate' => '2',
        'payAtHotelEnabled' => true, 'noShowFeeEnabled' => true, 'merchantUpfrontRate' => '20',
        'effectiveAt' => '2026-11-17T18:00:00+08:00', 'reason' => '  Contract signed  ',
        'requestId' => 'commercial-unit-1', 'expectedVersion' => 0,
    ], $overrides);
}

MiniTest::add('CommercialTerms preview charges fee on commission and includes it once in customer payment', static function () {
    $terms = CommercialTerms::validate(commercialInput());
    MiniTest::assertSame('8.00', $terms['commission_rate']);
    MiniTest::assertSame('2026-11-17 10:00:00', $terms['effective_at']);
    MiniTest::assertSame('Contract signed', $terms['reason']);
    MiniTest::assertSame([
        'room_amount' => 10000000, 'commission_amount' => 800000, 'transaction_fee_amount' => 16000,
        'merchant_upfront_amount' => 2000000, 'customer_upfront_amount' => 2816000, 'hotel_balance_amount' => 7200000,
    ], CommercialTerms::preview($terms));
});
MiniTest::add('CommercialTerms accepts exact boundaries and no-show at zero', static function () {
    foreach ([['0', '0', 0], ['70', '30', 10140000], ['100', '0', 10200000]] as [$commission, $merchant, $upfront]) {
        $terms = CommercialTerms::validate(commercialInput(['commissionRate' => $commission, 'merchantUpfrontRate' => $merchant]));
        MiniTest::assertSame($upfront, CommercialTerms::preview($terms)['customer_upfront_amount']);
    }
    MiniTest::assertSame('100.00', CommercialTerms::validate(commercialInput(['transactionFeeRate' => 100]))['transaction_fee_rate']);
    MiniTest::assertSame(false, CommercialTerms::validate(commercialInput(['payAtHotelEnabled' => 0, 'noShowFeeEnabled' => 0, 'merchantUpfrontRate' => 0]))['pay_at_hotel_enabled']);
});
MiniTest::add('CommercialTerms rejects coercion precision overflow and invalid interlocks', static function () {
    foreach (['commissionRate', 'transactionFeeRate', 'merchantUpfrontRate'] as $field) {
        foreach ([null, true, false, '', 'abc', '1.001', 1.001, 1.0000000000000002, [], NAN, INF, -1, '101'] as $invalid) {
            MiniTest::assertThrows(BusinessException::class, fn () => CommercialTerms::validate(commercialInput([$field => $invalid])), 40001, $field);
        }
    }
    foreach ([
        ['merchantUpfrontRate' => '30.01'], ['commissionRate' => '80', 'merchantUpfrontRate' => '21'],
        ['payAtHotelEnabled' => false], ['noShowFeeEnabled' => false], ['payAtHotelEnabled' => 'false'],
        ['noShowFeeEnabled' => 2], ['commissionPlan' => null], ['commissionPlan' => 'foo'],
        ['reason' => '   '], ['reason' => str_repeat('x', 501)], ['requestId' => 'bad id'], ['requestId' => ''],
        ['expectedVersion' => -1], ['expectedVersion' => true], ['expectedVersion' => '1.2'],
    ] as $invalid) {
        MiniTest::assertThrows(BusinessException::class, fn () => CommercialTerms::validate(commercialInput($invalid)), 40001);
    }
});
MiniTest::add('CommercialTerms requires real datetime with timezone but permits backdating', static function () {
    foreach (['2026-11-17 10:00:00', '2026-11-17', '2026-02-30T00:00:00Z', '2026-11-17T25:00:00Z', 'next week', '0000-01-01T00:00:00Z', '9999-12-31T23:59:59-14:00', null] as $date) {
        MiniTest::assertThrows(BusinessException::class, fn () => CommercialTerms::validate(commercialInput(['effectiveAt' => $date])), 40001);
    }
    MiniTest::assertSame('2020-01-01 00:00:00', CommercialTerms::validate(commercialInput(['effectiveAt' => '2020-01-01T00:00:00Z']))['effective_at']);
});

MiniTest::add('CommercialTerms preview rounds fractional transaction fee once to cents', static function () {
    $terms = CommercialTerms::validate(commercialInput(['commissionRate' => '8.23', 'transactionFeeRate' => '1.79']));
    MiniTest::assertSame(823000, CommercialTerms::preview($terms)['commission_amount']);
    MiniTest::assertSame(14732, CommercialTerms::preview($terms)['transaction_fee_amount']);
    MiniTest::assertSame(2837732, CommercialTerms::preview($terms)['customer_upfront_amount']);
});

MiniTest::add('Pay at hotel PRD example balances room price plus one transaction fee', static function () {
    $terms = CommercialTerms::validate(commercialInput(['commissionRate' => '10', 'transactionFeeRate' => '2']));
    $amounts = CommercialTerms::preview($terms);
    MiniTest::assertSame(3020000, $amounts['customer_upfront_amount']);
    MiniTest::assertSame(7000000, $amounts['hotel_balance_amount']);
    MiniTest::assertSame(10020000, $amounts['customer_upfront_amount'] + $amounts['hotel_balance_amount']);
});

MiniTest::add('CommercialTerms never truncates a nonzero fractional effective second', static function () {
    foreach (['2026-11-17T10:00:00.001Z', '2026-11-17T18:00:00.999999+08:00'] as $date) {
        MiniTest::assertThrows(BusinessException::class, fn () => CommercialTerms::validate(commercialInput(['effectiveAt' => $date])), 40001);
    }
    MiniTest::assertSame('2026-11-17 10:00:00', CommercialTerms::validate(commercialInput(['effectiveAt' => '2026-11-17T10:00:00.000Z']))['effective_at']);
});
