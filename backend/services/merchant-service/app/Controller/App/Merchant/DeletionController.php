<?php

declare(strict_types=1);

namespace App\Controller\App\Merchant;

use App\Controller\AbstractController;
use App\Service\MerchantDeletionService;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\ResponseInterface;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\ClientContext;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;
use Psr\Http\Message\ResponseInterface as HttpResponse;

class DeletionController extends AbstractController
{
    #[Inject]
    protected MerchantDeletionService $deletions;

    #[Inject]
    protected ResponseInterface $response;

    public function current(): HttpResponse
    {
        $this->assertNativeClient();
        return $this->noStore($this->deletions->current());
    }

    public function send(): HttpResponse
    {
        $this->assertNativeClient();
        return $this->noStore($this->deletions->send($this->requireStr('channel'), $this->clientIp()));
    }

    public function submit(): HttpResponse
    {
        $this->assertNativeClient();
        return $this->noStore($this->deletions->submit($this->requireStr('reason'), $this->strInput('details'),
            $this->requireStr('challengeToken'), $this->requireStr('otpCode'), $this->clientIp()));
    }

    public function cancel(): HttpResponse
    {
        $this->assertNativeClient();
        return $this->noStore($this->deletions->cancel($this->requireId(), $this->clientIp()));
    }

    public function receipt(): HttpResponse
    {
        $this->assertNativeClient();
        return $this->noStore($this->deletions->receipt($this->requireId(), $this->requireStr('receiptToken'), ClientContext::siteId()));
    }

    private function assertNativeClient(): void
    {
        $client = ClientContext::get();
        if (! in_array($client['client_type'] ?? 0, [1, 2], true)) {
            throw new BusinessException(ErrorCode::CLIENT_AUTH_FAIL, '请使用商户移动端 App');
        }
        if (ClientContext::siteId() > 0 && MerchantContext::adminId() > 0 && ClientContext::siteId() !== MerchantContext::siteId()) {
            throw new BusinessException(ErrorCode::FORBIDDEN);
        }
    }

    private function noStore(array $data): HttpResponse
    {
        return $this->response->json(Result::success($data))->withHeader('Cache-Control', 'no-store');
    }
}
