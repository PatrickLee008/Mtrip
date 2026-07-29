<?php

declare(strict_types=1);

namespace App\Payment;

/**
 * 支付渠道抽象(文档模块8 支付管理)
 * 渠道配置存 mtrip_system.sys_pay_channel(api_key AES 加密,channel_code=stripe/paypal)
 * 正式收单/退款/验签对接归模块08,本期仅提供接口约束与空实现
 */
interface PayChannelInterface
{
    /** 渠道标识:stripe / paypal(对应 sys_pay_channel.channel_code) */
    public function code(): string;

    /**
     * 创建支付(收银台/跳转链接)
     * @param array $order ['orderNo','amount','currency','subject','returnUrl','cancelUrl']
     * @return array ['payUrl' => 渠道收银台地址, 'channelTradeNo' => 渠道预交易号]
     */
    public function createPayment(array $order): array;

    /**
     * 发起退款(原路退回)
     * @param array $refund ['refundNo','channelTradeNo','amount','currency','reason']
     * @return array ['channelRefundNo' => 渠道退款单号, 'status' => processing|succeeded]
     */
    public function createRefund(array $refund): array;

    /**
     * 回调验签并解析(Webhook)
     * @param string $payload 原始请求体
     * @param array $headers 请求头(含签名,如 Stripe-Signature / PayPal-Transmission-Sig)
     * @return array 标准化事件 ['event','orderNo','channelTradeNo','amount','currency','paidAt']
     */
    public function verifyCallback(string $payload, array $headers): array;

    /**
     * 主动查询渠道交易状态(对账/补单)
     * @return array ['status' => pending|succeeded|failed, 'channelTradeNo' => string]
     */
    public function queryPayment(string $channelTradeNo): array;
}
