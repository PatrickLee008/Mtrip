<?php

declare(strict_types=1);

namespace App\Service;

use App\Service\Booking\BookingEventService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Finance\PayAtHotelReconciliation;
use Mtrip\Shared\Wallet\WalletLedger;

/** Operational completion is check-in; financial reconciliation and payout records are separate. */
final class PayAtHotelSettlementService
{
    #[Inject]
    protected BookingEventService $events;

    public function generateDue(int $limit = 200): array
    {
        $ids = Db::table('order_main')->where('pay_at_hotel', 1)->whereNull('deleted_at')
            ->whereIn('booking_status', [4,5,6])->whereIn('payment_status', [2,3,4])->whereIn('pay_method', [3,5])
            ->whereRaw("JSON_TYPE(JSON_EXTRACT(hotel_terms_snapshot, '$.commercialTerms')) = 'OBJECT'")
            ->where('hotel_reconciliation_status', '<>', 1)
            ->orderBy('id')->limit(min(1000, max(1, $limit)))->pluck('id')->all();
        $result = ['reconciled' => 0, 'review' => 0, 'pending' => 0];
        foreach ($ids as $id) {
            $state = Db::transaction(function () use ($id): string {
                $order = (array) Db::table('order_main')->where('id', $id)->lockForUpdate()->first();
                if ((int) $order['booking_status'] === 6) {
                    $policy = json_decode((string) $order['no_show_policy_snapshot'], true) ?: [];
                    try { $zone = new \DateTimeZone($policy['timezone'] ?? 'UTC'); } catch (\Exception) { $zone = new \DateTimeZone('UTC'); }
                    if (($order['end_date'] ?? '9999-12-31') >= (new \DateTimeImmutable('now', $zone))->format('Y-m-d')) return 'pending';
                }
                $money = PayAtHotelReconciliation::totals($order);
                if ($money['blocked']) return 'pending';
                $settle = Db::table('finance_merchant_settle')->where('order_id', $id)->lockForUpdate()->first();
                if (! $money['matched'] || ($settle && (int) $settle->status === 2 && WalletLedger::cents($settle->settle_amount) !== $money['merchantCents'])) {
                    if ((int) $order['hotel_reconciliation_status'] !== 2) {
                        Db::table('order_main')->where('id', $id)->update(['hotel_reconciliation_status' => 2]);
                        $this->events->log($order, 'hotel_reconciliation_review', 0, 0, 'System', 2, $money, 'settlement');
                    }
                    return 'review';
                }
                $fields = ['order_amount' => $order['pay_amount'], 'refund_amount' => WalletLedger::money($money['refundCents']),
                    'commission' => WalletLedger::money($money['commissionCents']), 'settle_amount' => WalletLedger::money($money['merchantCents']),
                    'accounting_snapshot' => json_encode($money + ['orderNo' => $order['order_no'],
                        'terms' => json_decode($order['hotel_terms_snapshot'], true), 'reconciledAt' => gmdate('Y-m-d H:i:s')], JSON_THROW_ON_ERROR)];
                if (! $settle) {
                    Db::table('finance_merchant_settle')->insert($fields + ['settle_no' => 'PAH' . $order['order_no'],
                        'site_id' => $order['site_id'], 'merchant_id' => $order['merchant_id'], 'property_id' => $order['property_id'],
                        'order_id' => $id, 'settle_cycle' => 'B-' . dechex((int) $id), 'order_count' => 1, 'status' => 0,
                        'remark' => 'Booking ' . $order['order_no'] . ': prepaid merchant portion only']);
                } elseif ((int) $settle->status !== 2 && (WalletLedger::cents($settle->settle_amount) !== $money['merchantCents']
                    || WalletLedger::cents($settle->refund_amount) !== $money['refundCents'])) {
                    Db::table('finance_merchant_settle')->where('id', $settle->id)->update($fields + ['status' => 0, 'confirm_by' => null, 'confirm_time' => null]);
                    $this->events->log($order, 'hotel_settlement_recalculated', 0, 0, 'System', 1, $money, 'settlement');
                }
                if ((int) $order['hotel_reconciliation_status'] !== 1) {
                    Db::table('order_main')->where('id', $id)->update(['hotel_reconciliation_status' => 1, 'hotel_reconciled_at' => gmdate('Y-m-d H:i:s')]);
                    $this->events->log($order, 'hotel_reconciled', 0, 0, 'System', 1, $money, 'settlement');
                }
                return 'reconciled';
            });
            $result[$state]++;
        }
        return $result;
    }
}
