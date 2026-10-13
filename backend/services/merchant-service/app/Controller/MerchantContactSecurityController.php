<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\MerchantAuthenticationService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Support\Result;

/** Shared Merchant Web and Merchant App contact security endpoints. */
class MerchantContactSecurityController extends AbstractController
{
    #[Inject]
    protected MerchantAuthenticationService $authentication;

    #[Inject]
    protected \Hyperf\HttpServer\Contract\ResponseInterface $response;

    public function contacts(): \Psr\Http\Message\ResponseInterface
    {
        return $this->result($this->authentication->contacts());
    }

    public function send(): \Psr\Http\Message\ResponseInterface
    {
        return $this->result($this->authentication->sendContactOtp($this->requireStr('channel'), $this->clientIp()));
    }

    public function verify(): \Psr\Http\Message\ResponseInterface
    {
        return $this->result($this->authentication->verifyContactOtp($this->requireStr('challengeToken'), $this->requireStr('otpCode'), $this->clientIp()));
    }

    public function claimPhone(): \Psr\Http\Message\ResponseInterface
    {
        return $this->result($this->authentication->claimPhoneOtp($this->requireStr('applicationNo'), $this->requireStr('phone'), $this->clientIp()));
    }

    public function rebindStart(): \Psr\Http\Message\ResponseInterface
    {
        return $this->result($this->authentication->startRebind($this->requireStr('verifiedChannel'), $this->requireStr('twoFaCode'), $this->clientIp()));
    }

    public function rebindNew(): \Psr\Http\Message\ResponseInterface
    {
        return $this->result($this->authentication->sendRebindNew($this->requireStr('challengeToken'), $this->requireStr('otpCode'),
            $this->requireStr('channel'), $this->requireStr('newContact'), $this->clientIp()));
    }

    public function rebindFinish(): \Psr\Http\Message\ResponseInterface
    {
        return $this->result($this->authentication->finishRebind($this->requireStr('challengeToken'), $this->requireStr('otpCode'), $this->clientIp()));
    }

    public function claimEmail(): \Psr\Http\Message\ResponseInterface
    {
        return $this->result($this->authentication->claimEmailOtp($this->requireStr('challengeToken'), $this->requireStr('otpCode'), $this->clientIp()));
    }

    public function claimFinish(): \Psr\Http\Message\ResponseInterface
    {
        return $this->result($this->authentication->claimCredentials($this->requireStr('challengeToken'), $this->requireStr('otpCode'), $this->clientIp()));
    }

    private function result(array $data): \Psr\Http\Message\ResponseInterface
    {
        return $this->response->json(Result::success($data))->withHeader('Cache-Control', 'no-store');
    }
}
