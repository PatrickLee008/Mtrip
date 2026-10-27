<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

final class SupportTicketPolicy
{
    public const STATES = ['open', 'in_progress', 'waiting_merchant', 'waiting_support', 'resolved', 'closed'];
    public const ACTIVE = ['open', 'in_progress', 'waiting_merchant', 'waiting_support'];
    public const CATEGORIES = ['payout', 'booking', 'technical', 'inventory_pricing', 'reviews', 'rooms', 'other'];
    public const PRIORITIES = ['low', 'medium', 'high'];
    public const MAX_ATTACHMENTS = 5;
    public const MAX_FILE_BYTES = 10000000;

    public static function target(string $status, string $actor, string $action, string $requested = '', bool $assigned = false): string
    {
        if (! in_array($status, self::STATES, true) || ! in_array($actor, ['merchant', 'admin'], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR);
        }
        $active = in_array($status, self::ACTIVE, true);
        $target = match ($action) {
            'reply' => $active ? ($actor === 'merchant' ? 'waiting_support' : ($requested ?: 'waiting_merchant')) : null,
            'assign' => $active && $actor === 'admin' ? ($status === 'open' && $assigned ? 'in_progress' : $status) : null,
            'priority' => $active && $actor === 'admin' ? $status : null,
            'status' => $active && $actor === 'admin' ? $requested : null,
            'close' => $status !== 'closed' ? 'closed' : null,
            'reopen' => ! $active ? ($actor === 'merchant' ? 'waiting_support' : ($assigned ? 'in_progress' : 'open')) : null,
            default => null,
        };
        if ($target === null || ! in_array($target, self::STATES, true)
            || ($action === 'status' && ! in_array($target, ['in_progress', 'waiting_merchant', 'waiting_support', 'resolved', 'closed'], true))
            || ($action === 'reply' && $actor === 'admin' && ! in_array($target, ['waiting_merchant', 'in_progress', 'resolved'], true))) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '工单状态已变化或不允许此操作，请刷新');
        }
        return $target;
    }

    public static function text(array $input, string $key, int $max, bool $required = true): string
    {
        $value = $input[$key] ?? '';
        if (! is_string($value) || mb_strlen(trim($value)) > $max || ($required && trim($value) === '')) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, $key . '不能为空或超长');
        }
        return trim($value);
    }

    public static function integer(array $input, string $key, int $min = 1): int
    {
        $raw = $input[$key] ?? null;
        $value = is_int($raw) || is_string($raw) ? filter_var($raw, FILTER_VALIDATE_INT) : false;
        if ($value === false || $value < $min) throw new BusinessException(ErrorCode::PARAM_ERROR, $key . '无效');
        return $value;
    }
}
