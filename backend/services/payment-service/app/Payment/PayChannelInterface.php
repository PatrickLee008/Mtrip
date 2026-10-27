<?php

declare(strict_types=1);

namespace App\Payment;

/**
 * 支付渠道抽象(文档模块8 支付管理 / 方案 22 §4.1)
 *
 * - Stripe/PayPal:配置存 mtrip_system.sys_pay_channel(api_key AES 加密),当前为空实现;
 * - KBZPay MMQR:账户 sys_pay_account + 站点绑定 sys_pay_channel,实现见 KbzMmqrChannel(按账户实例化)。
 *
 * 返回数组的键由各渠道补充,调用方只依赖下列公共键。
 */
interface PayChannelInterface
{
    /** 渠道标识:stripe / paypal / kbz_mmqr(对应 sys_pay_channel.channel_code) */
    public function code(): string;

    /**
     * 创建支付
     * @param array $order 公共键 ['orderNo'(我方支付单号),'amount','currency','subject'];
     *                     收银台类渠道另有 returnUrl/cancelUrl,扫码类另有 timeoutMinutes/notifyUrl/callbackInfo
     * @return array ['payUrl' => 收银台地址(扫码类为空), 'qrCode' => 二维码内容(跳转类为空),
     *                'channelTradeNo' => 渠道预交易号]
     */
    public function createPayment(array $order): array;

    /**
     * 发起退款(原路退回)
     * @param array $refund ['refundNo','orderNo'(我方支付单号),'channelTradeNo','amount','currency','reason']
     * @return array ['channelRefundNo' => 渠道退款单号, 'status' => processing|succeeded|failed]
     */
    public function createRefund(array $refund): array;

    /**
     * 回调验签并解析(Webhook);验签失败抛异常
     * @param string $payload 原始请求体
     * @param array $headers 请求头(含签名,如 Stripe-Signature / PayPal-Transmission-Sig;KBZ 签名在报文内)
     * @return array 标准化事件 ['event','orderNo','channelTradeNo','amount','currency','tradeStatus','paidAt']
     */
    public function verifyCallback(string $payload, array $headers): array;

    /**
     * 主动查询渠道交易状态(对账/补单)
     * @param string $tradeNo 查询键:KBZ 为我方支付单号(merch_order_id),Stripe/PayPal 为渠道交易号
     * @return array ['status' => pending|paid|failed|closed|unknown, 'tradeStatus' => 渠道原始状态,
     *                'channelTradeNo' => string, 'amount' => string, 'currency' => string]
     */
    public function queryPayment(string $tradeNo): array;
}
