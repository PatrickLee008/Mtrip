<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\TikTokLoginService;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\ResponseInterface;
use Psr\Http\Message\ResponseInterface as PsrResponse;

/** External TikTok browser callback; no UI-end authentication or client-sign headers. */
class TikTokCallbackController extends AbstractController
{
    #[Inject]
    protected TikTokLoginService $tiktok;

    #[Inject]
    protected ResponseInterface $response;

    public function callback(): PsrResponse
    {
        try {
            $destination = $this->tiktok->callback(
                $this->strInput('state'),
                (string) ($this->request->getCookieParams()[TikTokLoginService::COOKIE] ?? ''),
                $this->strInput('code'), $this->strInput('error'),
            );
            $response = $this->response->redirect($destination);
        } catch (\Throwable) {
            // An untrusted state must never choose a redirect or expose callback parameters.
            $response = $this->response->raw('TikTok login expired or invalid. Return to Mtrip and retry.')->withStatus(400);
        }
        return $response->withHeader('Cache-Control', 'no-store')->withHeader('Referrer-Policy', 'no-referrer');
    }
}
