<?php

declare(strict_types=1);

namespace Mtrip\Shared\Support;

use Mtrip\Shared\Constants\ErrorCode;

/**
 * 统一响应封装(对应功能设计文档 6.2 统一响应格式)
 */
class Result
{
    /**
     * 成功响应 {code, message, data, timestamp}
     */
    public static function success(mixed $data = null, string $message = 'success'): array
    {
        return [
            'code' => ErrorCode::SUCCESS,
            'message' => $message,
            'data' => $data,
            'timestamp' => time(),
        ];
    }

    /**
     * 分页响应 data = {list, total, page, pageSize}
     */
    public static function page(array $list, int $total, int $page, int $pageSize): array
    {
        return self::success([
            'list' => $list,
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
        ]);
    }

    /**
     * 失败响应
     */
    public static function error(int $code, ?string $message = null, mixed $data = null): array
    {
        return [
            'code' => $code,
            'message' => $message ?? ErrorCode::message($code),
            'data' => $data,
            'timestamp' => time(),
        ];
    }
}
