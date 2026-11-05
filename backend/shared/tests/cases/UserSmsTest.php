<?php

declare(strict_types=1);

/**
 * UserSms:预订通知短信的模板渲染 + SMSPoh RESTful 发送接口的请求/响应口径
 */

use Mtrip\Shared\Support\SmsPohClient;
use Mtrip\Shared\Support\UserNotify;
use Mtrip\Shared\Support\UserSms;

MiniTest::add('通知短信:申请退款含金额、退款去向与预计到账时间(N_TC_018)', static function (): void {
    $params = UserNotify::orderParams(['goods_name' => 'Hotel S', 'order_no' => 'NS1'], ['amount' => 19500]);
    $text = UserSms::render('refund_requested', $params, 'MMK');
    MiniTest::assertSame('mTrip: Your cancellation for Hotel S (NS1) is received. Refund of MMK 19,500 will be credited to your mTrip Wallet, estimated 3-7 business days.', $text);
    MiniTest::assertTrue(str_contains((string) UserSms::render('refund_requested_original', $params, 'MMK'), 'original payment account'));
});

MiniTest::add('通知短信:退款完成 / 写评价提醒;非 MMK 币种保留两位小数', static function (): void {
    $params = UserNotify::orderParams(['goods_name' => 'Hotel S', 'order_no' => 'NS2'], ['amount' => '12.5']);
    MiniTest::assertSame('mTrip: Refund of EUR 12.50 for Hotel S (NS2) has been credited to your mTrip Wallet.', UserSms::render('refund_completed', $params, 'EUR'));
    MiniTest::assertTrue(str_contains((string) UserSms::render('review_request', $params, 'EUR'), 'Hotel S'));
});

MiniTest::add('通知短信:只对模板里的事件发,且模板只引用订单变量 + amount', static function (): void {
    MiniTest::assertSame(null, UserSms::render('booking_confirmed', []));
    $known = array_keys(UserNotify::orderParams([], ['amount' => 1]));
    foreach (UserSms::TEMPLATES as $event => $template) {
        MiniTest::assertTrue(isset(UserNotify::EVENTS[$event]), $event . ' 不是站内通知事件');
        preg_match_all('/\{(\w+)\}/', $template, $m);
        foreach ($m[1] as $var) {
            MiniTest::assertTrue(in_array($var, $known, true), $event . ' 引用了未知变量 ' . $var);
        }
    }
});

MiniTest::add('SMSPoh 发短信:201 + messageId 为成功;2xx 缺 messageId 按失败;401 带服务商原因', static function (): void {
    $ok = SmsPohClient::parseSendResponse(201, '{"messages":[{"messageId":"F5BR4DB","status":"Accepted"}]}');
    MiniTest::assertTrue($ok['ok']);
    MiniTest::assertSame('F5BR4DB', $ok['messageId']);
    MiniTest::assertTrue(! SmsPohClient::parseSendResponse(201, '{"messages":[]}')['ok']);
    $bad = SmsPohClient::parseSendResponse(401, '{"name":"Unauthorized","message":"Your request was made with invalid credentials.","status":401}');
    MiniTest::assertTrue(! $bad['ok']);
    MiniTest::assertSame(401, $bad['status']);
});

MiniTest::add('SMSPoh 发短信:JSON 体按 E.164 补国家码,走 REST 发送地址', static function (): void {
    $client = new class('KEY', 'SECRET', '95') extends SmsPohClient {
        public string $url = '';
        public array $payload = [];

        protected function httpPostJson(string $url, array $payload): array
        {
            $this->url = $url;
            $this->payload = $payload;
            return [201, '{"messages":[{"messageId":"M1"}]}'];
        }
    };
    $result = $client->sendMessage('9971183240', 'mTrip', 'hello', 'ref-1');
    MiniTest::assertTrue($result['ok']);
    MiniTest::assertSame(SmsPohClient::REST_SEND_URL, $client->url);
    MiniTest::assertSame(['to' => '+959971183240', 'message' => 'hello', 'from' => 'mTrip', 'clientReference' => 'ref-1'], $client->payload);
});
