<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\AppleLoginService;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\ResponseInterface;
use Psr\Http\Message\ResponseInterface as PsrResponse;

/** External Apple browser callback; no UI-end authentication or client-sign headers. */
class AppleCallbackController extends AbstractController
{
    #[Inject]
    protected AppleLoginService $apple;

    #[Inject]
    protected ResponseInterface $response;

    public function callback(): PsrResponse
    {
        try {
            $destination = $this->apple->callback(
                $this->strInput('state'),
                (string) ($this->request->getCookieParams()[AppleLoginService::COOKIE] ?? ''),
                $this->strInput('code'), $this->strInput('error'), $this->strInput('user'),
            );
            $response = $this->response->redirect($destination)->withStatus(303);
        } catch (\Throwable) {
            // An untrusted state must never choose a redirect or expose callback parameters.
            $response = $this->response->raw('Apple login expired or invalid. Return to Mtrip and retry.')->withStatus(400);
        }
        return $response->withHeader('Cache-Control', 'no-store')->withHeader('Referrer-Policy', 'no-referrer');
    }
}
