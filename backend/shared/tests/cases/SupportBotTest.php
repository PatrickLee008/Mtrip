<?php

declare(strict_types=1);

use App\Chat\SupportBot;

if (is_file(__DIR__ . '/../../../services/user-service/app/Chat/SupportBot.php')) {
    require_once __DIR__ . '/../../../services/user-service/app/Chat/SupportBot.php';
}

MiniTest::add('SupportBot: class is available', static function (): void {
    MiniTest::assertTrue(class_exists(SupportBot::class));
});

if (! class_exists(SupportBot::class)) {
    return;
}

function supportBotFaqs(): array
{
    $row = static fn (string $key, string $scene, string $keywords, int $handoff = 0, string $q = 'Q', int $sort = 0) =>
        ['site_id' => 0, 'faq_key' => $key, 'scene' => $scene, 'language' => 'en-US', 'question' => $q, 'answer' => 'A:' . $key, 'keywords' => $keywords, 'handoff' => $handoff, 'sort' => $sort];
    return [
        $row('general_refund', 'general', 'refund,money back', 0, 'Refund?', 30),
        $row('general_change', 'general', 'cancel,change', 0, 'Change?', 10),
        $row('cancelled_refund', 'cancelled', 'refund', 0, 'Cancelled refund?', 10),
        $row('upcoming_cancel_policy', 'upcoming', 'cancellation policy,cancel', 0, 'Policy?', 20),
        $row('general_payment', 'general', 'pay with,kbz', 0, 'Pay?', 20),
        $row('trigger_agent', 'trigger', 'agent,human', 2, ''),
        $row('trigger_dispute', 'trigger', 'complaint,charged twice', 1, ''),
        $row('zh_refund', 'general', '退款', 0, '退款?', 40),
        $row('system_fallback', 'system', '', 1, ''),
    ];
}

MiniTest::add('SupportBot: booking status maps to scene', static function (): void {
    MiniTest::assertSame('general', SupportBot::scene(null, '2026-11-17'));
    MiniTest::assertSame('payment', SupportBot::scene(['order_status' => 0], '2026-11-17'));
    MiniTest::assertSame('upcoming', SupportBot::scene(['order_status' => 1, 'end_date' => '2026-11-20'], '2026-11-17'));
    MiniTest::assertSame('completed', SupportBot::scene(['order_status' => 1, 'end_date' => '2026-11-10'], '2026-11-17'));
    MiniTest::assertSame('in_stay', SupportBot::scene(['order_status' => 2], '2026-11-17'));
    MiniTest::assertSame('completed', SupportBot::scene(['order_status' => 3], '2026-11-17'));
    MiniTest::assertSame('cancelled', SupportBot::scene(['order_status' => 6], '2026-11-17'));
    MiniTest::assertTrue(SupportBot::isCurrent('in_stay'));
    MiniTest::assertTrue(! SupportBot::isCurrent('completed'));
});

MiniTest::add('SupportBot: language header normalised', static function (): void {
    MiniTest::assertSame('zh-CN', SupportBot::language('zh-CN'));
    MiniTest::assertSame('my-MM', SupportBot::language('my'));
    MiniTest::assertSame('en-US', SupportBot::language(''));
});

MiniTest::add('SupportBot: dedupe prefers requested language then site row', static function (): void {
    $rows = [
        ['site_id' => 0, 'faq_key' => 'a', 'language' => 'en-US', 'sort' => 1, 'answer' => 'en'],
        ['site_id' => 0, 'faq_key' => 'a', 'language' => 'zh-CN', 'sort' => 1, 'answer' => 'zh'],
        ['site_id' => 7, 'faq_key' => 'a', 'language' => 'en-US', 'sort' => 1, 'answer' => 'site-en'],
        ['site_id' => 0, 'faq_key' => 'b', 'language' => 'en-US', 'sort' => 0, 'answer' => 'b-en'],
    ];
    $zh = SupportBot::dedupe($rows, 'zh-CN');
    MiniTest::assertSame(['b-en', 'zh'], array_column($zh, 'answer'));
    $en = SupportBot::dedupe($rows, 'en-US');
    MiniTest::assertSame('site-en', $en[1]['answer']);
});

MiniTest::add('SupportBot: suggestions put booking scene first then general', static function (): void {
    $faqs = SupportBot::dedupe(supportBotFaqs());
    $keys = array_column(SupportBot::suggestions($faqs, 'upcoming', 3), 'key');
    MiniTest::assertSame(['upcoming_cancel_policy', 'general_change', 'general_payment'], $keys);
    $general = array_column(SupportBot::suggestions($faqs, 'general'), 'key');
    MiniTest::assertTrue(! in_array('trigger_agent', $general, true) && ! in_array('system_fallback', $general, true));
});

MiniTest::add('SupportBot: keyword matching and priorities', static function (): void {
    $faqs = supportBotFaqs();
    MiniTest::assertSame('cancelled_refund', SupportBot::match($faqs, 'Where are my REFUNDS?', 'cancelled')['faq_key']);
    MiniTest::assertSame('general_refund', SupportBot::match($faqs, 'refund please', 'upcoming')['faq_key']);
    MiniTest::assertSame('upcoming_cancel_policy', SupportBot::match($faqs, 'what is the cancellation policy', 'general')['faq_key']);
    MiniTest::assertSame('trigger_agent', SupportBot::match($faqs, 'I want a refund, let me talk to a human', 'general')['faq_key']);
    MiniTest::assertSame('trigger_dispute', SupportBot::match($faqs, 'I was charged twice!', 'general')['faq_key']);
    MiniTest::assertSame('zh_refund', SupportBot::match($faqs, '我的退款呢', 'general')['faq_key']);
    MiniTest::assertSame(null, SupportBot::match($faqs, 'I paid via paypal', 'general'));
    MiniTest::assertSame(null, SupportBot::match($faqs, 'hello there', 'general'));
    MiniTest::assertSame('general_payment', SupportBot::match($faqs, 'anything', 'general', 'general_payment')['faq_key']);
    MiniTest::assertSame(null, SupportBot::match($faqs, '', 'general', 'system_fallback'));
});
