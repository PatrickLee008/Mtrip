<?php

declare(strict_types=1);

namespace App\Controller;

use App\Payment\PayChannelInterface;
use App\Payment\PayPalChannel;
use App\Payment\StripeChannel;
use Hyperf\Logger\LoggerFactory;
use Mtrip\Shared\Support\Result;
use Psr\Log\LoggerInterface;

/**
 * 支付渠道回调入口(Webhook,不挂管理端中间件)
 * 本期仅落日志并应答 200 防渠道重试风暴;验签+订单状态推进归模块08
 */
class CallbackController extends AbstractController
{
    private LoggerInterface $logger;

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
