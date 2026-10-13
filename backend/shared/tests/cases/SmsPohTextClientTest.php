<?php

declare(strict_types=1);

use Mtrip\Shared\Support\SmsPohTextClient;

class FakeSmsPohTextClient extends SmsPohTextClient
{
    public array $response = [201, '{"messages":[{"messageId":"receipt-1","status":"Accepted","test":false}]}'];
    public array $payload = [];
    protected function httpPost(string $body): array
    {
        $this->payload = json_decode($body, true);
        return $this->response;
    }
}

MiniTest::add('SMSPoh text uses separate JSON content contract and only exposes receipt', static function (): void {
    $client = new FakeSmsPohTextClient('key', 'secret');
    $result = $client->send('+95912345678', 'mTrip', 'credential-fixture', 'request-1');
    MiniTest::assertSame(['to' => '+95912345678', 'from' => 'mTrip', 'message' => 'credential-fixture', 'clientReference' => 'request-1'], $client->payload);
    MiniTest::assertSame(['ok' => true, 'receipt' => 'receipt-1', 'error' => ''], $result);
    foreach ([[401, '{"message":"credential-fixture secret echoed"}'], [201, '{"messages":[{"status":"Accepted","test":false}]}'],
        [201, '{"messages":[{"messageId":"r","status":"Accepted","test":true}]}'], [201, '{"messages":[{"messageId":"r","status":"Rejected"}]}'], [0, '']] as $response) {
        $client->response = $response;
        $result = $client->send('+95912345678', 'mTrip', 'credential-fixture', 'request-1');
        MiniTest::assertSame(false, $result['ok']);
        MiniTest::assertSame(false, str_contains(json_encode($result), 'credential-fixture'));
    }
});
