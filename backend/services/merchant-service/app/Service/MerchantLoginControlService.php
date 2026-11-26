<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\CryptoHelper;
use Mtrip\Shared\Support\MaskHelper;

use function Hyperf\Config\config;

class MerchantLoginControlService
{
    public function snapshot(array $merchant): array
    {
        $owner = Db::table('merchant_admin')->where('site_id', $merchant['site_id'])->where('merchant_id', $merchant['id'])
            ->where('account_type', 2)->where('is_owner', 1)->whereNull('deleted_at')->orderBy('id')->first();
        $access = (string) ($merchant['access_code'] ?? '');
        $methods = [
            ['method' => 'access_code', 'enabled' => $access !== '' && (int) ($owner->two_fa_status ?? 0) === 1,
                'allowed' => true, 'identifier' => $access !== '' ? '••••' . substr($access, -3) : ''],
        ];
        foreach (['email' => 'email', 'sms' => 'mobile'] as $method => $field) {
            $contact = $owner?->{$field} ?? '';
            $verified = $contact !== '' && ! empty($owner->{'verified_' . $field . '_at'}) && empty($owner->{$field . '_released_at'});
            $plain = '';
            if ($verified) {
                try { $plain = CryptoHelper::decrypt($contact, (string) config('mtrip.aes_key')); }
                catch (\Throwable) { /* A legacy invalid contact cannot enable OTP. */ }
            }
            $allowed = (bool) $merchant[$method . '_login_enabled'];
            $methods[] = ['method' => $method, 'enabled' => $allowed && $plain !== '', 'allowed' => $allowed,
                'identifier' => $method === 'email' && str_contains($plain, '@') ? MaskHelper::email($plain) : MaskHelper::mobile($plain)];
        }
        $sessions = $this->sessions((int) $merchant['id'], (int) $merchant['site_id']);
        $recent = Db::table('merchant_login_session')->where('merchant_id', $merchant['id'])->where('site_id', $merchant['site_id'])
            ->orderByDesc('id')->first(['method', 'logged_in_at', 'client', 'device_name', 'ip_address']);
        $devices = Db::table('merchant_trusted_device')->where('merchant_id', $merchant['id'])->where('site_id', $merchant['site_id'])
            ->whereNull('revoked_at')->orderByDesc('id')->get(['id', 'account_id', 'platform', 'device_name', 'trusted_at'])->all();
        $audit = Db::table('merchant_login_audit')->where('merchant_id', $merchant['id'])->where('site_id', $merchant['site_id'])
            ->orderByDesc('id')->limit(50)->get()->map(static function ($row): array {
                $data = (array) $row;
                $data['changes'] = json_decode($data['changes_json'], true);
                unset($data['changes_json']);
                return $data;
            })->all();
        return ['methods' => $methods, 'sessions' => $sessions, 'devices' => $devices, 'audit' => $audit, 'lastLogin' => $recent
            ?? ($owner?->last_login_at ? ['method' => $owner->last_login_method, 'logged_in_at' => $owner->last_login_at] : null)];
    }

    private function sessions(int $merchantId, int $siteId, ?int $accountId = null): array
    {
        $query = Db::table('merchant_login_session as s')->join('merchant_admin as a', 'a.id', '=', 's.account_id')
            ->where('s.merchant_id', $merchantId)->where('s.site_id', $siteId)->where('a.status', 1)->whereNull('a.deleted_at')
            ->whereColumn('s.auth_version', 'a.auth_version')->whereNull('s.revoked_at')->where('s.expires_at', '>', gmdate('Y-m-d H:i:s'));
        if ($accountId !== null) $query->where('s.account_id', $accountId);
        return $query->orderByDesc('s.id')->get([
            's.id', 's.account_id', 'a.username', 's.method', 's.client', 's.device_name', 's.ip_address', 's.logged_in_at', 's.expires_at',
        ])->all();
    }

    public function change(array $merchant, string $action, int $deviceId, string $reason, bool $reviewed, array $actor, string $ip): array
    {
        $method = match ($action) {
            'enable_email', 'disable_email' => 'email',
            'enable_sms', 'disable_sms' => 'sms',
            default => '',
        };
        $enable = str_starts_with($action, 'enable_');
        $reason = trim($reason);
        if ($reason === '' || mb_strlen($reason) > 500 || ($enable && ! $reviewed)
            || ($method === '' && ! in_array($action, ['logout_all', 'revoke_device'], true))) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请填写操作原因并确认安全复核');
        }
        return Db::transaction(function () use ($merchant, $action, $deviceId, $reason, $reviewed, $actor, $ip, $method, $enable): array {
            $live = Db::table('merchant_info')->where('id', $merchant['id'])->where('site_id', $merchant['site_id'])
                ->whereNull('deleted_at')->lockForUpdate()->first();
            if (! $live) throw new BusinessException(ErrorCode::NOT_FOUND);
            $scope = Db::table('merchant_admin')->where('merchant_id', $live->id)->where('site_id', $live->site_id)
                ->whereIn('account_type', [2, 3])->whereNull('deleted_at');
            $accountIds = (clone $scope)->orderBy('id')->lockForUpdate()->pluck('id')->all();
            $changes = ['sessions' => [], 'devices' => [], 'pairings' => 0, 'result' => 'applied', 'ip' => $ip];
            $now = gmdate('Y-m-d H:i:s');

            if ($method !== '') {
                $field = $method . '_login_enabled';
                if ((bool) $live->{$field} === $enable) throw new BusinessException(ErrorCode::DATA_CONFLICT, '登录方式状态已经变更');
                $changes['before'] = (bool) $live->{$field};
                $changes['after'] = $enable;
                $changes['reviewed'] = $reviewed;
                Db::table('merchant_info')->where('id', $live->id)->update([$field => (int) $enable]);
            }
            $sessions = Db::table('merchant_login_session')->whereIn('account_id', $accountIds)->whereNull('revoked_at')->where('expires_at', '>', $now);
            if ($action === 'revoke_device') {
                $changes['before'] = 'trusted';
                $changes['after'] = 'revoked';
                $device = Db::table('merchant_trusted_device')->where('id', $deviceId)->whereIn('account_id', $accountIds)
                    ->where('merchant_id', $live->id)->where('site_id', $live->site_id)->whereNull('revoked_at')->lockForUpdate()->first();
                if (! $device) throw new BusinessException(ErrorCode::NOT_FOUND);
                Db::table('merchant_trusted_device')->where('id', $deviceId)->update(['revoked_at' => $now]);
                $changes['devices'] = [$deviceId];
                $sessions->where('device_id', $deviceId);
            }
            if ($action === 'revoke_device' || ! $enable) {
                $changes['sessions'] = (clone $sessions)->orderBy('id')->lockForUpdate()->pluck('id')->all();
                $sessions->update(['revoked_at' => $now]);
            }
            if ($action !== 'revoke_device' && ! $enable) {
                $changes['accounts'] = $accountIds;
                $scope->update(['auth_version' => Db::raw('auth_version + 1'), 'challenge_hash' => null, 'challenge_expires_at' => null, 'pending_secret_enc' => '']);
                $changes['pairings'] = Db::table('merchant_login_pairing')->whereIn('account_id', $accountIds)->whereNull('consumed_at')
                    ->where('expires_at', '>', $now)->update(['consumed_at' => $now]);
                $support = Db::table('merchant_impersonation_session')->where('merchant_id', $live->id)->where('site_id', $live->site_id)->where('status', 1);
                $changes['supportSessions'] = (clone $support)->lockForUpdate()->pluck('id')->all();
                $support->update(['status' => 2, 'ended_at' => $now, 'exchange_hash' => null]);
            }
            if ($action === 'logout_all') {
                $changes['before'] = 'active';
                $changes['after'] = 'revoked';
            }
            $this->audit((int) $live->site_id, (int) $live->id, $actor, 'admin', $action, $reason, $changes);
            return $changes;
        });
    }

    public function ownSessions(): array
    {
        return $this->sessions(MerchantContext::merchantId(), MerchantContext::siteId(), MerchantContext::adminId());
    }

    public function trustDevice(string $installation, string $platform, string $name): int
    {
        if (! preg_match('/^[a-f0-9]{64}$/D', $installation) || ! in_array($platform, ['ios', 'android'], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR);
        }
        return Db::transaction(function () use ($installation, $platform, $name): int {
            $session = $this->lockOwnSession();
            if ($session->client !== $platform || $session->method !== 'access_code'
                || strtotime($session->logged_in_at . ' UTC') < time() - 300) {
                throw new BusinessException(ErrorCode::FORBIDDEN, '请使用访问码和身份验证器重新登录后启用生物识别');
            }
            $keys = ['account_id' => $session->account_id, 'installation_hash' => hash('sha256', $installation)];
            $device = Db::table('merchant_trusted_device')->where($keys)->first();
            if ($device?->revoked_at && strtotime($device->revoked_at . ' UTC') >= strtotime($session->logged_in_at . ' UTC')) {
                throw new BusinessException(ErrorCode::FORBIDDEN, '请使用访问码和身份验证器重新登录后启用生物识别');
            }
            $now = gmdate('Y-m-d H:i:s');
            if (! $device || $device->revoked_at) {
                Db::table('merchant_trusted_device')->updateOrInsert($keys, [
                    'merchant_id' => $session->merchant_id, 'site_id' => $session->site_id, 'platform' => $platform,
                    'device_name' => mb_substr(mb_scrub(trim($name)), 0, 160), 'trusted_at' => $now, 'revoked_at' => null,
                ]);
            }
            $id = (int) Db::table('merchant_trusted_device')->where($keys)->value('id');
            Db::table('merchant_login_session')->where('id', $session->id)->update(['device_id' => $id]);
            if (! $device || $device->revoked_at) {
                $this->audit((int) $session->site_id, (int) $session->merchant_id, $this->self(), 'merchant', 'trust_device',
                    'Access code + authenticator', ['before' => $device ? 'revoked' : 'unregistered', 'after' => 'trusted', 'devices' => [$id], 'sessions' => [$session->id], 'result' => 'applied']);
            }
            return $id;
        });
    }

    public function untrustDevice(): void
    {
        Db::transaction(function (): void {
            $session = $this->lockOwnSession();
            if (! $session->device_id) return;
            $deviceId = (int) $session->device_id;
            $now = gmdate('Y-m-d H:i:s');
            Db::table('merchant_trusted_device')->where('id', $deviceId)->where('account_id', $session->account_id)->update(['revoked_at' => $now]);
            $others = Db::table('merchant_login_session')->where('device_id', $deviceId)->where('id', '!=', $session->id)
                ->whereNull('revoked_at')->where('expires_at', '>', $now);
            $ids = (clone $others)->pluck('id')->all();
            $others->update(['revoked_at' => $now]);
            Db::table('merchant_login_session')->where('id', $session->id)->update(['device_id' => null]);
            $this->audit((int) $session->site_id, (int) $session->merchant_id, $this->self(), 'merchant', 'untrust_device',
                'Device security settings', ['before' => 'trusted', 'after' => 'revoked', 'devices' => [$deviceId], 'sessions' => $ids, 'result' => 'applied']);
        });
    }

    public function endOwnSession(int $id): void
    {
        \Mtrip\Shared\Merchant\MerchantSessions::end($id, MerchantContext::adminId());
    }

    private function lockOwnSession(): object
    {
        $account = Db::table('merchant_admin')->where('id', MerchantContext::adminId())->whereNull('deleted_at')->lockForUpdate()->first();
        $session = Db::table('merchant_login_session')->where('id', MerchantContext::get()['merchant_session_id'] ?? 0)
            ->where('account_id', MerchantContext::adminId())->whereNull('revoked_at')
            ->where('expires_at', '>', gmdate('Y-m-d H:i:s'))->lockForUpdate()->first();
        if (! $account || (int) $account->status !== 1 || ! $session || (int) $session->auth_version !== (int) $account->auth_version) {
            throw new BusinessException(ErrorCode::UNAUTHORIZED);
        }
        return $session;
    }

    private function self(): array
    {
        return ['id' => MerchantContext::adminId(), 'name' => MerchantContext::adminName()];
    }

    private function audit(int $site, int $merchant, array $actor, string $kind, string $action, string $reason, array $changes): void
    {
        $now = gmdate('Y-m-d H:i:s');
        $id = Db::table('merchant_login_audit')->insertGetId([
            'site_id' => $site, 'merchant_id' => $merchant, 'actor_id' => $actor['id'], 'actor_name' => $actor['name'],
            'actor_type' => $kind, 'action' => $action, 'reason' => $reason,
            'changes_json' => json_encode($changes, JSON_THROW_ON_ERROR), 'created_at' => $now,
        ]);
        Db::table('merchant_activity_log')->insert([
            'site_id' => $site, 'merchant_id' => $merchant, 'activity_type' => 'account_change',
            'description' => mb_substr($action . ': ' . $reason, 0, 255),
            'performed_by' => $actor['name'], 'performed_by_id' => $actor['id'], 'actor_type' => $kind,
            'entity_type' => 'merchant_login_audit', 'entity_id' => $id, 'created_at' => $now,
            'ip_address' => mb_substr($changes['ip'] ?? '', 0, 45),
        ]);
    }
}
