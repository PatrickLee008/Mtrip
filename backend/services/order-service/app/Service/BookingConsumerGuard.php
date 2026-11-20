<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/** Final booking commit and account deletion serialize on the same consumer row. */
final class BookingConsumerGuard
{
    public static function lockActive(int $site, int $user): void
    {
        $row = Db::table('user_info')->where('id', $user)->where('site_id', $site)
            ->whereNull('deleted_at')->lockForUpdate()->first();
        if (! $row || (int) $row->user_status !== 1) {
            throw new BusinessException(ErrorCode::FORBIDDEN, 'Consumer account is not active');
        }
    }
}
