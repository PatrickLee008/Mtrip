<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Merchant\MerchantAccessGuard;

use function Hyperf\Config\config;

class MerchantDeletionService
{
    public const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

    public function __construct(
        private readonly MerchantAuthenticationService $authentication,
        private readonly MerchantService $merchants,
    ) {
    }

    public function current(): array
    {
        $account = $this->authentication->deletionAccount();
        $request = $this->latest($account);
        return [
            'request' => $request && (int) $request->account_id === (int) $account['id'] ? $this->appRequest($request, true) : null,
            'channels' => $request?->status === 'pending' ? [] : $this->authentication->deletionChannels($account),
        ];
    }

    public function send(string $channel, string $ip): array
    {
        $account = $this->authentication->deletionAccount();
        $request = $this->latest($account);
        $this->assertNoPending($request);
        return $this->authentication->sendDeletionOtp($channel, (int) ($request->id ?? 0), $ip);
    }

    public function submit(string $reason, string $details, string $token, string $code, string $ip): array
    {
        $details = trim($details);
        if (! in_array($reason, ['unused', 'privacy', 'other'], true) || mb_strlen($details) > 500 || ($reason === 'other' && $details === '')) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择注销原因并填写有效说明');
        }

        $account = $this->authentication->deletionAccount();
        $this->assertNoPending($this->latest($account));
        // Verification commits attempts even when the supplied code is incorrect.
        $this->authentication->verifyDeletionOtp($token, $code, $ip);

        [$request, $notice] = Db::transaction(function () use ($account, $reason, $details, $token, $ip): array {
            $merchant = $this->lockMerchant((int) $account['merchant_id'], (int) $account['site_id']);
            MerchantAccessGuard::assertMerchant((int) $merchant->id, (int) $merchant->site_id);
            $owner = $this->authentication->deletionAccount(true);
            $previous = $this->latest($owner);
            $this->assertNoPending($previous);
            $this->authentication->consumeDeletionOtp($token, $owner, (int) ($previous->id ?? 0));
            $properties = Db::table('merchant_store')->where('merchant_id', $merchant->id)->where('site_id', $merchant->site_id)
                ->whereNull('deleted_at')->orderBy('id')->get(['id', 'store_name', 'business_type'])->all();
            Db::table('merchant_deletion_request')->insert([
                'site_id' => $merchant->site_id, 'merchant_id' => $merchant->id, 'account_id' => $owner['id'],
                'merchant_name' => $merchant->merchant_name, 'merchant_code' => $merchant->merchant_code ?? '',
                'applicant_name' => $owner['real_name'] ?: $owner['username'],
                'properties_json' => json_encode($properties, JSON_THROW_ON_ERROR),
                'reason' => $reason, 'details' => $details, 'submitted_at' => gmdate('Y-m-d H:i:s'),
            ]);
            $request = $this->latest($owner);
            return [$request, $this->recordEvent($request, 'submitted', (int) $owner['id'], $request->applicant_name, $ip)];
        });
        $this->deliver($request, $notice);
        return $this->appRequest($request, true);
    }

    public function cancel(int $id, string $ip): array
    {
        $account = $this->authentication->deletionAccount();
        $request = $this->find($id, $this->merchantRequests($account)->where('account_id', $account['id']));
        [$request, $notice] = Db::transaction(function () use ($request, $ip): array {
            $this->lockMerchant((int) $request->merchant_id, (int) $request->site_id);
            $owner = $this->authentication->deletionAccount(true);
            return $this->resolve((int) $request->id, 'cancelled', '', (int) $owner['id'], $owner['real_name'] ?: $owner['username'], $ip);
        });
        $this->deliver($request, $notice);
        return $this->appRequest($request);
    }

    public function review(int $id, string $decision, string $note, string $ip): array
    {
        if (! AdminContext::isSuper() || ! AdminContext::hasPermission('merchant:deletion:review')) {
            throw new BusinessException(ErrorCode::FORBIDDEN);
        }
        $note = trim($note);
        if (! in_array($decision, ['approved', 'rejected'], true) || $note === '' || mb_strlen($note) > 500) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写有效的审批决定及备注');
        }
        $request = $this->find($id, $this->adminQuery());
        [$request, $notice] = Db::transaction(function () use ($request, $decision, $note, $ip): array {
            $merchant = $this->lockMerchant((int) $request->merchant_id, (int) $request->site_id);
            $pending = $this->pending((int) $request->id);
            if ($decision === 'approved') {
                $this->merchants->close((array) $merchant, $note, (int) $pending->id);
            }
            return $this->resolve((int) $pending->id, $decision, $note, AdminContext::adminId(), AdminContext::adminName(), $ip);
        });
        $this->deliver($request, $notice);
        return $this->detail($id);
    }

    public function adminQuery(?int $siteId = null): Builder
    {
        $query = Db::table('merchant_deletion_request');
        $site = AdminContext::scopeSiteId($siteId);
        if ($site !== null && ($site > 0 || ! AdminContext::isSuper())) $query->where('site_id', $site);
        return $query;
    }

    public function detail(int $id): array
    {
        $request = $this->find($id, $this->adminQuery());
        $data = (array) $request;
        $data['properties'] = json_decode($request->properties_json, true, flags: JSON_THROW_ON_ERROR);
        unset($data['properties_json'], $data['pending_merchant_id']);
        return $data;
    }

    public function receipt(int $id, string $token, int $clientSiteId = 0): array
    {
        $request = Db::table('merchant_deletion_request')->where('id', $id)->first();
        if (! $request || ($clientSiteId > 0 && (int) $request->site_id !== $clientSiteId)
            || ! hash_equals($this->receiptToken($request), $token)) {
            throw new BusinessException(ErrorCode::NOT_FOUND);
        }
        // The receipt grants no session and discloses only the outcome of this application.
        return ['status' => $request->status, 'resolvedAt' => $request->resolved_at];
    }

    private function receiptToken(object $request): string
    {
        return hash_hmac('sha256', "merchant-deletion-receipt:{$request->id}:{$request->site_id}:{$request->account_id}", (string) config('mtrip.jwt_secret'));
    }

    private function appRequest(object $request, bool $includeReceipt = false): array
    {
        $result = [
            'id' => (int) $request->id, 'status' => $request->status,
            'submittedAt' => $request->submitted_at, 'resolvedAt' => $request->resolved_at,
            'reviewNote' => $request->status === 'rejected' ? $request->review_note : '',
        ];
        if ($includeReceipt && $request->status === 'pending') $result['receiptToken'] = $this->receiptToken($request);
        return $result;
    }

    private function merchantRequests(array $account): Builder
    {
        return Db::table('merchant_deletion_request')->where('merchant_id', $account['merchant_id'])->where('site_id', $account['site_id']);
    }

    private function latest(array $account): ?object
    {
        return $this->merchantRequests($account)->orderByDesc('id')->first();
    }

    private function assertNoPending(?object $request): void
    {
        if ($request?->status === 'pending') {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '已有待审批注销申请');
        }
    }

    private function find(int $id, Builder $query): object
    {
        return $query->where('id', $id)->first() ?? throw new BusinessException(ErrorCode::NOT_FOUND);
    }

    private function lockMerchant(int $merchantId, int $siteId): object
    {
        return Db::table('merchant_info')->where('id', $merchantId)->where('site_id', $siteId)->whereNull('deleted_at')
            ->lockForUpdate()->first() ?? throw new BusinessException(ErrorCode::NOT_FOUND);
    }

    private function pending(int $id): object
    {
        $request = $this->find($id, Db::table('merchant_deletion_request')->lockForUpdate());
        if ($request->status !== 'pending') {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该注销申请已处理，请刷新');
        }
        return $request;
    }

    private function resolve(int $id, string $status, string $note, int $actorId, string $actor, string $ip): array
    {
        $request = $this->pending($id);
        $changes = [
            'status' => $status, 'resolved_at' => gmdate('Y-m-d H:i:s'),
            'resolver_id' => $actorId, 'resolver_name' => $actor, 'review_note' => $note,
        ];
        Db::table('merchant_deletion_request')->where('id', $id)->update($changes);
        $request = (object) array_replace((array) $request, $changes);
        return [$request, $this->recordEvent($request, $status, $actorId, $actor, $ip)];
    }

    private function recordEvent(object $request, string $event, int $actorId, string $actor, string $ip): int
    {
        $english = match ($event) {
            'submitted' => 'Your merchant account deletion request is awaiting review.',
            'cancelled' => 'Your merchant account deletion request was cancelled.',
            'approved' => 'Your merchant account deletion request was approved. Account access has ended.',
            'rejected' => 'Your merchant account deletion request was rejected. See the reason in the Merchant App.',
        };
        $chinese = match ($event) {
            'submitted' => '你的商户注销申请已提交，等待超管审批。',
            'cancelled' => '你的商户注销申请已撤回。',
            'approved' => '你的商户注销申请已批准，账号访问已停用。',
            'rejected' => '你的商户注销申请已驳回，请在商户 App 查看原因。',
        };
        $now = gmdate('Y-m-d H:i:s');
        Db::table('merchant_activity_log')->insert([
            'site_id' => $request->site_id, 'merchant_id' => $request->merchant_id, 'activity_type' => 'account_change',
            'description' => mb_substr('Account deletion #' . $request->id . ' ' . $event . ': ' . ($request->review_note ?: $request->reason), 0, 255),
            'performed_by' => $actor, 'performed_by_id' => $actorId,
            'actor_type' => in_array($event, ['approved', 'rejected'], true) ? 'admin' : 'merchant',
            'target_account_id' => $request->account_id, 'entity_type' => 'merchant_deletion', 'entity_id' => $request->id,
            'ip_address' => mb_substr($ip, 0, 45), 'created_at' => $now,
        ]);
        $notice = (int) Db::table('merchant_notify')->insertGetId([
            'site_id' => $request->site_id, 'merchant_id' => $request->merchant_id, 'recipient_id' => $request->account_id,
            'category' => 'account', 'title' => 'Merchant account deletion / 商户账号注销', 'message' => $english . "\n" . $chinese,
            'channels' => 'inapp', 'status' => 1, 'send_type' => 1, 'send_at' => $now, 'delivered_at' => $now,
            'operator_id' => $actorId, 'operator_name' => $actor, 'created_at' => $now,
        ]);
        Db::table('merchant_notify_delivery')->insert([
            'notify_id' => $notice, 'channel' => 'inapp', 'status' => 'delivered', 'attempts' => 1,
            'scheduled_at' => $now, 'delivered_at' => $now, 'receipt' => 'inapp:' . $notice,
        ]);
        return $notice;
    }

    private function deliver(object $request, int $notice): void
    {
        $this->authentication->deliverDeletionNotice((int) $request->account_id, $notice);
    }
}
