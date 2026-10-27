<?php

declare(strict_types=1);

namespace App\Controller;

use App\Payment\PayChannelInterface;
use App\Payment\PayPalChannel;
use App\Payment\StripeChannel;
use App\Service\PayCallbackService;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\ResponseInterface;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Support\Result;
use Psr\Http\Message\ResponseInterface as PsrResponseInterface;
use Psr\Log\LoggerInterface;

/**
 * 支付渠道回调入口(Webhook,不挂管理端中间件)
 * - Stripe / PayPal:本期仅落日志并应答 200 防渠道重试风暴;验签+订单状态推进归模块08
 * - KBZPay MMQR(方案 22 阶段 4):验签、比对金额、幂等落账,回纯文本 success / fail
 *
 * 不属任何 UI 端,留在 Controller 根目录(backend/services/AGENTS.md)。
 */
class CallbackController extends AbstractController
{
    private LoggerInterface $logger;

    #[Inject]
    protected ResponseInterface $response;

    #[Inject]
    protected PayCallbackService $kbzCallback;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get('payment-callback');
    }

    /** Stripe Webhook:POST /api/v1/payment/callback/stripe */
    public function stripe(): array
    {
        return $this->record($this->channel('stripe'));
    }

    /** PayPal Webhook:POST /api/v1/payment/callback/paypal */
    public function paypal(): array
    {
        return $this->record($this->channel('paypal'));
    }

    /**
     * KBZPay MMQR 异步通知:POST /api/v1/payment/callback/kbz-mmqr
     * 成功 / 已处理 / 金额不符(已告警)回 `success`;流水不存在、验签失败、异常回 `fail` 让 KBZ 重推。
     */
    public function kbzMmqr(): PsrResponseInterface
    {
        try {
            $ack = $this->kbzCallback->handleKbzMmqr((string) $this->request->getBody());
        } catch (\Throwable $e) {
            $this->logger->error('kbz_notify_exception', ['exception' => $e::class]);
            $ack = PayCallbackService::ACK_FAIL;
        }
        return $this->response->raw($ack)->withHeader('Content-Type', 'text/plain; charset=utf-8');
    }

    /** 记录原始回调(模块08 在此接入 verifyCallback + 订单状态机) */
    private function record(PayChannelInterface $channel): array
    {
        $payload = (string) $this->request->getBody();
        $this->logger->info('payment callback received', [
            'channel' => $channel->code(),
            'headers' => $this->request->getHeaders(),
            'payload' => mb_substr($payload, 0, 8000),
        ]);
        // 验签尚未启用,先确认收到避免渠道方持续重试;补单依赖 queryPayment 对账
        return Result::success(['received' => true]);
    }

    private function channel(string $code): PayChannelInterface
    {
        return $code === 'paypal' ? new PayPalChannel() : new StripeChannel();
    }
}
