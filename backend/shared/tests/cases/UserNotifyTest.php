<?php

declare(strict_types=1);

/**
 * UserNotify:C 端站内通知的英文兜底文案渲染与订单变量
 */

use Mtrip\Shared\Support\UserNotify;

MiniTest::add('站内通知:按事件模板替换变量', static function (): void {
    [$title, $body] = UserNotify::render('refund_completed', ['hotel' => 'Hotel A', 'orderNo' => 'N1', 'amount' => '50,000']);
    MiniTest::assertSame('Refund completed', $title);
    MiniTest::assertSame('A refund of 50,000 for Hotel A (N1) has been credited to your mTrip Wallet.', $body);
});

MiniTest::add('站内通知:缺失变量留空、非标量变量不输出', static function (): void {
    [, $body] = UserNotify::render('booking_cancelled', ['hotel' => ['x'], 'orderNo' => 'N2']);
    MiniTest::assertSame('Your booking at  (N2) has been cancelled.', $body);
});

MiniTest::add('站内通知:订单变量取酒店名/订单号/入离日期并合并额外变量', static function (): void {
    $params = UserNotify::orderParams(
        ['goods_name' => 'Hotel B', 'order_no' => 'N3', 'use_date' => '2026-10-01', 'end_date' => '2026-10-03'],
        ['amount' => 10],
    );
    MiniTest::assertSame(['hotel' => 'Hotel B', 'orderNo' => 'N3', 'checkIn' => '2026-10-01', 'checkOut' => '2026-10-03', 'amount' => 10], $params);
});

MiniTest::add('站内通知:订单类事件进 Booking 页签、申诉进 System 页签', static function (): void {
    foreach (['booking_confirmed', 'booking_cancelled', 'booking_expired', 'refund_requested', 'refund_completed', 'review_request'] as $event) {
        MiniTest::assertSame(UserNotify::BIZ_ORDER, UserNotify::EVENTS[$event][0]);
    }
    MiniTest::assertSame(UserNotify::BIZ_SYSTEM, UserNotify::EVENTS['appeal_result'][0]);
});

MiniTest::add('站内通知:KBZ 原路退款 / 迟到付款事件进 Booking 页签且渲染无残留占位符', static function (): void {
    $events = [
        'payment_late_recovered', 'payment_late_refunded', 'payment_late_refund_failed',
        'refund_requested_original', 'refund_completed_original', 'refund_completed_wallet_fallback',
    ];
    $params = UserNotify::orderParams(
        ['goods_name' => 'Hotel K', 'order_no' => 'NK1', 'use_date' => '2026-11-01', 'end_date' => '2026-11-02'],
        ['amount' => '120,000'],
    );
    foreach ($events as $event) {
        MiniTest::assertSame(UserNotify::BIZ_ORDER, UserNotify::EVENTS[$event][0]);
        [$title, $body] = UserNotify::render($event, $params);
        MiniTest::assertTrue($title !== '' && $body !== '', $event . ' 标题/正文为空');
        MiniTest::assertTrue(! str_contains($body, '{') && ! str_contains($body, '}'), $event . ' 残留占位符');
        MiniTest::assertTrue(str_contains($body, 'Hotel K') && str_contains($body, 'NK1'), $event . ' 缺酒店/订单号');
        // 模板只能引用 orderParams + amount 中真实存在的变量
        preg_match_all('/\{(\w+)\}/', UserNotify::EVENTS[$event][2], $m);
        foreach ($m[1] as $var) {
            MiniTest::assertTrue(array_key_exists($var, $params), $event . ' 引用了未知变量 ' . $var);
        }
    }
    [, $body] = UserNotify::render('refund_completed_original', $params);
    MiniTest::assertSame('A refund of 120,000 for Hotel K (NK1) has been returned to your original payment account.', $body);
});
