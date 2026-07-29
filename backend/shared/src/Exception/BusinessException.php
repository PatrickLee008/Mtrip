<?php

declare(strict_types=1);

namespace Mtrip\Shared\Exception;

use Mtrip\Shared\Constants\ErrorCode;

/**
 * 业务异常:抛出后由 AppExceptionHandler 转换为统一 JSON 响应
 */
class BusinessException extends \RuntimeException
{
    public function __construct(int $code = ErrorCode::SERVER_ERROR, ?string $message = null)
    {
        parent::__construct($message ?? ErrorCode::message($code), $code);
    }
}
