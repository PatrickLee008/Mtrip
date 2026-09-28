<?php

declare(strict_types=1);

/**
 * CouponEligibility:优惠券资格与分摊(PRD §17.5 / §17.6 的例子逐条落成用例)
 */

use Mtrip\Shared\Support\CouponEligibility as CE;

$today = '2026-10-01';
// 注意数组并集左侧优先:$extra 放左边才能覆盖默认值
$leg = static fn (int $property, int $room, float $amount, array $extra = []) => $extra + [
    'propertyId' => $property, 'roomTypeId' => $room, 'quantity' => 1,
    'nights' => 1, 'checkIn' => '2026-11-01', 'checkOut' => '2026-11-02', 'amount' => $amount,
];
$fixed = static fn (float $value, array $extra = []) => $extra + ['coupon_type' => 1, 'discount_value' => $value, 'goods_scope' => 0];

MiniTest::add('§17.6 固定金额券按合格房价占比分摊(50,000 / 150,000 → 5,000 / 15,000)', static function () use ($today, $leg, $fixed): void {
    $r = CE::evaluate($fixed(20000), [$leg(1, 10, 50000), $leg(1, 11, 150000)], 1, $today);
    MiniTest::assertTrue($r['eligible']);
    MiniTest::assertSame(20000.0, $r['discount']);
    MiniTest::assertSame([5000.0, 15000.0], $r['allocations']);
});

MiniTest::add('§17.6 指定房型券:Deluxe×2 + Suite×1 只分给 Deluxe', static function () use ($today, $leg, $fixed): void {
    $coupon = $fixed(9000, ['room_type_ids' => '[10]']);
    $r = CE::evaluate($coupon, [$leg(1, 10, 60000, ['quantity' => 2]), $leg(1, 20, 90000)], 1, $today);
    MiniTest::assertTrue($r['eligible']);
    MiniTest::assertSame([0], $r['eligibleLegs']);
    MiniTest::assertSame([9000.0, 0.0], $r['allocations']);
});

MiniTest::add('§17.6 指定酒店券:A + B 同单只分给 A', static function () use ($today, $leg, $fixed): void {
    $coupon = $fixed(5000, ['goods_scope' => 3, 'property_ids' => [1]]);
    $r = CE::evaluate($coupon, [$leg(1, 10, 40000), $leg(2, 30, 60000)], 1, $today);
    MiniTest::assertSame([5000.0, 0.0], $r['allocations']);
});

MiniTest::add('§17.5 百分比券按合格金额计并封顶(10% 最高 30,000)', static function () use ($today, $leg): void {
    $coupon = ['coupon_type' => 2, 'discount_value' => 9.0, 'max_discount' => 30000, 'goods_scope' => 0];
    $r = CE::evaluate($coupon, [$leg(1, 10, 200000), $leg(2, 30, 200000)], 1, $today);
    MiniTest::assertSame(30000.0, $r['discount']);
    MiniTest::assertSame(30000.0, array_sum($r['allocations']));
    $small = CE::evaluate($coupon, [$leg(1, 10, 100000)], 1, $today);
    MiniTest::assertSame(10000.0, $small['discount']);
});

MiniTest::add('§17.5 最少间数按合格行数:「A 酒店 + 至少 2 间」,A 只订 1 间则不可用', static function () use ($today, $leg, $fixed): void {
    $coupon = $fixed(5000, ['goods_scope' => 3, 'property_ids' => [1], 'min_room_count' => 2]);
    $r = CE::evaluate($coupon, [$leg(1, 10, 40000), $leg(2, 30, 60000, ['quantity' => 3])], 1, $today);
    MiniTest::assertTrue(! $r['eligible']);
    MiniTest::assertSame(CE::REASON_MIN_ROOMS, $r['reason']);
    $ok = CE::evaluate($coupon, [$leg(1, 10, 40000, ['quantity' => 2])], 1, $today);
    MiniTest::assertTrue($ok['eligible']);
});

MiniTest::add('§17.5 最少酒店数按整单(指定酒店券仍数全部酒店,但只分给指定酒店)', static function () use ($today, $leg, $fixed): void {
    $coupon = $fixed(5000, ['goods_scope' => 3, 'property_ids' => [1], 'min_hotel_count' => 2]);
    $one = CE::evaluate($coupon, [$leg(1, 10, 40000), $leg(1, 11, 40000)], 1, $today);
    MiniTest::assertSame(CE::REASON_MIN_HOTELS, $one['reason']);
    $two = CE::evaluate($coupon, [$leg(1, 10, 40000), $leg(2, 30, 60000)], 1, $today);
    MiniTest::assertTrue($two['eligible']);
    MiniTest::assertSame([5000.0, 0.0], $two['allocations']);
});

MiniTest::add('§17.5 门槛按合格金额:不合格行的金额不计入', static function () use ($today, $leg, $fixed): void {
    $coupon = $fixed(5000, ['room_type_ids' => [10], 'min_amount' => 100000]);
    $r = CE::evaluate($coupon, [$leg(1, 10, 60000), $leg(1, 20, 90000)], 1, $today);
    MiniTest::assertSame(CE::REASON_MIN_AMOUNT, $r['reason']);
    MiniTest::assertSame(60000.0, $r['eligibleAmount']);
});

MiniTest::add('§17.5 长住 / 提前预订 / 入住日期段逐行判定,不合格行不分摊', static function () use ($today, $leg, $fixed): void {
    $long = $fixed(3000, ['min_nights' => 3]);
    $r = CE::evaluate($long, [$leg(1, 10, 30000, ['nights' => 3, 'checkOut' => '2026-11-04']), $leg(2, 30, 50000)], 1, $today);
    MiniTest::assertSame([3000.0, 0.0], $r['allocations']);
    MiniTest::assertSame(CE::REASON_NIGHTS, CE::evaluate($long, [$leg(1, 10, 30000)], 1, $today)['reason']);
    MiniTest::assertSame(CE::REASON_NIGHTS, CE::evaluate($fixed(1, ['max_nights' => 2]), [$leg(1, 10, 1, ['nights' => 5])], 1, $today)['reason']);

    $early = $fixed(3000, ['book_advance_days' => 30]);
    MiniTest::assertTrue(CE::evaluate($early, [$leg(1, 10, 30000)], 1, $today)['eligible']); // 11-01 距 10-01 = 31 天
    MiniTest::assertSame(CE::REASON_ADVANCE, CE::evaluate($early, [$leg(1, 10, 30000, ['checkIn' => '2026-10-20'])], 1, $today)['reason']);

    $stay = $fixed(3000, ['stay_start' => '2026-11-01', 'stay_end' => '2026-11-03']);
    MiniTest::assertTrue(CE::evaluate($stay, [$leg(1, 10, 30000, ['checkOut' => '2026-11-04', 'nights' => 3])], 1, $today)['eligible']); // 最后一晚 11-03
    MiniTest::assertSame(CE::REASON_STAY_DATE, CE::evaluate($stay, [$leg(1, 10, 30000, ['checkOut' => '2026-11-05', 'nights' => 4])], 1, $today)['reason']);
});

MiniTest::add('缺日期/晚数的行跳过日期类条件(展示侧不误拦)', static function () use ($today, $fixed): void {
    $coupon = $fixed(3000, ['min_nights' => 3, 'book_advance_days' => 30, 'stay_start' => '2027-01-01']);
    $r = CE::evaluate($coupon, [['propertyId' => 1, 'roomTypeId' => 10, 'amount' => 30000]], 1, $today);
    MiniTest::assertTrue($r['eligible']);
});

MiniTest::add('全部行不合格:优先报过了范围校验那一行的原因;全都范围不符报 scope', static function () use ($today, $leg, $fixed): void {
    $coupon = $fixed(3000, ['goods_scope' => 3, 'property_ids' => [1], 'min_nights' => 5]);
    MiniTest::assertSame(CE::REASON_NIGHTS, CE::evaluate($coupon, [$leg(2, 30, 1000), $leg(1, 10, 1000)], 1, $today)['reason']);
    MiniTest::assertSame(CE::REASON_SCOPE, CE::evaluate($coupon, [$leg(2, 30, 1000)], 1, $today)['reason']);
    MiniTest::assertSame(CE::REASON_SCOPE, CE::evaluate($fixed(1, ['goods_scope' => 1]), [$leg(1, 10, 1000)], 2, $today)['reason']);
});

MiniTest::add('门票:按 goods_ids / sku_ids 判定,不做日期类条件', static function () use ($today, $fixed): void {
    $coupon = $fixed(10, ['goods_scope' => 3, 'goods_ids' => [7], 'sku_ids' => [70], 'min_nights' => 9]);
    $ok = CE::evaluate($coupon, [['goodsId' => 7, 'skuId' => 70, 'amount' => 50]], 2, $today);
    MiniTest::assertTrue($ok['eligible']);
    MiniTest::assertSame(10.0, $ok['discount']);
    MiniTest::assertSame(CE::REASON_SCOPE, CE::evaluate($coupon, [['goodsId' => 7, 'skuId' => 71, 'amount' => 50]], 2, $today)['reason']);
});

MiniTest::add('面额不超过合格金额;分摊末项吸收余数,Σ = 抵扣额', static function () use ($today, $leg, $fixed): void {
    $capped = CE::evaluate($fixed(99999), [$leg(1, 10, 1000)], 1, $today);
    MiniTest::assertSame(1000.0, $capped['discount']);
    $r = CE::evaluate($fixed(100), [$leg(1, 10, 1000), $leg(1, 11, 1000), $leg(1, 12, 1000)], 1, $today);
    MiniTest::assertSame(100.0, round(array_sum($r['allocations']), 2));
    MiniTest::assertSame([33.33, 33.33, 33.34], $r['allocations']);
});

MiniTest::add('conditionColumns:空值为不限,驼峰转列;非法值抛 40001', static function (): void {
    $cols = CE::conditionColumns(['minNights' => '3', 'maxNights' => '', 'bookAdvanceDays' => 30, 'minRoomCount' => 2, 'stayStart' => '2026-12-01', 'stayEnd' => '2026-12-31']);
    MiniTest::assertSame(['min_nights' => 3, 'max_nights' => 0, 'book_advance_days' => 30, 'min_room_count' => 2, 'min_hotel_count' => 0, 'stay_start' => '2026-12-01', 'stay_end' => '2026-12-31'], $cols);
    foreach ([['minNights' => -1], ['minNights' => 5, 'maxNights' => 3], ['minHotelCount' => 11], ['stayStart' => '12/01/2026'], ['stayStart' => '2026-12-31', 'stayEnd' => '2026-12-01']] as $bad) {
        $code = 0;
        try {
            CE::conditionColumns($bad);
        } catch (\Mtrip\Shared\Exception\BusinessException $e) {
            $code = $e->getCode();
        }
        MiniTest::assertSame(40001, $code, json_encode($bad));
    }
});
