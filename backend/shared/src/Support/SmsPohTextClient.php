<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

/** SMSPoh V3 REST content API; independent of Verify OTP. Never returns echoed content. */
class SmsPohTextClient
{
    public function __construct(private readonly string $apiKey, private readonly string $apiSecret) {}

    public function send(string $phone, string $sender, string $message, string $reference): array
    {
        [$status, $body] = $this->httpPost(json_encode([
            'to' => $phone, 'from' => $sender, 'message' => $message, 'clientReference' => $reference,
        ], JSON_THROW_ON_ERROR));
        $data = json_decode($body, true);
        $receipt = $data['messages'][0] ?? [];
        $ok = $status >= 200 && $status < 300 && ($receipt['status'] ?? '') === 'Accepted'
            && ! ($receipt['test'] ?? false) && is_string($receipt['messageId'] ?? null) && $receipt['messageId'] !== '';
        return ['ok' => $ok, 'receipt' => $ok ? $receipt['messageId'] : '',
            'error' => $ok ? '' : 'smspoh_text_http_' . $status];
    }

    protected function httpPost(string $body): array
    {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'content' => $body, 'timeout' => 15, 'ignore_errors' => true, 'follow_location' => 0,
        ]]);
        stream_context_set_option($context, 'http', 'header', "Content-Type: application/json\r\nAccept: application/json\r\nAuthorization: Bearer "
            . SmsPohClient::accessToken($this->apiKey, $this->apiSecret));
        $response = @file_get_contents('https://v3.smspoh.com/api/rest/send', false, $context);
        $status = 0;
        foreach ($http_response_header ?? [] as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)/', $header, $matches)) $status = (int) $matches[1];
        }
        return [$status, $response === false ? '' : $response];
    }
}
