<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Payment\PaymentRules;

/**
 * Crontab pay-reconcile(每分钟):主动查单收敛 pending 流水(方案 22 §1「通知可能丢失」/ §9 阶段 8)
 *
 * - pending 且创建超过 1 分钟:queryOrder → PAY_SUCCESS 落账(同回调 settlePaid)、ORDER_EXPIRED/ORDER_CLOSED → closed、
 *   PAY_FAILED → failed;WAIT_PAY/PAYING 且 expire_at 已过 5 分钟 → 本轮查单仍未付即 closed;
 * - 被新流水替代(closed + SUPERSEDED)的旧流水:KBZ 侧码可能仍有效,继续查到 KBZ 终态,付了按迟到支付落账;
 * - 金额不符(fail_reason AMOUNT_MISMATCH)的流水不再自动处理,等人工;
 * - KBZ 网络 / 协议错误跳过,下轮再试。
 */
class PayReconcileService
{
    private const BATCH = 100;

    #[Inject]
    protected PaymentService $payments;

    #[Inject]
    protected LoggerFactory $loggerFactory;

    public function run(): void
    {
        $before = gmdate('Y-m-d H:i:s', time() - 60);
        $rows = Db::table('pay_transaction')
            ->where('channel_code', 'kbz_mmqr')
            ->where('created_at', '<', $before)
            ->where(static function ($q) {
                $q->where(static function ($p) {
                    $p->where('status', PaymentRules::PAY_PENDING)->where('fail_reason', 'not like', 'AMOUNT_MISMATCH%');
                })->orWhere(static function ($s) {
                    $s->where('status', PaymentRules::PAY_CLOSED)->where('fail_reason', PaymentService::REASON_SUPERSEDED);
                });
            })
            ->orderBy('id')->limit(self::BATCH)->get();

        $stats = [];
        foreach ($rows as $row) {
            try {
                $outcome = $this->payments->syncWithChannel((array) $row, true);
            } catch (\Throwable $e) {
                $outcome = 'error';
                $this->loggerFactory->get('payment')->error('pay_reconcile_exception', ['payNo' => $row->pay_no, 'exception' => $e::class]);
            }
            $stats[$outcome] = ($stats[$outcome] ?? 0) + 1;
        }
        if ($stats !== []) {
            $this->loggerFactory->get('payment')->info('pay_reconcile_done', $stats);
        }
    }
}
