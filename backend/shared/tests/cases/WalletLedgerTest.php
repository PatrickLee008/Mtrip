<?php

declare(strict_types=1);

/**
 * 钱包账本(Super Admin PRD 模块 25):额度批次 FIFO 分摊、有效期 / 限额配置解析、到期时间
 */

use Mtrip\Shared\Wallet\WalletConfig;
use Mtrip\Shared\Wallet\WalletLedger;

MiniTest::add('钱包分摊:按批次顺序(到期最早优先)先扣满前一批再扣下一批', static function (): void {
    $lots = [['id' => 11, 'remaining' => 5000], ['id' => 12, 'remaining' => 3000], ['id' => 13, 'remaining' => 10000]];
    $r = WalletLedger::allocate($lots, 7000);
    MiniTest::assertSame([11 => 5000, 12 => 2000], $r['take']);
    MiniTest::assertSame(0, $r['uncovered']);
});

MiniTest::add('钱包分摊:刚好扣完 / 批次不足时差额记 uncovered / 跳过剩余为 0 的批次', static function (): void {
    MiniTest::assertSame([1 => 100], WalletLedger::allocate([['id' => 1, 'remaining' => 100]], 100)['take']);
    $short = WalletLedger::allocate([['id' => 1, 'remaining' => 0], ['id' => 2, 'remaining' => 300]], 500);
    MiniTest::assertSame([2 => 300], $short['take']);
    MiniTest::assertSame(200, $short['uncovered']);
    MiniTest::assertSame([], WalletLedger::allocate([], 0)['take']);
});

MiniTest::add('钱包金额按分计算:0.1 + 0.2 不出尾差,money 固定两位小数', static function (): void {
    MiniTest::assertSame(30, WalletLedger::cents(0.1) + WalletLedger::cents(0.2));
    MiniTest::assertSame('19500.00', WalletLedger::money(WalletLedger::cents('19500')));
    MiniTest::assertSame('-0.05', WalletLedger::money(-5));
});

MiniTest::add('钱包有效天数:空 / 非数字取默认 365,负数视为 0(永不过期),上限 3650', static function (): void {
    MiniTest::assertSame(365, WalletConfig::parseValidityDays(null));
    MiniTest::assertSame(365, WalletConfig::parseValidityDays('abc'));
    MiniTest::assertSame(180, WalletConfig::parseValidityDays(' 180 '));
    MiniTest::assertSame(0, WalletConfig::parseValidityDays('-1'));
    MiniTest::assertSame(3650, WalletConfig::parseValidityDays('99999'));
});

MiniTest::add('钱包到期时间:按入账时刻加天数;0 天返回 null(永不过期)', static function (): void {
    $now = new DateTimeImmutable('2026-11-11 10:00:00');
    MiniTest::assertSame('2027-11-11 10:00:00', WalletConfig::expiresAt(365, $now));
    MiniTest::assertSame('2027-05-10 10:00:00', WalletConfig::expiresAt(180, $now));
    MiniTest::assertSame(null, WalletConfig::expiresAt(0, $now));
});

MiniTest::add('钱包单笔限额:空 / 非数字 / 负数为 0(不限),保留两位小数', static function (): void {
    MiniTest::assertSame(0.0, WalletConfig::parseAmount(null));
    MiniTest::assertSame(0.0, WalletConfig::parseAmount('-50'));
    MiniTest::assertSame(50000.0, WalletConfig::parseAmount('50000'));
    MiniTest::assertSame(0.0, WalletConfig::parseAmount('x'));
});
