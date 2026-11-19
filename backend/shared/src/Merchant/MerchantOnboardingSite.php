<?php
declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/** New merchants currently onboard into Yangon; existing tenants retain their scope. */
final class MerchantOnboardingSite
{
    public const ID = 7;

    public static function forAdmin(bool $isSuper, int $adminSiteId): int
    {
        if (! $isSuper && $adminSiteId !== self::ID) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '新商户统一归属站点7，当前账号无该站点权限');
        }
        return self::ID;
    }

    public static function assertNewMerchant(int $siteId): void
    {
        if ($siteId !== self::ID) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '新商户统一归属站点7，请先迁移旧站点的入驻申请');
        }
    }
}
