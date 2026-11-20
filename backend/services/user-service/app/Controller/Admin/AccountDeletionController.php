<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Service\AccountDeletionBookings;
use App\Service\AccountDeletionWorkflow;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;
use Mtrip\Shared\Wallet\WalletLedger;

class AccountDeletionController extends AbstractAdminController
{
    #[Inject]
    protected AccountDeletionWorkflow $workflow;

    #[Permission('user:deletion:list')]
    public function index(): array
    {
        [$page, $size] = $this->pageParams();
        $q = $this->query();
        $total = (clone $q)->count();
        $rows = $q->orderByDesc('d.id')->forPage($page, $size)->get()->map(static fn ($r) => AccountDeletionWorkflow::present((array) $r))->all();
        return Result::page($rows, $total, $page, $size);
    }

    #[Permission('user:deletion:list')]
    public function detail(): array
    {
        $row = Db::table('user_account_deletion')->where('id', $this->requireId())->first(AccountDeletionWorkflow::COLUMNS);
        if (! $row) throw new BusinessException(ErrorCode::NOT_FOUND);
        $this->assertSiteScope((int) $row->site_id);
        $user = Db::transaction(function () use ($row) {
            $user = Db::table('user_info')->where('id', $row->user_id)->lockForUpdate()->first(['id','site_id','user_status','balance']);
            if ($user) {
                $this->assertSiteScope((int) $user->site_id);
                // Show the same spendable balance Finance will review, including normally expired lots.
                $user->balance = WalletLedger::money(WalletLedger::cents(WalletLedger::availableLocked((int) $user->id)));
            }
            return $user;
        });
        return Result::success(['request' => AccountDeletionWorkflow::present((array) $row), 'consumer' => $user,
            'blockers' => AccountDeletionBookings::blockers((int) $row->user_id), 'policy' => AccountDeletionWorkflow::policy(),
            'events' => Db::table('user_account_deletion_event')->where('deletion_id', $row->id)->orderBy('id')->get()->toArray()]);
    }

    #[Permission('user:deletion:request')]
    public function request(): array
    {
        $user = Db::table('user_info')->where('id', $this->requireId('userId'))->whereNull('deleted_at')->first();
        if (! $user) throw new BusinessException(ErrorCode::NOT_FOUND);
        $this->assertSiteScope((int) $user->site_id);
        return Result::success($this->workflow->request((array) $user, $this->requireStr('reason'), $this->strInput('evidence'),
            AdminContext::adminId(), AdminContext::adminName()));
    }

    #[Permission('user:list:approve-deletion')]
    public function approve(): array
    {
        $this->superOnly();
        return Result::success($this->workflow->approve($this->requireId('requestId'), $this->approvalFlag(),
            $this->requireStr('reason'), AdminContext::adminId(), AdminContext::adminName(), $this->scope(), $this->strInput('expectedBalance')));
    }

    #[Permission('user:list:approve-deletion')]
    public function revoke(): array
    {
        $this->superOnly();
        return Result::success($this->workflow->revoke($this->requireId('requestId'), $this->requireStr('reason'),
            AdminContext::adminId(), AdminContext::adminName(), $this->scope()));
    }

    #[Permission('user:deletion:prepare')]
    public function prepare(): array { return $this->finance(false); }

    #[Permission('user:deletion:check')]
    public function check(): array { return $this->finance(true); }

    private function finance(bool $check): array
    {
        return Result::success($this->workflow->finance($this->requireId('requestId'), $check, $this->approvalFlag(),
            $this->requireStr('reason'), AdminContext::adminId(), AdminContext::adminName(), $this->scope(), $this->strInput('expectedBalance')));
    }

    #[Permission('user:deletion:config')]
    public function config(): array
    {
        $this->superOnly();
        return Result::success(['current' => AccountDeletionWorkflow::policy(),
            'history' => Db::table('user_account_deletion_config')->orderByDesc('id')->get()->toArray(),
            'version' => (int) Db::table('user_account_deletion_config')->max('id')]);
    }

    #[Permission('user:deletion:config')]
    public function saveConfig(): array
    {
        $this->superOnly();
        $keys = ['thresholdAmount','validityDays','effectiveAt','expectedVersion','reason'];
        $data = [];
        foreach ($keys as $key) $data[$key] = $this->input($key);
        return Result::success($this->workflow->savePolicy($data, AdminContext::adminId(), AdminContext::adminName()));
    }

    protected function query()
    {
        $q = Db::table('user_account_deletion as d')->select(array_map(static fn ($c) => 'd.' . $c, AccountDeletionWorkflow::COLUMNS));
        $this->applySiteScope($q, 'd.site_id');
        if (($id = $this->intInput('userId')) > 0) $q->where('d.user_id', $id);
        if (($id = $this->intInput('requestId')) > 0) $q->where('d.id', $id);
        if (($actor = $this->intInput('approverId')) > 0) $q->where('d.approved_by', $actor);
        foreach (['startDate' => '>=', 'endDate' => '<='] as $key => $operator) {
            if (($date = $this->strInput($key)) !== '') {
                if (! preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date)) throw new BusinessException(ErrorCode::PARAM_ERROR);
                $q->where('d.created_at', $operator, $date . ($operator === '>=' ? ' 00:00:00' : ' 23:59:59'));
            }
        }
        if (($state = $this->strInput('state')) !== '') {
            $q->whereRaw("CASE WHEN d.status=2 THEN 'completed' WHEN d.status=3 THEN 'revoked' WHEN d.status=5 THEN 'rejected'
                WHEN d.status=4 THEN 'pending_admin' WHEN d.policy_version=0 THEN 'legacy' WHEN d.approval_expires_at IS NULL OR d.approval_expires_at<=UTC_TIMESTAMP() THEN 'expired'
                WHEN d.finance_state=2 THEN 'ready' WHEN d.finance_state=1 THEN 'pending_checker' ELSE 'pending_finance' END = ?", [$state]);
        }
        return $q;
    }

    private function approvalFlag(): bool
    {
        $flag = $this->input('approve');
        if (! in_array($flag, [0,1,'0','1'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR, 'approve must be 0 or 1');
        return (int) $flag === 1;
    }

    private function superOnly(): void
    {
        if (! AdminContext::isSuper()) throw new BusinessException(ErrorCode::FORBIDDEN);
    }

    private function scope(): callable { return fn (int $site) => $this->assertSiteScope($site); }
}
