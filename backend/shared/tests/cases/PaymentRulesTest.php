<?php

declare(strict_types=1);

/**
 * 统一支付中心纯规则单测(方案 22 阶段 4):状态映射、pay_no、timeout_express、金额、退避、站点回溯、退款校验
 */

use Mtrip\Shared\Payment\PaymentRules;

MiniTest::add('支付规则:状态码与字符串映射', static function (): void {
    MiniTest::assertSame('pending', PaymentRules::payStatusName(0));
    MiniTest::assertSame('paid', PaymentRules::payStatusName(1));
    MiniTest::assertSame('failed', PaymentRules::payStatusName(2));
    MiniTest::assertSame('closed', PaymentRules::payStatusName(3));
    MiniTest::assertSame('late', PaymentRules::payStatusName(5));
    MiniTest::assertSame('unknown', PaymentRules::payStatusName(4));
    MiniTest::assertSame('processing', PaymentRules::refundStatusName(0));
    MiniTest::assertSame('succeeded', PaymentRules::refundStatusName(1));
    MiniTest::assertSame('failed', PaymentRules::refundStatusName(2));
});

MiniTest::add('支付规则:KBZ trade_status / refund_status 映射', static function (): void {
    MiniTest::assertSame(PaymentRules::PAY_PAID, PaymentRules::mapTradeStatus('PAY_SUCCESS'));
    MiniTest::assertSame(PaymentRules::PAY_FAILED, PaymentRules::mapTradeStatus('PAY_FAILED'));
    MiniTest::assertSame(PaymentRules::PAY_CLOSED, PaymentRules::mapTradeStatus('ORDER_EXPIRED'));
    MiniTest::assertSame(PaymentRules::PAY_CLOSED, PaymentRules::mapTradeStatus('order_closed'));
    MiniTest::assertSame(PaymentRules::PAY_PENDING, PaymentRules::mapTradeStatus('WAIT_PAY'));
    MiniTest::assertSame(PaymentRules::PAY_PENDING, PaymentRules::mapTradeStatus('PAYING'));
    MiniTest::assertSame(null, PaymentRules::mapTradeStatus('SOMETHING'));
    MiniTest::assertSame(null, PaymentRules::mapTradeStatus(''));
    MiniTest::assertSame(PaymentRules::REFUND_SUCCEEDED, PaymentRules::mapRefundStatus('REFUND_SUCCESS'));
    MiniTest::assertSame(PaymentRules::REFUND_PROCESSING, PaymentRules::mapRefundStatus('REFUNDING'));
    MiniTest::assertSame(PaymentRules::REFUND_FAILED, PaymentRules::mapRefundStatus('REFUND_FAILED'));
    MiniTest::assertSame(null, PaymentRules::mapRefundStatus('X'));
});

MiniTest::add('支付规则:pay_no 生成与格式校验', static function (): void {
    $now = gmmktime(8, 9, 10, 10, 27, 2026);
    $no = PaymentRules::generatePayNo($now);
    MiniTest::assertSame(19, strlen($no), '长度');
    MiniTest::assertTrue(str_starts_with($no, 'P261027080910'), '前缀为 UTC 时间:' . $no);
    MiniTest::assertTrue(PaymentRules::isValidPayNo($no), '生成值合法');
    MiniTest::assertTrue(preg_match('/^[A-Za-z0-9_]{1,40}$/', $no) === 1, '满足 KBZ merch_order_id');
    MiniTest::assertTrue(! PaymentRules::isValidPayNo('P26102708091012345'), '少一位');
    MiniTest::assertTrue(! PaymentRules::isValidPayNo('X261027080910123456'), '前缀');
    MiniTest::assertTrue(! PaymentRules::isValidPayNo("P261027080910123456\n"), '换行');
    MiniTest::assertTrue(! PaymentRules::isValidPayNo("' OR 1=1"), '注入');
    MiniTest::assertTrue(PaymentRules::isValidRefundNo('R_20261027_001'));
    MiniTest::assertTrue(! PaymentRules::isValidRefundNo(str_repeat('a', 33)), '超 32');
    MiniTest::assertTrue(! PaymentRules::isValidRefundNo('R-1'), '连字符');
});

MiniTest::add('支付规则:timeout_express = min(剩余分钟-1, 120),<1 拒绝', static function (): void {
    $now = 1_800_000_000;
    MiniTest::assertSame(29, PaymentRules::timeoutMinutes($now + 30 * 60, $now), '30 分钟窗口');
    MiniTest::assertSame(28, PaymentRules::timeoutMinutes($now + 29 * 60 + 59, $now), '向下取整');
    MiniTest::assertSame(120, PaymentRules::timeoutMinutes($now + 600 * 60, $now), '上限 120');
    MiniTest::assertSame(120, PaymentRules::timeoutMinutes($now + 121 * 60, $now), '121 分钟 → 120');
    MiniTest::assertSame(119, PaymentRules::timeoutMinutes($now + 120 * 60, $now), '120 分钟 → 119');
    MiniTest::assertSame(1, PaymentRules::timeoutMinutes($now + 120, $now), '2 分钟 → 1');
    MiniTest::assertSame(0, PaymentRules::timeoutMinutes($now + 119, $now), '不足 2 分钟 → 0(拒绝)');
    MiniTest::assertTrue(PaymentRules::timeoutMinutes($now - 600, $now) < 1, '已过期 → 拒绝');
    MiniTest::assertSame('29m', PaymentRules::timeoutExpress(29));
    MiniTest::assertThrows(InvalidArgumentException::class, static fn () => PaymentRules::timeoutExpress(0));
    MiniTest::assertThrows(InvalidArgumentException::class, static fn () => PaymentRules::timeoutExpress(121));
});

MiniTest::add('支付规则:金额字符串十进制比较', static function (): void {
    MiniTest::assertSame(1500000, PaymentRules::toCents('15000'));
    MiniTest::assertSame(1500000, PaymentRules::toCents('15000.00'));
    MiniTest::assertSame(1500000, PaymentRules::toCents('15000.000'), '尾零不算有效小数');
    MiniTest::assertSame(1050, PaymentRules::toCents('10.5'));
    MiniTest::assertSame(1500000, PaymentRules::toCents(15000));
    MiniTest::assertSame(1050, PaymentRules::toCents(10.5));
    MiniTest::assertSame(null, PaymentRules::toCents('1.005'), '3 位有效小数');
    MiniTest::assertSame(null, PaymentRules::toCents('-1'));
    MiniTest::assertSame(null, PaymentRules::toCents('1e3'));
    MiniTest::assertSame(null, PaymentRules::toCents(''));
    MiniTest::assertSame(null, PaymentRules::toCents(null));
    MiniTest::assertTrue(PaymentRules::amountEquals('15000', '15000.00'), '15000 == 15000.00');
    MiniTest::assertTrue(PaymentRules::amountEquals('15000.0', 15000));
    MiniTest::assertTrue(! PaymentRules::amountEquals('15000', '15000.01'), '差 1 分');
    MiniTest::assertTrue(! PaymentRules::amountEquals('abc', 'abc'), '非法不等');
    MiniTest::assertSame('15000.00', PaymentRules::normalizeAmount('15000'));
    MiniTest::assertSame('0.05', PaymentRules::fromCents(5));
    MiniTest::assertSame(null, PaymentRules::normalizeAmount('x'));
});

MiniTest::add('支付规则:绑定限额(0 = 不限)', static function (): void {
    MiniTest::assertTrue(PaymentRules::amountInRange(100, 0, 0));
    MiniTest::assertTrue(PaymentRules::amountInRange(100, 100, 100), '边界含');
    MiniTest::assertTrue(! PaymentRules::amountInRange(99, 100, 0), '低于最小');
    MiniTest::assertTrue(! PaymentRules::amountInRange(101, 0, 100), '超过最大');
});

MiniTest::add('支付规则:业务通知退避 1,2,5,10,30,60,120… 上限 10 次', static function (): void {
    MiniTest::assertSame(1, PaymentRules::notifyBackoffMinutes(1));
    MiniTest::assertSame(2, PaymentRules::notifyBackoffMinutes(2));
    MiniTest::assertSame(5, PaymentRules::notifyBackoffMinutes(3));
    MiniTest::assertSame(10, PaymentRules::notifyBackoffMinutes(4));
    MiniTest::assertSame(30, PaymentRules::notifyBackoffMinutes(5));
    MiniTest::assertSame(60, PaymentRules::notifyBackoffMinutes(6));
    MiniTest::assertSame(120, PaymentRules::notifyBackoffMinutes(7));
    MiniTest::assertTrue(PaymentRules::notifyBackoffMinutes(9) !== null, '第 9 次失败仍重试');
    MiniTest::assertSame(null, PaymentRules::notifyBackoffMinutes(10), '第 10 次失败耗尽');
    MiniTest::assertSame(null, PaymentRules::notifyBackoffMinutes(11));
});

MiniTest::add('支付规则:站点树回溯顺序(含全局 0,防环)', static function (): void {
    $parents = [12 => 3, 3 => 1, 1 => 0, 7 => 8, 8 => 7, 20 => 20];
    MiniTest::assertSame([12, 3, 1, 0], PaymentRules::siteCandidates(12, $parents), '城市 → 国家 → 全球 → 0');
    MiniTest::assertSame([1, 0], PaymentRules::siteCandidates(1, $parents));
    MiniTest::assertSame([0], PaymentRules::siteCandidates(0, $parents), '超管/全局');
    MiniTest::assertSame([99, 0], PaymentRules::siteCandidates(99, $parents), '未知站点直接回全局');
    MiniTest::assertSame([7, 8, 0], PaymentRules::siteCandidates(7, $parents), '环 7↔8');
    MiniTest::assertSame([20, 0], PaymentRules::siteCandidates(20, $parents), '自环');
    $chain = [];
    for ($i = 100; $i < 200; ++$i) {
        $chain[$i] = $i + 1;
    }
    MiniTest::assertSame(PaymentRules::MAX_SITE_DEPTH + 1, count(PaymentRules::siteCandidates(100, $chain)), '深度上限');
});

MiniTest::add('支付规则:UTC 时间严格解析', static function (): void {
    $ts = PaymentRules::parseUtc('2026-10-27 08:09:10');
    MiniTest::assertSame(gmmktime(8, 9, 10, 10, 27, 2026), $ts);
    MiniTest::assertSame('2026-10-27 08:09:10', PaymentRules::formatUtc((int) $ts));
    MiniTest::assertSame(null, PaymentRules::parseUtc('2026-10-27'), '缺时间');
    MiniTest::assertSame(null, PaymentRules::parseUtc('2026-02-30 00:00:00'), '非法日期不得溢出');
    MiniTest::assertSame(null, PaymentRules::parseUtc('2026-10-27T08:09:10Z'), 'ISO 格式不收');
    MiniTest::assertSame(null, PaymentRules::parseUtc(null));
});

MiniTest::add('支付规则:退款次数与累计金额校验', static function (): void {
    MiniTest::assertSame(null, PaymentRules::checkRefund(10000, 0, 0, 10000), '全额');
    MiniTest::assertSame(null, PaymentRules::checkRefund(10000, 4000, 1, 6000), '部分后退剩余');
    MiniTest::assertTrue(PaymentRules::checkRefund(10000, 4000, 1, 6001) !== null, '超额');
    MiniTest::assertTrue(PaymentRules::checkRefund(10000, 3000, 3, 100) !== null, '已 3 次');
    MiniTest::assertSame(null, PaymentRules::checkRefund(10000, 3000, 2, 100), '第 3 次允许');
    MiniTest::assertTrue(PaymentRules::checkRefund(10000, 0, 0, 0) !== null, '0 元');
});
