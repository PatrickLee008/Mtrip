<?php
declare(strict_types=1);
namespace App\Middleware;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/** Serialize admin lead edits with permanent deletion, including legacy uploads. */
final class OnboardingMutationMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $path = $request->getUri()->getPath();
        $input = array_merge($request->getQueryParams(), (array) $request->getParsedBody());
        if (strtoupper($request->getMethod()) !== 'POST' || !str_starts_with($path, '/api/v1/admin/merchant/onboarding/')
            || in_array(basename($path), ['add', 'delete', 'kyc-template-update', 'final-approve', 'credential-retry'], true) || (int) ($input['id'] ?? 0) <= 0) {
            return $handler->handle($request);
        }
        return Db::transaction(function () use ($input, $request, $handler): ResponseInterface {
            $app = Db::table('merchant_application')->where('id', (int) $input['id'])->whereNull('deleted_at')->lockForUpdate()->first();
            if (!$app) throw new BusinessException(ErrorCode::NOT_FOUND, '入驻申请不存在或已删除');
            if (!AdminContext::isSuper() && AdminContext::siteId() !== (int) $app->site_id) throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
            return $handler->handle($request);
        });
    }
}
