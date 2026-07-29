<?php

declare(strict_types=1);

namespace App\Payment;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * Stripe 渠道空实现(正式对接 Stripe Checkout/Webhook 归模块08)
 * 密钥从 sys_pay_channel(channel_code=stripe)读取后 CryptoHelper::decrypt
 */
class StripeChannel implements PayChannelInterface
{
    public function code(): string
    {
        return 'stripe';
    }

    public function createPayment(array $order): array
    {
        throw new BusinessException(ErrorCode::SERVER_ERROR, 'Stripe 支付对接尚未启用(模块08)');
    }

    public function createRefund(array $refund): array
    {
        throw new BusinessException(ErrorCode::SERVER_ERROR, 'Stripe 退款对接尚未启用(模块08)');
    }

    public function verifyCallback(string $payload, array $headers): array
    {
        // 正式实现:校验 Stripe-Signature 头(webhook secret HMAC)后解析 event
        throw new BusinessException(ErrorCode::SERVER_ERROR, 'Stripe 回调验签尚未启用(模块08)');
    }

    public function queryPayment(string $channelTradeNo): array
    {
        throw new BusinessException(ErrorCode::SERVER_ERROR, 'Stripe 查询对接尚未启用(模块08)');
    }
}
