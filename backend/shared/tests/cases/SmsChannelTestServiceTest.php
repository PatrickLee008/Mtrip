<?php

declare(strict_types=1);

use App\Service\SmsChannelTestService;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\SmsPohClient;

require_once __DIR__ . '/../../../services/system-service/app/Service/SmsChannelTestService.php';

final class SmsChannelTestSenderStub extends SmsChannelTestService
{
    public array $response = [201, '{"sid":"SM123"}'];
    public array $calls = [];

    protected function httpPost(string $url, string $authorization, array $params): array
    {
        $this->calls[] = [$url, $authorization, $params];
        return $this->response;
    }

    protected function smsPohClient(string $key, string $secret): SmsPohClient
    {
        return new class($key, $secret) extends SmsPohClient {
            public function requestOtp(string $to, string $from, string $brand, array $extra = []): array
            {
                MiniTest::assertSame('TOKEN', $this->apiKey);
                MiniTest::assertSame('SECRET', $this->apiSecret);
                MiniTest::assertSame('+959771234567', $to);
                MiniTest::assertSame('mTrip', $from);
                MiniTest::assertSame('Travel', $brand);
                MiniTest::assertSame(['ttl' => 600, 'pinLength' => 4, 'maxInvalidAttempts' => 3], $extra);
                return ['ok' => true, 'status' => 201, 'requestId' => 'otp123'];
            }
        };
    }
}

function smsChannelTestFixture(string $provider = 'twilio'): array
{
    return ['provider_code' => $provider, 'api_key' => CryptoHelper::encrypt('TOKEN', 'test-key'),
        'api_secret' => CryptoHelper::encrypt('SECRET', 'test-key'), 'account_sid' => 'AC' . str_repeat('a', 32),
        'sign_name' => 'mTrip', 'brand_name' => 'Travel', 'code_expire_sec' => 600,
        'pin_length' => 4, 'max_invalid_attempts' => 3];
}

MiniTest::add('SMS channel test: Twilio uses saved SID/token and text', static function (): void {
    $sender = new SmsChannelTestSenderStub();
    $result = $sender->send(smsChannelTestFixture(), 'test-key', '+959771234567', 'Test & +');
    MiniTest::assertTrue($result['ok']);
    MiniTest::assertSame('SM123', $result['requestId']);
    MiniTest::assertSame('https://api.twilio.com/2010-04-01/Accounts/AC' . str_repeat('a', 32) . '/Messages.json', $sender->calls[0][0]);
    MiniTest::assertSame('Basic ' . base64_encode('AC' . str_repeat('a', 32) . ':TOKEN'), $sender->calls[0][1]);
    MiniTest::assertSame(['To' => '+959771234567', 'From' => 'mTrip', 'Body' => 'Test & +'], $sender->calls[0][2]);
});

MiniTest::add('SMS channel test: MessageBird uses access key and international digits', static function (): void {
    $sender = new SmsChannelTestSenderStub();
    $sender->response = [201, '{"id":"bird123"}'];
    $result = $sender->send(smsChannelTestFixture('messagebird'), 'test-key', '+959771234567', 'Hello');
    MiniTest::assertTrue($result['ok']);
    MiniTest::assertSame('bird123', $result['requestId']);
    MiniTest::assertSame(['https://rest.messagebird.com/messages', 'AccessKey TOKEN',
        ['recipients' => '959771234567', 'originator' => 'mTrip', 'body' => 'Hello']], $sender->calls[0]);
});

MiniTest::add('SMS channel test: SMSPoh forwards saved OTP settings', static function (): void {
    $sender = new SmsChannelTestSenderStub();
    $result = $sender->send(smsChannelTestFixture('smspoh'), 'test-key', '+959771234567', '');
    MiniTest::assertTrue($result['ok']);
    MiniTest::assertSame('otp123', $result['requestId']);
    MiniTest::assertSame([], $sender->calls);
});

MiniTest::add('SMS channel test: invalid input never reaches provider', static function (): void {
    $sender = new SmsChannelTestSenderStub();
    foreach (['', '09771234567', '+0001234567', '+959771234567x', '+959771234567\n'] as $mobile) {
        MiniTest::assertThrows(BusinessException::class, fn () => $sender->send(smsChannelTestFixture(), 'test-key', $mobile, 'Hi'), ErrorCode::PARAM_ERROR);
    }
    foreach (['', str_repeat('a', 1001)] as $text) {
        MiniTest::assertThrows(BusinessException::class, fn () => $sender->send(smsChannelTestFixture(), 'test-key', '+959771234567', $text), ErrorCode::PARAM_ERROR);
    }
    MiniTest::assertSame([], $sender->calls);
});

MiniTest::add('SMS channel test: invalid saved credentials never reach provider', static function (): void {
    $sender = new SmsChannelTestSenderStub();
    foreach (['api_key' => '', 'sign_name' => '', 'account_sid' => '../other-account'] as $field => $value) {
        $channel = smsChannelTestFixture();
        $channel[$field] = $value;
        MiniTest::assertThrows(BusinessException::class, fn () => $sender->send($channel, 'test-key', '+959771234567', 'Hi'), ErrorCode::PARAM_ERROR);
    }
    MiniTest::assertThrows(BusinessException::class, fn () => $sender->send(smsChannelTestFixture(), 'wrong-key', '+959771234567', 'Hi'), ErrorCode::PARAM_ERROR);
    MiniTest::assertSame([], $sender->calls);
});

MiniTest::add('SMS channel test: reject errors, timeouts, malformed or incomplete success', static function (): void {
    $sender = new SmsChannelTestSenderStub();
    foreach ([[401, '{"message":"TOKEN +959771234567"}'], [0, ''], [200, 'invalid'], [200, '{}'],
        [201, '{"sid":"SM123","status":"failed"}']] as $response) {
        $sender->response = $response;
        $result = $sender->send(smsChannelTestFixture(), 'test-key', '+959771234567', 'Hi');
        MiniTest::assertSame(false, $result['ok']);
        MiniTest::assertSame('', $result['requestId']);
        MiniTest::assertTrue(!str_contains($result['message'], 'TOKEN') && !str_contains($result['message'], '+959771234567'));
    }
});
