<?php

declare(strict_types=1);

namespace Mtrip\Shared\Exception;

use Mtrip\Shared\Constants\ErrorCode;

/**
 * 业务异常:抛出后由 AppExceptionHandler 转换为统一 JSON 响应
 * 可选 $data 原样放进响应的 data(例如 PRICE_CHANGED 携带最新金额明细),缺省为 null。
 */
class BusinessException extends \RuntimeException
{
    public function __construct(
        int $code = ErrorCode::SERVER_ERROR,
        ?string $message = null,
        protected mixed $data = null
    ) {
        parent::__construct($message ?? ErrorCode::message($code), $code);
    }

    public function getData(): mixed
    {
        return $this->data;
    }
}
