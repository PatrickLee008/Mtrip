<?php

declare(strict_types=1);

namespace Mtrip\Shared\Merchant;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/** M12经营状态；审核、注销及商品上架状态不由此规则改写。 */
final class MerchantAccessPolicy
{
    public static function canAccess(int $status, bool $blacklisted): bool
    {
        return ! $blacklisted && in_array($status, [3, 4], true);
    }

    public static function canBook(int $status, bool $blacklisted): bool
    {
        return $status === 3 && ! $blacklisted;
    }

    public static function label(int $status, bool $blacklisted): string
    {
        return $blacklisted ? 'blacklisted' : ($status === 3 ? 'active' : 'suspended');
    }

    public static function target(int $status, bool $blacklisted, bool $requiresSuper, string $action, bool $isSuper): int
    {
        if (in_array($action, ['blacklist', 'unblacklist', 'reactivate'], true) && ! $isSuper) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '此操作仅限授权超级管理员');
        }
        if (in_array($action, ['activate', 'expire'], true) && $requiresSuper) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '解除黑名单后须由超级管理员单独重新激活');
        }
        $allowed = match ($action) {
            'suspend' => $status === 3 && ! $blacklisted,
            'activate', 'expire' => $status === 4 && ! $blacklisted && ! $requiresSuper,
            'reactivate' => $status === 4 && ! $blacklisted && $requiresSuper,
            'blacklist' => in_array($status, [3, 4], true) && ! $blacklisted,
            'unblacklist' => $status === 4 && $blacklisted,
            default => false,
        };
        if (! $allowed) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '当前状态不允许此操作，请刷新后重试');
        }
        return in_array($action, ['activate', 'reactivate', 'expire'], true) ? 3 : 4;
    }

    /** 仅接受明确时区的ISO8601，持久化UTC；重试的未来时间校验由事务服务处理。 */
    public static function deadline(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/D', $value)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '暂停截止时间须为含时区的ISO8601时间');
        }
        try {
            $date = new \DateTimeImmutable($value);
            $errors = \DateTimeImmutable::getLastErrors();
            if ($errors && ($errors['warning_count'] || $errors['error_count'])) {
                throw new \InvalidArgumentException();
            }
            return $date->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        } catch (\Exception) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '暂停截止时间无效');
        }
    }
}
