<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\SmtpClient;

use function Hyperf\Config\config;

/** Persists encrypted credentials before attempting any external delivery. */
class OnboardingCredentialDeliveryService
{
    private const CHANNELS = ['email', 'sms', 'inapp'];

    /** @param list<string> $channels @param array{accessCode:string,username:string,temporaryPassword:string} $credentials */
    public function create(
        array $application,
        int $merchantId,
        int $accountId,
        string $requestId,
        array $channels,
        array $credentials
    ): void {
        $payload = json_encode($credentials, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($payload === false) {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '凭证生成失败');
        }
        $encryptedPayload = CryptoHelper::encrypt($payload, $this->aesKey());
        $payloadHash = hash('sha256', $payload);
        foreach ($channels as $channel) {
            $recipient = match ($channel) {
                'email' => (string) $application['registration_email'],
                'sms' => (string) $application['registration_phone'],
                'inapp' => (string) $merchantId,
                default => throw new BusinessException(ErrorCode::PARAM_ERROR, '投递渠道不受支持'),
            };
            Db::table('merchant_credential_delivery')->insert([
                'site_id' => (int) $application['site_id'],
                'application_id' => (int) $application['id'],
                'merchant_id' => $merchantId,
                'account_id' => $accountId,
                'approval_request_id' => $requestId,
                'channel' => $channel,
                'recipient_ciphertext' => $channel === 'inapp' ? CryptoHelper::encrypt($recipient, $this->aesKey()) : $recipient,
                'credential_ciphertext' => $encryptedPayload,
                'payload_hash' => $payloadHash,
                'status' => 'pending',
                'next_attempt_at' => gmdate('Y-m-d H:i:s'),
                'created_by' => AdminContext::adminId(),
            ]);
        }
    }

    /** @return list<array<string,mixed>> */
    public function deliverApplication(int $applicationId, ?bool $testMode = null): array
    {
        $testMode ??= MerchantAuthTestMode::enabled();
        $ids = Db::table('merchant_credential_delivery')->where('application_id', $applicationId)
            ->whereIn('status', ['pending', 'failed'])->orderBy('id')->pluck('id')->all();
        foreach ($ids as $id) {
            $this->deliver((int) $id, false, $testMode);
        }
        return $this->receipts($applicationId);
    }

    public function retry(int $deliveryId): array
    {
        $row = Db::table('merchant_credential_delivery')->where('id', $deliveryId)->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '凭证投递记录不存在');
        }
        $this->assertSite((int) $row->site_id);
        if ((string) $row->status === 'delivered') {
            return $this->receipt((array) $row);
        }
        $this->deliver($deliveryId, true, MerchantAuthTestMode::enabled());
        return $this->receipt((array) Db::table('merchant_credential_delivery')->where('id', $deliveryId)->first());
    }

    /** @return list<array<string,mixed>> */
    public function receipts(int $applicationId): array
    {
        return Db::table('merchant_credential_delivery')->where('application_id', $applicationId)->orderBy('id')->get()
            ->map(fn ($row): array => $this->receipt((array) $row))->all();
    }

    public function testCredentials(int $applicationId): array
    {
        if (! MerchantAuthTestMode::enabled() || ! AdminContext::isSuper()) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅测试模式下超级管理员可查看激活凭证');
        }
        return Db::transaction(function () use ($applicationId): array {
            $app = Db::table('merchant_application')->where('id', $applicationId)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $app) throw new BusinessException(ErrorCode::NOT_FOUND, '入驻申请不存在');
            if (! $app->final_approved_at || (int) $app->account_status !== 1) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待激活账号可查看临时凭证');
            }
            $account = Db::table('merchant_admin')->where('merchant_id', $app->merchant_id)->where('site_id', $app->site_id)
                ->where('is_owner', 1)->where('account_type', 2)->where('status', 2)->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $account) throw new BusinessException(ErrorCode::DATA_CONFLICT, '账号已激活或不可用');
            $row = Db::table('merchant_credential_delivery')->where('application_id', $applicationId)
                ->where('account_id', $account->id)->where('site_id', $app->site_id)->orderBy('id')->first();
            if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND, '激活凭证记录不存在');
            $json = CryptoHelper::decrypt((string) $row->credential_ciphertext, $this->aesKey());
            $payload = json_decode($json, true);
            if (! is_array($payload) || ! hash_equals((string) $row->payload_hash, hash('sha256', $json))
                || ($payload['username'] ?? '') !== $account->username
                || ! password_verify((string) ($payload['temporaryPassword'] ?? ''), (string) $account->password)) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '临时凭证已失效');
            }
            Db::table('merchant_verify_timeline')->insert([
                'site_id' => $app->site_id, 'merchant_id' => $app->merchant_id, 'application_id' => $applicationId,
                'action' => 'test_credentials_viewed', 'actor_type' => 2, 'operator_id' => AdminContext::adminId(),
                'operator_name' => AdminContext::adminName(), 'note' => '超级管理员在测试模式下查看待激活账号凭证', 'is_exception' => 1,
            ]);
            return [
                'accessCode' => (string) $payload['accessCode'], 'username' => (string) $payload['username'],
                'temporaryPassword' => (string) $payload['temporaryPassword'],
                'email' => CryptoHelper::decrypt((string) $account->email, $this->aesKey()),
                'phone' => CryptoHelper::decrypt((string) $account->mobile, $this->aesKey()),
                'testOtpCode' => MerchantAuthTestMode::OTP,
            ];
        });
    }

    private function deliver(int $deliveryId, bool $manual = false, ?bool $testMode = null): void
    {
        $testMode ??= MerchantAuthTestMode::enabled();
        $row = Db::transaction(function () use ($deliveryId, $manual, $testMode): ?array {
            $record = Db::table('merchant_credential_delivery')->where('id', $deliveryId)->lockForUpdate()->first();
            if (! $record || (string) $record->status === 'delivered') {
                return null;
            }
            if ($testMode && $record->channel !== 'inapp') return null;
            if ((string) $record->status === 'processing'
                && (string) $record->locked_at > gmdate('Y-m-d H:i:s', time() - 300)) {
                return null;
            }
            if (! $manual && (int) $record->attempts >= (int) $record->max_attempts) {
                return null;
            }
            Db::table('merchant_credential_delivery')->where('id', $deliveryId)->update([
                'status' => 'processing',
                'attempts' => (int) $record->attempts + 1,
                'locked_at' => gmdate('Y-m-d H:i:s'),
                'last_error' => '',
            ]);
            return (array) $record;
        });
        if ($row === null) {
            return;
        }

        try {
            $payload = json_decode(CryptoHelper::decrypt((string) $row['credential_ciphertext'], $this->aesKey()), true);
            if (! is_array($payload) || ! hash_equals((string) $row['payload_hash'], hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: ''))) {
                throw new \RuntimeException('credential payload integrity check failed');
            }
            $recipient = CryptoHelper::decrypt((string) $row['recipient_ciphertext'], $this->aesKey());
            $result = match ((string) $row['channel']) {
                'email' => $this->deliverEmail((int) $row['site_id'], $recipient, $payload),
                'sms' => $this->deliverSms((int) $row['site_id'], $recipient, $payload),
                'inapp' => $this->deliverInApp($row, $payload),
                default => ['ok' => false, 'receipt' => '', 'error' => 'unsupported_channel'],
            };
        } catch (\Throwable $e) {
            $result = ['ok' => false, 'receipt' => '', 'error' => mb_substr($e->getMessage(), 0, 200)];
        }
        $now = gmdate('Y-m-d H:i:s');
        Db::table('merchant_credential_delivery')->where('id', $deliveryId)->where('status', 'processing')->update([
            'status' => $result['ok'] ? 'delivered' : 'failed',
            'delivered_at' => $result['ok'] ? $now : null,
            'provider_receipt' => mb_substr((string) $result['receipt'], 0, 255),
            'last_error' => mb_substr((string) $result['error'], 0, 255),
            'next_attempt_at' => $result['ok'] ? null : gmdate('Y-m-d H:i:s', time() + 300),
            'locked_at' => null,
        ]);
    }

    /** @param array<string,mixed> $payload @return array{ok:bool,receipt:string,error:string} */
    protected function deliverEmail(int $siteId, string $recipient, array $payload): array
    {
        $channel = $this->emailChannel($siteId);
        if ($channel === null) {
            return ['ok' => false, 'receipt' => '', 'error' => 'email_channel_unavailable'];
        }
        $body = "Your mTrip merchant account is ready.\nAccess code: {$payload['accessCode']}\nUsername: {$payload['username']}\nTemporary password: {$payload['temporaryPassword']}\nPlease activate the account and replace the temporary password.";
        $sent = (new SmtpClient($channel['host'], $channel['port'], $channel['encryption'], $channel['username'], $channel['password']))
            ->send($channel['fromEmail'], $channel['fromName'], $recipient, 'Your mTrip merchant account', $body);
        return ['ok' => (bool) $sent['ok'], 'receipt' => $sent['ok'] ? 'smtp:accepted' : '', 'error' => $sent['ok'] ? '' : (string) $sent['message']];
    }

    /** @param array<string,mixed> $payload @return array{ok:bool,receipt:string,error:string} */
    protected function deliverSms(int $siteId, string $recipient, array $payload): array
    {
        return ['ok' => false, 'receipt' => '', 'error' => 'sms_provider_supports_otp_only'];
    }

    /** @param array<string,mixed> $row @param array<string,mixed> $payload @return array{ok:bool,receipt:string,error:string} */
    protected function deliverInApp(array $row, array $payload): array
    {
        $requestId = 'onboarding-credentials-' . (int) $row['application_id'];
        Db::table('merchant_notify')->insertOrIgnore([
            'site_id' => (int) $row['site_id'],
            'merchant_id' => (int) $row['merchant_id'],
            'category' => 'account',
            'title' => 'Merchant account approved',
            'message' => 'Your merchant access code is ' . (string) $payload['accessCode'] . '. Use your verified contact channel to complete activation.',
            'deep_link_type' => 'page',
            'deep_link_value' => '/settings',
            'channels' => 'inapp',
            'send_type' => 1,
            'send_at' => gmdate('Y-m-d H:i:s'),
            'status' => 1,
            'delivered_at' => gmdate('Y-m-d H:i:s'),
            'operator_id' => (int) $row['created_by'],
            'operator_name' => 'Onboarding',
            'request_id' => $requestId,
            'payload_hash' => hash('sha256', $requestId),
        ]);
        $notifyId = (int) Db::table('merchant_notify')->where('merchant_id', $row['merchant_id'])->where('request_id', $requestId)->value('id');
        Db::table('merchant_notify_delivery')->insertOrIgnore([
            'notify_id' => $notifyId, 'channel' => 'inapp', 'status' => 'delivered', 'attempts' => 1,
            'scheduled_at' => gmdate('Y-m-d H:i:s'), 'delivered_at' => gmdate('Y-m-d H:i:s'), 'receipt' => 'inapp:' . $notifyId,
        ]);
        return ['ok' => true, 'receipt' => 'inapp:' . $notifyId, 'error' => ''];
    }

    /** @return array<string,mixed>|null */
    private function emailChannel(int $siteId): ?array
    {
        $row = Db::connection('system')->table('sys_email_channel')->whereIn('site_id', [$siteId, 0])
            ->where('status', 1)->whereNull('deleted_at')->orderByRaw('site_id = ? DESC', [$siteId])->first();
        if (! $row) {
            return null;
        }
        $row = (array) $row;
        return [
            'host' => (string) $row['smtp_host'], 'port' => (int) $row['smtp_port'], 'encryption' => (string) $row['encryption'],
            'username' => CryptoHelper::decrypt((string) $row['username'], $this->aesKey()),
            'password' => CryptoHelper::decrypt((string) $row['password'], $this->aesKey()),
            'fromEmail' => (string) $row['from_email'], 'fromName' => (string) $row['from_name'],
        ];
    }

    /** @param array<string,mixed> $row */
    private function receipt(array $row): array
    {
        $recipient = '';
        try {
            $recipient = CryptoHelper::decrypt((string) $row['recipient_ciphertext'], $this->aesKey());
        } catch (\Throwable) {
        }
        return [
            'id' => (int) $row['id'], 'channel' => (string) $row['channel'], 'status' => (string) $row['status'],
            'recipient' => $row['channel'] === 'email' ? MaskHelper::email($recipient) : ($row['channel'] === 'sms' ? MaskHelper::mobile($recipient) : 'merchant-app'),
            'attempts' => (int) $row['attempts'], 'maxAttempts' => (int) $row['max_attempts'],
            'deliveredAt' => $row['delivered_at'], 'lastError' => (string) $row['last_error'],
        ];
    }

    private function assertSite(int $siteId): void
    {
        if (! AdminContext::isSuper() && AdminContext::siteId() !== $siteId) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
    }

    private function aesKey(): string
    {
        $key = (string) config('mtrip.aes_key');
        if ($key === '') {
            throw new BusinessException(ErrorCode::SERVER_ERROR, '数据加密密钥未配置');
        }
        return $key;
    }
}
