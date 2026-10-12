<?php

declare(strict_types=1);

namespace App\Service;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\SmsPohClient;

class SmsChannelTestService
{
    public function send(array $channel, string $aesKey, string $mobile, string $content): array
    {
        if (preg_match('/^\+[1-9]\d{6,14}$/D', $mobile) !== 1) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请输入带国家码的手机号，如 +959xxxxxxxxx');
        }
        $provider = (string) $channel['provider_code'];
        if (! in_array($provider, ['smspoh', 'twilio', 'messagebird'], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '不支持该短信服务商');
        }
        if ($provider !== 'smspoh' && ($content === '' || mb_strlen($content) > 1000)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '测试短信内容须为 1 至 1000 个字符');
        }
        $key = $this->decrypt((string) ($channel['api_key'] ?? ''), $aesKey);
        $from = trim((string) ($channel['sign_name'] ?? ''));
        if ($key === '' || $from === '' || preg_match('/[\r\n]/', $key)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请先保存有效的 API Key 和短信签名/发送号码');
        }

        if ($provider === 'smspoh') {
            $secret = $this->decrypt((string) ($channel['api_secret'] ?? ''), $aesKey);
            if ($secret === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '请先保存 API Secret');
            }
            $result = $this->smsPohClient($key, $secret)->requestOtp($mobile, $from,
                (string) (($channel['brand_name'] ?? '') ?: $from), [
                    'ttl' => (int) ($channel['code_expire_sec'] ?? 300),
                    'pinLength' => (int) ($channel['pin_length'] ?? 6),
                    'maxInvalidAttempts' => (int) ($channel['max_invalid_attempts'] ?? 5),
                ]);
            return $this->result((bool) $result['ok'], (int) $result['status'], (string) $result['requestId']);
        }

        if ($provider === 'twilio') {
            $sid = trim((string) ($channel['account_sid'] ?? ''));
            if (preg_match('/^AC[0-9a-f]{32}$/iD', $sid) !== 1) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '请先保存有效的 Twilio Account SID');
            }
            [$status, $body] = $this->httpPost(
                'https://api.twilio.com/2010-04-01/Accounts/' . $sid . '/Messages.json',
                'Basic ' . base64_encode($sid . ':' . $key),
                ['To' => $mobile, 'From' => $from, 'Body' => $content]
            );
        } else {
            [$status, $body] = $this->httpPost('https://rest.messagebird.com/messages', 'AccessKey ' . $key,
                ['recipients' => ltrim($mobile, '+'), 'originator' => $from, 'body' => $content]);
        }
        $json = json_decode($body, true);
        $id = is_array($json) ? (string) ($json[$provider === 'twilio' ? 'sid' : 'id'] ?? '') : '';
        $ok = $status >= 200 && $status < 300 && $id !== ''
            && ! in_array($json['status'] ?? '', ['failed', 'undelivered'], true);
        return $this->result($ok, $status, $id);
    }

    protected function smsPohClient(string $key, string $secret): SmsPohClient
    {
        return new SmsPohClient($key, $secret);
    }

    protected function httpPost(string $url, string $authorization, array $params): array
    {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Accept: application/json\r\nContent-Type: application/x-www-form-urlencoded\r\nAuthorization: " . $authorization,
            'content' => http_build_query($params),
            'ignore_errors' => true,
            'follow_location' => 0,
            'timeout' => 15,
        ]]);
        $body = @file_get_contents($url, false, $context);
        return [SmsPohClient::statusFromHeaders($http_response_header ?? []), $body === false ? '' : $body];
    }

    private function decrypt(string $value, string $aesKey): string
    {
        try {
            return CryptoHelper::decrypt($value, $aesKey);
        } catch (\Throwable) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '短信渠道密钥解密失败，请重新保存渠道密钥');
        }
    }

    private function result(bool $ok, int $status, string $id): array
    {
        // 原始响应可能含号码或凭证，只保留 HTTP 状态和服务商请求编号。
        return ['ok' => $ok, 'requestId' => $ok ? $id : '',
            'message' => $ok ? '' : ($status === 0 ? '短信服务商连接失败或超时'
                : '短信服务商未受理请求 (HTTP ' . $status . ')')];
    }
}
