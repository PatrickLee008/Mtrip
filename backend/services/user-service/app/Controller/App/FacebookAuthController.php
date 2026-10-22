<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;
use App\Service\FacebookLoginService;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\ResponseInterface;
use Mtrip\Shared\Support\Result;
use Psr\Http\Message\ResponseInterface as PsrResponse;

class FacebookAuthController extends AbstractController
{
    #[Inject]
    protected FacebookLoginService $facebook;

    #[Inject]
    protected ResponseInterface $response;

    public function settings(): PsrResponse
    {
        return $this->response->json(Result::success($this->facebook->settings($this->request->getHeaderLine('origin'))))
            ->withHeader('Cache-Control', 'no-store');
    }

    public function start(): PsrResponse
    {
        $browser = bin2hex(random_bytes(32));
        $data = $this->facebook->start(
            $this->requireSiteId(), $this->request->getHeaderLine('origin'), $browser,
            $this->strInput('returnTo', 'home'), $this->requireStr('consentVersion'),
        );
        return $this->response->json(Result::success($data))
            ->withHeader('Cache-Control', 'no-store')
            ->withHeader('Set-Cookie', FacebookLoginService::COOKIE . '=' . $browser
                . '; Max-Age=600; Path=/; Secure; HttpOnly; SameSite=Lax');
    }

    public function exchange(): PsrResponse
    {
        $data = $this->facebook->exchange(
            $this->requireSiteId(), $this->request->getHeaderLine('origin'),
            (string) ($this->request->getCookieParams()[FacebookLoginService::COOKIE] ?? ''),
            $this->requireStr('ticket'), $this->clientIp(),
        );
        return $this->response->json(Result::success($data))->withHeader('Cache-Control', 'no-store')
            ->withHeader('Set-Cookie', FacebookLoginService::COOKIE . '=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax');
    }
}
