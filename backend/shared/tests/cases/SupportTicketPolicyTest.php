<?php

declare(strict_types=1);

use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\SupportTicketPolicy as SupportPolicy;

MiniTest::add('Support: terminal tickets require explicit reopening for either actor', static function () {
    foreach (['resolved', 'closed'] as $state) {
        foreach (['merchant', 'admin'] as $actor) {
            foreach (['reply', 'assign', 'priority', 'status'] as $action) {
                MiniTest::assertThrows(BusinessException::class, fn () => SupportPolicy::target($state, $actor, $action, 'in_progress'), 40901);
            }
            MiniTest::assertSame($actor === 'merchant' ? 'waiting_support' : 'open', SupportPolicy::target($state, $actor, 'reopen'));
            MiniTest::assertSame($actor === 'merchant' ? 'waiting_support' : 'in_progress', SupportPolicy::target($state, $actor, 'reopen', '', true));
        }
    }
});

MiniTest::add('Support: active workflow covers all six states without losing in-progress', static function () {
    foreach (['open', 'in_progress', 'waiting_merchant', 'waiting_support'] as $state) {
        MiniTest::assertSame('waiting_support', SupportPolicy::target($state, 'merchant', 'reply'));
        MiniTest::assertSame('waiting_merchant', SupportPolicy::target($state, 'admin', 'reply'));
        MiniTest::assertSame('resolved', SupportPolicy::target($state, 'admin', 'reply', 'resolved'));
        MiniTest::assertSame('closed', SupportPolicy::target($state, 'merchant', 'close'));
        foreach (['in_progress', 'waiting_merchant', 'waiting_support', 'resolved', 'closed'] as $target) {
            MiniTest::assertSame($target, SupportPolicy::target($state, 'admin', 'status', $target));
            MiniTest::assertThrows(BusinessException::class, fn () => SupportPolicy::target($state, 'merchant', 'status', $target), 40901);
        }
        MiniTest::assertThrows(BusinessException::class, fn () => SupportPolicy::target($state, 'merchant', 'reopen'), 40901);
    }
    MiniTest::assertSame('in_progress', SupportPolicy::target('open', 'admin', 'assign', '', true));
    MiniTest::assertSame('waiting_merchant', SupportPolicy::target('waiting_merchant', 'admin', 'assign', '', true));
    MiniTest::assertSame('closed', SupportPolicy::target('resolved', 'merchant', 'close'));
    MiniTest::assertThrows(BusinessException::class, fn () => SupportPolicy::target('closed', 'merchant', 'close'), 40901);
});

MiniTest::add('Support: malformed state, action and required fields cannot bypass policy', static function () {
    MiniTest::assertThrows(BusinessException::class, fn () => SupportPolicy::target('unknown', 'merchant', 'reply'), 40001);
    MiniTest::assertThrows(BusinessException::class, fn () => SupportPolicy::target('open', 'consumer', 'reply'), 40001);
    MiniTest::assertThrows(BusinessException::class, fn () => SupportPolicy::target('open', 'admin', 'delete'), 40901);
    foreach (['open', 'closed', 'waiting_support'] as $target) {
        MiniTest::assertThrows(BusinessException::class, fn () => SupportPolicy::target('open', 'admin', 'reply', $target), 40901);
    }
    foreach (['', '   ', ['unexpected'], str_repeat('x', 201)] as $subject) {
        MiniTest::assertThrows(BusinessException::class, fn () => SupportPolicy::text(['subject' => $subject], 'subject', 200), 40001);
    }
    foreach ([null, true, false, 0, -1, 1.1, '1.1', 'id'] as $id) {
        MiniTest::assertThrows(BusinessException::class, fn () => SupportPolicy::integer(['ticketId' => $id], 'ticketId'), 40001);
    }
    foreach (['support/tickets', 'support/create', 'support/reply', 'support/guides/list', 'support/attachments/download'] as $path) {
        foreach (['GET', 'POST'] as $method) MiniTest::assertSame(false, \Mtrip\Shared\Merchant\MerchantImpersonationGuard::allowed($method, '/api/v1/merchant/' . $path));
    }
});
