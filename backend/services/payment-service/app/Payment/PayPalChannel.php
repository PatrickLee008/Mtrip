<?php

declare(strict_types=1);

namespace App\Payment;

use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Exception\BusinessException;

/**
 * PayPal 渠道空实现(正式对接 PayPal Orders API/Webhook 归模块08)
 * 密钥从 sys_pay_channel(channel_code=paypal)读取后 CryptoHelper::decrypt
 */
class PayPalChannel implements PayChannelInterface
{
    public function code(): string
    {
        return 'paypal';
    }

    public function createPayment(array $order): array
    {
        throw new BusinessException(ErrorCode::SERVER_ERROR, 'PayPal 支付对接尚未启用(模块08)');
    }

    public function createRefund(array $refund): array
    {
        throw new BusinessException(ErrorCode::SERVER_ERROR, 'PayPal 退款对接尚未启用(模块08)');
    }

    public function verifyCallback(string $payload, array $headers): array
    {
        // 正式实现:PayPal-Transmission-Sig 证书链验签后解析 webhook event
        throw new BusinessException(ErrorCode::SERVER_ERROR, 'PayPal 回调验签尚未启用(模块08)');
    }

    public function queryPayment(string $channelTradeNo): array
    {
        throw new BusinessException(ErrorCode::SERVER_ERROR, 'PayPal 查询对接尚未启用(模块08)');
    }
}
