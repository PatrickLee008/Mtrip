<?php

declare(strict_types=1);

namespace App\Controller\App\Merchant;

use App\Controller\AbstractController;
use App\Service\MerchantLoginControlService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\ClientContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class SessionsController extends AbstractController
{
    #[Inject] protected MerchantLoginControlService $control;

    public function index(): array
    {
        return Result::success(['sessions' => $this->control->ownSessions(),
            'currentSessionId' => (int) (MerchantContext::get()['merchant_session_id'] ?? 0)]);
    }

    public function end(): array
    {
        $this->control->endOwnSession($this->requireId());
        return Result::success();
    }

    public function trust(): array
    {
        $platform = $this->nativePlatform();
        $installation = $this->strInput('installationKey') ?: bin2hex(random_bytes(32));
        return Result::success(['id' => $this->control->trustDevice($installation, $platform, $this->strInput('deviceName')),
            'installationKey' => $installation]);
    }

    public function untrust(): array
    {
        $this->nativePlatform();
        $this->control->untrustDevice();
        return Result::success();
    }

    private function nativePlatform(): string
    {
        $site = ClientContext::siteId();
        if ($site > 0 && $site !== MerchantContext::siteId()) throw new BusinessException(ErrorCode::FORBIDDEN);
        return match (ClientContext::get()['client_type'] ?? 0) {
            1 => 'android',
            2 => 'ios',
            default => throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL),
        };
    }
}
