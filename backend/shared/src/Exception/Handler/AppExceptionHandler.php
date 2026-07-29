<?php

declare(strict_types=1);

namespace Mtrip\Shared\Exception\Handler;

use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\ExceptionHandler\ExceptionHandler;
use Hyperf\HttpMessage\Stream\SwooleStream;
use Hyperf\Validation\ValidationException;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;
use Psr\Http\Message\ResponseInterface;
use Throwable;

/**
 * 全局异常处理器:BusinessException / ValidationException / 其他异常 → 统一 JSON
 */
class AppExceptionHandler extends ExceptionHandler
{
    public function __construct(protected StdoutLoggerInterface $logger)
    {
    }

    public function handle(Throwable $throwable, ResponseInterface $response): ResponseInterface
    {
        $this->stopPropagation();

        if ($throwable instanceof BusinessException) {
            $code = $throwable->getCode();
            $body = Result::error($code, $throwable->getMessage());
        } elseif ($throwable instanceof ValidationException) {
            $code = ErrorCode::PARAM_VALIDATE_FAIL;
            $body = Result::error($code, $throwable->validator->errors()->first());
        } else {
            $code = ErrorCode::SERVER_ERROR;
            $this->logger->error(sprintf(
                '%s[%s] in %s%s%s',
                $throwable->getMessage(),
                $throwable->getLine(),
                $throwable->getFile(),
                PHP_EOL,
                $throwable->getTraceAsString()
            ));
            $body = Result::error($code);
        }

        return $response
            ->withHeader('Content-Type', 'application/json; charset=utf-8')
            ->withStatus(ErrorCode::httpStatus($code))
            ->withBody(new SwooleStream(json_encode($body, JSON_UNESCAPED_UNICODE)));
    }

    public function isValid(Throwable $throwable): bool
    {
        return true;
    }
}
