<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Account\AccountDeletionPolicy;

/** Read-only eligibility; never completes an old booking to enable deletion. */
final class AccountDeletionBookings
{
    public static function blockers(int $userId): array
    {
        $zones = Db::connection('system')->table('sys_site')->pluck('timezone', 'id')->all();
        $rows = Db::table('order_main')->where('user_id', $userId)->whereNull('deleted_at')
            ->get(['id', 'order_no', 'site_id', 'booking_status', 'order_status', 'refund_status', 'end_date']);
        $blocked = [];
        foreach ($rows as $row) {
            $row = (array) $row;
            try { $zone = new \DateTimeZone((string) ($zones[$row['site_id']] ?? 'UTC')); }
            catch (\Exception) { $zone = new \DateTimeZone('UTC'); }
            $today = (new \DateTimeImmutable('now', $zone))->format('Y-m-d');
            if (AccountDeletionPolicy::isOngoingBooking($row, $today)) $blocked[] = $row;
        }
        return $blocked;
    }
}
