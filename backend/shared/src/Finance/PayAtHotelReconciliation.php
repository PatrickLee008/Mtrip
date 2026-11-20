<?php

declare(strict_types=1);

namespace Mtrip\Shared\Finance;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Wallet\WalletLedger;

/** Current accounting totals, read while the caller holds the booking row lock. */
final class PayAtHotelReconciliation
{
    public static function totals(array $order): array
    {
        $id = (int) $order['id'];
        $entry = Db::table('finance_account_entry')->where('order_id', $id)->first();
        $rows = Db::table('order_refund')->where('order_id', $id)->whereNull('deleted_at')->get();
        $parts = ['refund_hotel_commission' => 0, 'refund_hotel_deposit' => 0, 'refund_transaction_fee' => 0, 'refund_addon' => 0];
        $refunded = 0; $blocked = false;
        foreach ($rows as $row) {
            if (in_array((int) $row->status, [0,1,2], true)) $blocked = true;
            if ((int) $row->status !== 3 || (int) $row->late_pay === 1) continue;
            $refunded += WalletLedger::cents($row->refund_amount);
            foreach ($parts as $key => $_) $parts[$key] += WalletLedger::cents($row->{$key});
        }
        $merchant = $entry ? WalletLedger::cents($entry->merchant_settlement) - $parts['refund_hotel_deposit'] - $parts['refund_addon'] : 0;
        $platform = $entry ? WalletLedger::cents($entry->platform_revenue) - $parts['refund_hotel_commission'] - $parts['refund_transaction_fee'] : 0;
        $income = WalletLedger::cents(Db::table('finance_flow')->where('order_id', $id)->where('flow_type', 1)->where('biz_type', 1)->where('flow_status', 1)->sum('amount'));
        $out = WalletLedger::cents(Db::table('finance_flow')->where('order_id', $id)->where('flow_type', 2)->where('biz_type', 2)->where('flow_status', 1)->sum('amount'));
        $matched = $entry && $merchant >= 0 && $platform >= 0 && array_sum($parts) === $refunded && $income - $out === $merchant + $platform;
        return ['matched' => (bool) $matched, 'blocked' => $blocked, 'merchantCents' => $merchant, 'platformCents' => $platform,
            'refundCents' => $refunded, 'incomeCents' => $income, 'outCents' => $out, 'refundComponents' => $parts,
            'entryId' => (int) ($entry->id ?? 0), 'commissionCents' => $entry ? WalletLedger::cents($entry->commission) - $parts['refund_hotel_commission'] : 0,
            'feeCents' => $entry ? WalletLedger::cents($entry->transaction_fee) - $parts['refund_transaction_fee'] : 0];
    }
}
