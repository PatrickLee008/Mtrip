<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Wallet\WalletLedger;

/** Consumer 1.0.8 M19 / Admin 1.0.19 M20, M24. All decisions are immutable events. */
final class AccountDeletionWorkflow
{
    public const APPROVED = 1;
    public const CLOSED = 2;
    public const REVOKED = 3;
    public const PENDING = 4;
    public const REJECTED = 5;

    public const COLUMNS = ['id','site_id','user_id','status','requested_by','requested_name','request_reason',
        'evidence','requested_balance','threshold_snapshot','policy_version','validity_days','approved_balance',
        'approve_reason','approved_by','approved_name','approved_at','approval_expires_at','finance_state',
        'finance_maker_id','finance_maker_name','finance_made_at','finance_maker_reason','finance_checker_id',
        'finance_checker_name','finance_checked_at','finance_checker_reason','finance_balance','rejection_reason',
        'forfeited_amount','closed_at','purge_after','purged_at','created_at'];

    public static function policy(): array
    {
        return (array) Db::table('user_account_deletion_config')->where('effective_at', '<=', gmdate('Y-m-d H:i:s'))
            ->orderByDesc('effective_at')->orderByDesc('id')->first();
    }

    public function savePolicy(array $data, int $actor, string $name): array
    {
        $amount = (string) ($data['thresholdAmount'] ?? '');
        $days = (string) ($data['validityDays'] ?? '');
        $effective = (string) ($data['effectiveAt'] ?? '');
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $effective, new \DateTimeZone('UTC'));
        if (! preg_match('/^\d{1,10}(\.\d{1,2})?$/D', $amount)
            || ! ctype_digit($days) || (int) $days < 1 || (int) $days > 365
            || ! $date || $date->format('Y-m-d H:i:s') !== $effective || $date->getTimestamp() < time() - 60) {
            self::fail('Invalid amount, approval validity (1–365 days), or future effective UTC time');
        }
        $reason = self::reason((string) ($data['reason'] ?? ''));
        return Db::transaction(function () use ($data, $amount, $days, $effective, $reason, $actor, $name): array {
            Db::table('user_account_deletion_config')->where('id', 1)->lockForUpdate()->first();
            if ((int) Db::table('user_account_deletion_config')->max('id') !== (int) ($data['expectedVersion'] ?? 0)) {
                self::fail('Policy changed; reload before saving');
            }
            $id = Db::table('user_account_deletion_config')->insertGetId([
                'threshold_amount' => $amount, 'validity_days' => (int) $days, 'effective_at' => $effective,
                'reason' => $reason, 'actor_id' => $actor, 'actor_name' => mb_substr($name, 0, 50),
            ]);
            return ['id' => $id];
        });
    }

    public function request(array $user, string $reason, string $evidence, int $actor, string $name): array
    {
        $reason = self::reason($reason);
        if (mb_strlen($evidence) > 1000) self::fail('Evidence reference is too long');
        return Db::transaction(function () use ($user, $reason, $evidence, $actor, $name): array {
            $user = $this->lockUser((int) $user['id']);
            $existing = Db::table('user_account_deletion')->where('user_id', $user['id'])
                ->whereIn('status', [self::PENDING, self::APPROVED])->orderByDesc('id')->lockForUpdate()->get();
            foreach ($existing as $row) {
                $row = (array) $row;
                if ((int) $row['status'] === self::PENDING || ((int) $row['policy_version'] > 0 && ! self::expired($row))) return self::present($row);
            }
            $balance = WalletLedger::availableLocked((int) $user['id']);
            if (WalletLedger::cents($balance) <= 0) self::fail('No wallet forfeiture is needed for a zero balance');
            $policy = self::policy();
            $id = Db::table('user_account_deletion')->insertGetId([
                'site_id' => $user['site_id'], 'user_id' => $user['id'], 'status' => self::PENDING,
                'requested_by' => $actor, 'requested_name' => mb_substr($name, 0, 50),
                'request_reason' => $reason, 'evidence' => $evidence, 'requested_balance' => $balance,
                'threshold_snapshot' => $policy['threshold_amount'], 'policy_version' => $policy['id'],
                'validity_days' => $policy['validity_days'],
            ]);
            $row = (array) Db::table('user_account_deletion')->where('id', $id)->first();
            self::event($row, 'requested', $actor, $name, $reason);
            return self::present($row);
        });
    }

    /** Super Admin approves the escalation; Finance clearance is still mandatory. */
    public function approve(int $id, bool $approve, string $reason, int $actor, string $name, callable $scope, ?string $expectedBalance = null): array
    {
        return $this->change($id, $scope, function (array $row, array $user) use ($approve, $reason, $actor, $name, $expectedBalance): array {
            if ((int) $row['status'] !== self::PENDING) self::fail('Request has already been reviewed');
            if (! $approve) return $this->reject($row, 'admin_rejected', $reason, $actor, $name);
            $balance = WalletLedger::availableLocked((int) $user['id']);
            self::assertBalance($balance, $expectedBalance);
            if (WalletLedger::cents($balance) <= 0) self::fail('Wallet is now empty; consumer may delete without forfeiture');
            $policy = self::policy();
            $stamp = ['status' => self::APPROVED, 'approved_balance' => $balance,
                'approved_by' => $actor, 'approved_name' => mb_substr($name, 0, 50), 'approve_reason' => self::reason($reason),
                'approved_at' => gmdate('Y-m-d H:i:s'),
                'approval_expires_at' => gmdate('Y-m-d H:i:s', time() + (int) $policy['validity_days'] * 86400),
                'validity_days' => $policy['validity_days'], 'policy_version' => $policy['id'],
                'threshold_snapshot' => $policy['threshold_amount']];
            return $this->write($row, $stamp, 'admin_approved', $actor, $name, $reason);
        });
    }

    public function finance(int $id, bool $check, bool $approve, string $reason, int $actor, string $name, callable $scope, ?string $expectedBalance = null): array
    {
        return $this->change($id, $scope, function (array $row, array $user) use ($check, $approve, $reason, $actor, $name, $expectedBalance): array {
            if ((int) $row['status'] !== self::APPROVED || self::expired($row)) self::fail('Approval is inactive or expired');
            if ((int) $row['policy_version'] <= 0 || (int) $row['requested_by'] <= 0 || trim($row['approve_reason']) === '') {
                self::fail('Legacy approval must be renewed through the reviewed request workflow');
            }
            if ((int) $row['approved_by'] === $actor || ($check && (int) $row['finance_maker_id'] === $actor)) {
                throw new BusinessException(ErrorCode::FORBIDDEN, 'Super Admin approver, Finance maker and checker must be different people');
            }
            if ((int) $row['finance_state'] !== ($check ? 1 : 0)) self::fail('Finance stage has already changed');
            if (! $approve) return $this->reject($row, 'finance_rejected', $reason, $actor, $name);
            if (AccountDeletionBookings::blockers((int) $user['id']) !== []) self::fail('Blocking bookings/refunds remain');
            $balance = WalletLedger::availableLocked((int) $user['id']);
            self::assertBalance($balance, $expectedBalance);
            if (WalletLedger::cents($balance) > WalletLedger::cents($row['approved_balance'])) self::fail('Balance increased; a new Super Admin approval is required');
            if ($check && WalletLedger::cents($balance) > WalletLedger::cents($row['finance_balance'])) self::fail('Balance increased after Finance preparation; renew the approval');
            $prefix = $check ? 'finance_checker' : 'finance_maker';
            return $this->write($row, ['finance_state' => $check ? 2 : 1,
                $prefix . '_id' => $actor, $prefix . '_name' => mb_substr($name, 0, 50),
                $prefix . '_reason' => self::reason($reason),
                $check ? 'finance_checked_at' : 'finance_made_at' => gmdate('Y-m-d H:i:s'),
                'finance_balance' => $balance], $check ? 'finance_checked' : 'finance_prepared', $actor, $name, $reason);
        });
    }

    public function revoke(int $id, string $reason, int $actor, string $name, callable $scope): array
    {
        return $this->change($id, $scope, function (array $row) use ($reason, $actor, $name): array {
            if (! in_array((int) $row['status'], [self::APPROVED, self::PENDING], true)) self::fail('Request is already closed');
            return $this->write($row, ['status' => self::REVOKED], 'revoked', $actor, $name, self::reason($reason));
        });
    }

    private function reject(array $row, string $action, string $reason, int $actor, string $name): array
    {
        return $this->write($row, ['status' => self::REJECTED, 'rejection_reason' => self::reason($reason)], $action, $actor, $name, $reason);
    }

    /** Use the same user → approval lock order as consumer deletion and wallet posting. */
    private function change(int $id, callable $scope, callable $mutate): array
    {
        return Db::transaction(function () use ($id, $scope, $mutate): array {
            $identity = Db::table('user_account_deletion')->where('id', $id)->first(['user_id','site_id']);
            if (! $identity) throw new BusinessException(ErrorCode::NOT_FOUND);
            $scope((int) $identity->site_id);
            $user = $this->lockUser((int) $identity->user_id);
            $scope((int) $user['site_id']);
            $row = (array) Db::table('user_account_deletion')->where('id', $id)->lockForUpdate()->first();
            if ((int) $row['site_id'] !== (int) $user['site_id']) self::fail('Consumer site changed; renew the request');
            return $mutate($row, $user);
        });
    }

    private function lockUser(int $id): array
    {
        $row = Db::table('user_info')->where('id', $id)->whereNull('deleted_at')->lockForUpdate()->first();
        if (! $row || (int) $row->user_status !== 1) self::fail('Consumer account is not active');
        return (array) $row;
    }

    private function write(array $row, array $changes, string $action, int $actor, string $name, string $reason): array
    {
        Db::table('user_account_deletion')->where('id', $row['id'])->update($changes);
        self::event($row, $action, $actor, $name, $reason, $changes);
        return self::present(array_replace($row, $changes));
    }

    public static function event(array $row, string $action, int $actor, string $name, string $reason, array $details = []): void
    {
        Db::table('user_account_deletion_event')->insert(['site_id' => $row['site_id'], 'user_id' => $row['user_id'],
            'deletion_id' => $row['id'], 'action' => $action, 'actor_id' => $actor,
            'actor_name' => mb_substr($name, 0, 50), 'reason' => mb_substr($reason, 0, 255),
            'details' => json_encode($details, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    }

    public static function present(array $row): array
    {
        $row = array_intersect_key($row, array_flip(self::COLUMNS));
        $row['state'] = match ((int) $row['status']) {
            self::CLOSED => 'completed', self::REVOKED => 'revoked', self::REJECTED => 'rejected',
            self::PENDING => 'pending_admin', default => (int) $row['policy_version'] === 0 ? 'legacy' : (self::expired($row) ? 'expired' :
                match ((int) $row['finance_state']) { 2 => 'ready', 1 => 'pending_checker', default => 'pending_finance' }),
        };
        return $row;
    }

    public static function expired(array $row): bool
    {
        return empty($row['approval_expires_at']) || $row['approval_expires_at'] <= gmdate('Y-m-d H:i:s');
    }

    private static function reason(string $reason): string
    {
        $reason = trim($reason);
        if ($reason === '' || mb_strlen($reason) > 255) self::fail('A reason (up to 255 characters) is required');
        return $reason;
    }

    private static function assertBalance(string|float $balance, ?string $expected): void
    {
        if ($expected === null || ! is_numeric($expected) || WalletLedger::cents($balance) !== WalletLedger::cents($expected)) {
            self::fail('Wallet balance changed; reload and review the latest balance');
        }
    }

    private static function fail(string $message): never
    {
        throw new BusinessException(ErrorCode::DATA_CONFLICT, $message);
    }
}
