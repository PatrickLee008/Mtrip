<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Service\AccountDeletionExport;
use App\Service\AccountDeletionWorkflow;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class AccountDeletionReportController extends AccountDeletionController
{
    private function reportQuery()
    {
        return $this->query()->leftJoin('user_wallet_forfeit as f', 'f.deletion_id', '=', 'd.id')
            ->addSelect(['f.amount as ledger_amount','f.balance_log_id'])
            ->where(static fn ($q) => $q->where('d.requested_balance', '>', 0)->orWhere('d.approved_balance', '>', 0)->orWhereNotNull('f.id'));
    }

    private static function row(object $row): array
    {
        $raw = (array) $row;
        return AccountDeletionWorkflow::present($raw) + ['amount' => (string) ($raw['ledger_amount'] ?? '0.00'),
            'balance_log_id' => $raw['balance_log_id'], 'currency' => 'MMK'];
    }

    #[Permission('user:deletion:report')]
    public function index(): array
    {
        [$page, $size] = $this->pageParams();
        return Db::transaction(function () use ($page, $size): array {
            $q = $this->reportQuery();
            $total = (clone $q)->count();
            $sum = (clone $q)->select([])->selectRaw('COALESCE(SUM(CASE WHEN d.status=2 THEN f.amount ELSE 0 END),0) AS amount')->first();
            $rows = $q->orderByDesc('d.id')->forPage($page, $size)->get()->map(static fn ($r) => self::row($r))->all();
            $result = Result::page($rows, $total, $page, $size);
            $result['data']['summary'] = ['completedAmount' => (string) $sum->amount, 'currency' => 'MMK'];
            return $result;
        });
    }

    #[Permission('user:deletion:export')]
    public function export(): array
    {
        $format = $this->strInput('format', 'csv');
        if (! in_array($format, ['csv','xlsx'], true)) throw new BusinessException(ErrorCode::PARAM_ERROR);
        return Db::transaction(function () use ($format): array {
            $q = $this->reportQuery();
            if ((clone $q)->count() > 5000) throw new BusinessException(ErrorCode::PARAM_ERROR, 'Narrow the filters to at most 5000 rows');
            $rows = $q->orderByDesc('d.id')->get()->map(static fn ($r) => self::row($r))->all();
            $file = AccountDeletionExport::build($rows, $format);
            $filters = [];
            foreach (['siteId','userId','requestId','approverId','state','startDate','endDate'] as $key) $filters[$key] = $this->input($key);
            AccountDeletionWorkflow::event(['site_id' => AdminContext::siteId(), 'user_id' => 0, 'id' => 0],
                'report_exported', AdminContext::adminId(), AdminContext::adminName(), $format,
                ['filters' => $filters, 'rows' => count($rows), 'sha256' => hash('sha256', $file['base64'])]);
            return Result::success($file);
        });
    }
}
