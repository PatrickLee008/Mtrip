<?php

declare(strict_types=1);

/**
 * Consumer App PRD 模块 19 / 19.2:账户注销判定、DELETE 确认词、关联手机号 / 邮箱规范化
 */

use Mtrip\Shared\Account\AccountContact;
use Mtrip\Shared\Account\AccountDeletionPolicy;

MiniTest::add('注销确认词:必须一字不差为 DELETE(区分大小写、不容忍空格)', static function (): void {
    MiniTest::assertTrue(AccountDeletionPolicy::confirmed('DELETE'));
    foreach (['delete', 'Delete', ' DELETE', 'DELETE ', 'DELET', '', 'DELETE!'] as $bad) {
        MiniTest::assertSame(false, AccountDeletionPolicy::confirmed($bad), $bad);
    }
});

MiniTest::add('注销判定:无预订 + 余额 0 → 允许,不没收', static function (): void {
    $r = AccountDeletionPolicy::decide(0, 0, null);
    MiniTest::assertSame(true, $r['allowed']);
    MiniTest::assertSame([], $r['blockers']);
    MiniTest::assertSame(0, $r['forfeitCents']);
});

MiniTest::add('注销判定:有进行中预订 → 拦截(即使有客服批准)', static function (): void {
    $r = AccountDeletionPolicy::decide(1, 0, null);
    MiniTest::assertSame(false, $r['allowed']);
    MiniTest::assertSame([AccountDeletionPolicy::BLOCKER_BOOKING], $r['blockers']);
    $r = AccountDeletionPolicy::decide(2, 5000, 5000);
    MiniTest::assertSame([AccountDeletionPolicy::BLOCKER_BOOKING], $r['blockers']);
    MiniTest::assertSame(0, $r['forfeitCents']);
});

MiniTest::add('注销判定:余额 > 0 默认拦截;预订 + 余额两个原因同时列出', static function (): void {
    MiniTest::assertSame([AccountDeletionPolicy::BLOCKER_WALLET], AccountDeletionPolicy::decide(0, 1, null)['blockers']);
    MiniTest::assertSame(
        [AccountDeletionPolicy::BLOCKER_BOOKING, AccountDeletionPolicy::BLOCKER_WALLET],
        AccountDeletionPolicy::decide(3, 1000, null)['blockers'],
    );
});

MiniTest::add('注销判定:客服批准后余额不高于批准额 → 允许并没收全部余额;余额涨了须重新批准', static function (): void {
    $r = AccountDeletionPolicy::decide(0, 5000, 5000);
    MiniTest::assertSame(true, $r['allowed']);
    MiniTest::assertSame(5000, $r['forfeitCents']);
    MiniTest::assertSame(3000, AccountDeletionPolicy::decide(0, 3000, 5000)['forfeitCents']);
    $up = AccountDeletionPolicy::decide(0, 5001, 5000);
    MiniTest::assertSame(false, $up['allowed']);
    MiniTest::assertSame([AccountDeletionPolicy::BLOCKER_WALLET], $up['blockers']);
});

MiniTest::add('注销判定:进行中预订口径(待支付 / 已确认 / 已入住 / 退款处理中;旧数据看 order_status)', static function (): void {
    $ongoing = [
        ['booking_status' => 1, 'order_status' => 0],
        ['booking_status' => 2, 'order_status' => 1],
        ['booking_status' => 3, 'order_status' => 2],
        ['booking_status' => 5, 'order_status' => 5],
        ['booking_status' => 4, 'order_status' => 3, 'refund_status' => 1],
        ['booking_status' => 0, 'order_status' => 0],
        ['booking_status' => 0, 'order_status' => 1],
        ['booking_status' => 0, 'order_status' => 2],
    ];
    foreach ($ongoing as $row) {
        MiniTest::assertSame(true, AccountDeletionPolicy::isOngoingBooking($row), json_encode($row) ?: '');
    }
    $finished = [
        ['booking_status' => 4, 'order_status' => 3],
        ['booking_status' => 5, 'order_status' => 4],
        ['booking_status' => 5, 'order_status' => 6, 'refund_status' => 3],
        ['booking_status' => 6, 'order_status' => 1],
        ['booking_status' => 0, 'order_status' => 3],
        ['booking_status' => 0, 'order_status' => 7],
    ];
    foreach ($finished as $row) {
        MiniTest::assertSame(false, AccountDeletionPolicy::isOngoingBooking($row), json_encode($row) ?: '');
    }
});

MiniTest::add('关联手机号:+95 / 95 / 09 / 9 开头的缅甸号码统一成 9xxxxxxxx', static function (): void {
    MiniTest::assertSame('977700123', AccountContact::myanmarMobile('977700123'));
    MiniTest::assertSame('977700123', AccountContact::myanmarMobile('0977700123'));
    MiniTest::assertSame('977700123', AccountContact::myanmarMobile('+95 977700123'));
    MiniTest::assertSame('977700123', AccountContact::myanmarMobile('+95 0977700123'));
    MiniTest::assertSame('9771234567', AccountContact::myanmarMobile('959771234567'));
    MiniTest::assertSame('9771234567', AccountContact::myanmarMobile('+95-977-123-4567'));
    MiniTest::assertSame('91234567', AccountContact::myanmarMobile('91234567'));
});

MiniTest::add('关联手机号:非缅甸格式 / 其它国家码 / 含字母一律不合法', static function (): void {
    foreach (['', '12345678', '9123456', '+86 13800138000', '+1 9771234567', '97712345678', '9771x0123', 'abc'] as $bad) {
        MiniTest::assertSame(null, AccountContact::myanmarMobile($bad), $bad);
    }
});

MiniTest::add('关联手机号:查重候选覆盖历史写法', static function (): void {
    MiniTest::assertSame(['977700123', '0977700123', '95977700123', '+95977700123'], AccountContact::mobileCandidates('977700123'));
});

MiniTest::add('关联邮箱:去空白转小写;非法邮箱返回 null', static function (): void {
    MiniTest::assertSame('user@mtrip.com', AccountContact::email('  User@MTrip.com '));
    foreach (['', 'user', 'user@', '@mtrip.com', 'a b@mtrip.com', str_repeat('a', 250) . '@x.com'] as $bad) {
        MiniTest::assertSame(null, AccountContact::email($bad), $bad);
    }
});
