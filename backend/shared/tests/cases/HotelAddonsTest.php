<?php

declare(strict_types=1);

/**
 * HotelAddons:附加服务配置归一化与计价(单价 × 选中维度乘积)
 */

use Mtrip\Shared\Support\HotelAddons as HA;

$config = [
    ['key' => 'breakfast', 'enabled' => true, 'price' => 10000, 'units' => ['night', 'person']],
    ['key' => 'airport_transfer', 'enabled' => true, 'price' => 30000, 'units' => []],
    ['key' => 'extra_bed', 'enabled' => true, 'price' => 15000, 'units' => ['room', 'night']],
    ['key' => 'spa', 'enabled' => false, 'price' => 50000, 'units' => ['person']],
];

MiniTest::add('附加服务:归一化补齐固定 7 项且计价方式按固定顺序去重', static function () use ($config): void {
    $rows = HA::normalize($config);
    MiniTest::assertSame(HA::KEYS, array_column($rows, 'key'));
    MiniTest::assertSame(['person', 'night'], $rows[0]['units']);
    MiniTest::assertSame(false, $rows[6]['enabled']);
});

MiniTest::add('附加服务:按人+按晚 = 单价×人数×晚数;都不选 = 按次', static function () use ($config): void {
    $q = HA::quote($config, ['breakfast', 'airport_transfer'], 2, 3, 1);
    MiniTest::assertSame(60000.0, $q['items'][0]['amount']);
    MiniTest::assertSame(30000.0, $q['items'][1]['amount']);
    MiniTest::assertSame(90000.0, $q['amount']);
});

MiniTest::add('附加服务:按间+按晚 = 单价×间数×晚数', static function () use ($config): void {
    MiniTest::assertSame(90000.0, HA::quote($config, ['extra_bed'], 4, 2, 3)['amount']);
});

MiniTest::add('附加服务:选了停用或不存在的项直接拒绝', static function () use ($config): void {
    foreach ([['spa'], ['laundry'], ['insurance']] as $keys) {
        $thrown = false;
        try {
            HA::quote($config, $keys, 1, 1, 1);
        } catch (InvalidArgumentException) {
            $thrown = true;
        }
        MiniTest::assertTrue($thrown);
    }
});

MiniTest::add('附加服务:严格模式拒绝未知项与「启用但价格为 0」;宽松模式按停用处理', static function (): void {
    foreach ([[['key' => 'insurance', 'enabled' => true, 'price' => 1]], [['key' => 'spa', 'enabled' => true, 'price' => 0]]] as $bad) {
        $thrown = false;
        try {
            HA::normalize($bad);
        } catch (InvalidArgumentException) {
            $thrown = true;
        }
        MiniTest::assertTrue($thrown);
    }
    MiniTest::assertSame([], HA::enabled([['key' => 'spa', 'enabled' => true, 'price' => 0]]));
});
