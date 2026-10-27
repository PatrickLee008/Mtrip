<?php

declare(strict_types=1);

namespace App\Payment;

use Mtrip\Shared\Pay\KbzPay\KbzAccountConfig;
use Mtrip\Shared\Pay\KbzPay\KbzPayClient;
use Mtrip\Shared\Pay\KbzPay\KbzPayException;
use Mtrip\Shared\Payment\PaymentRules;

/**
 * KBZPay MMQR 渠道(方案 22 §1 / §5):按「一个收款账户 + 站点绑定」实例化
 *
 * 只做协议适配:出码、查单、退款、查退款、回调验签与字段标准化;
 * 选路、流水落库、幂等、outbox 在 App\Service 层。
 *
 * 安全:持有的 KbzAccountConfig 含 AppKey/证书明文,本类不记录任何日志。
 */
class KbzMmqrChannel implements PayChannelInterface
{
    public const CODE = 'kbz_mmqr';

    private KbzMmqrClient $client;

    public function __construct(private KbzAccountConfig $config, ?KbzMmqrClient $client = null)
    {
        $this->client = $client ?? new KbzMmqrClient($config);
    }

    public function code(): string
    {
        return self::CODE;
    }

    /**
     * @param array $order orderNo, amount, currency, subject, timeoutMinutes, notifyUrl, callbackInfo(可选)
     * @return array{payUrl: string, qrCode: string, channelTradeNo: string, prepayId: string}
     */
    public function createPayment(array $order): array
    {
        $params = [
            'merch_order_id' => (string) ($order['orderNo'] ?? ''),
            'total_amount' => (string) ($order['amount'] ?? ''),
            'trans_currency' => (string) ($order['currency'] ?? 'MMK'),
            'timeout_express' => PaymentRules::timeoutExpress((int) ($order['timeoutMinutes'] ?? 0)),
            'notify_url' => (string) ($order['notifyUrl'] ?? ''),
            'callback_info' => (string) ($order['callbackInfo'] ?? ''),
            'title' => (string) ($order['subject'] ?? ''),
        ];
        $resp = $this->client->precreate($params);
        $qr = (string) ($resp['qrCode'] ?? $resp['qr_code'] ?? '');
        if ($qr === '') {
            throw new KbzPayException(KbzPayException::KIND_PROTOCOL, 'KBZPay 下单成功但未返回 qrCode');
        }
        $prepayId = (string) ($resp['prepay_id'] ?? '');
        return ['payUrl' => '', 'qrCode' => $qr, 'channelTradeNo' => $prepayId, 'prepayId' => $prepayId];
    }

    /**
     * @param array $refund refundNo, orderNo, amount, reason
     * @return array{channelRefundNo: string, status: string, localStatus: ?int, refundStatus: string}
     */
    public function createRefund(array $refund): array
    {
        if (! $this->config->hasRefundCert()) {
            throw new KbzPayException(KbzPayException::KIND_CONFIG, 'KBZPay 退款需要双向证书,账户未配置证书或私钥');
        }
        $refundNo = (string) ($refund['refundNo'] ?? '');
        $resp = $this->client->refund([
            'refund_request_no' => $refundNo,
            'merch_order_id' => (string) ($refund['orderNo'] ?? ''),
            'refund_reason' => (string) ($refund['reason'] ?? ''),
            'refund_amount' => (string) ($refund['amount'] ?? ''),
        ]);
        $found = self::extractRefund($resp, $refundNo);
        // 受理成功但未带退款状态:按处理中,交给 refund-sync 查单收敛
        $local = $found['found'] ? ($found['localStatus'] ?? PaymentRules::REFUND_PROCESSING) : PaymentRules::REFUND_PROCESSING;
        return [
            'channelRefundNo' => $found['channelRefundNo'],
            'status' => PaymentRules::refundStatusName($local),
            'localStatus' => $local,
            'refundStatus' => $found['refundStatus'],
        ];
    }

    /**
     * 解析并验签异步通知(验签失败抛 KbzPayException kind=sign / protocol)
     */
    public function verifyCallback(string $payload, array $headers): array
    {
        $flat = KbzPayClient::parseNotify($payload, $this->config->appKey);
        return [
            'event' => 'payment',
            'orderNo' => (string) ($flat['merch_order_id'] ?? ''),
            'channelTradeNo' => (string) ($flat['mm_order_id'] ?? ''),
            'amount' => (string) ($flat['total_amount'] ?? ''),
            'currency' => strtoupper((string) ($flat['trans_currency'] ?? '')),
            'tradeStatus' => strtoupper((string) ($flat['trade_status'] ?? '')),
            'paidAt' => (string) ($flat['trans_end_time'] ?? ''),
            'appId' => (string) ($flat['appid'] ?? ''),
            'merchCode' => (string) ($flat['merch_code'] ?? ''),
        ];
    }

    /**
     * 查单(version 3.0)
     * @param string $tradeNo 我方支付单号(merch_order_id)
     */
    public function queryPayment(string $tradeNo): array
    {
        $flat = $this->client->queryOrder($tradeNo);
        $tradeStatus = strtoupper((string) ($flat['trade_status'] ?? ''));
        $local = PaymentRules::mapTradeStatus($tradeStatus);
        return [
            'status' => $local === null ? 'unknown' : PaymentRules::payStatusName($local),
            'localStatus' => $local,
            'tradeStatus' => $tradeStatus,
            'channelTradeNo' => (string) ($flat['mm_order_id'] ?? ''),
            'amount' => (string) ($flat['total_amount'] ?? ''),
            'currency' => strtoupper((string) ($flat['trans_currency'] ?? '')),
        ];
    }

    /**
     * 查退款(queryorder + refund_request_no)
     * @return array{found: bool, localStatus: ?int, refundStatus: string, channelRefundNo: string}
     */
    public function queryRefund(string $orderNo, string $refundNo): array
    {
        return self::extractRefund($this->client->queryRefund($orderNo, $refundNo), $refundNo);
    }

    /**
     * 从 refund / queryorder 响应中提取指定退款单的状态(字段名未能在线核实,防御式兼容)
     *
     * 依次尝试:
     *   1. 顶层 refund_status(带 refund_request_no 查询或 refund 接口直接回包),顶层 refund_request_no 若存在须一致;
     *   2. refund_info(JSONArray 或 JSON 字符串)中 refund_request_no 匹配的条目。
     * 注意:refund_info 不参与签名(方案 §1),其内容的可信度依赖传输层(Prod 为 https)。
     *
     * @param array<string, mixed> $flat
     * @return array{found: bool, localStatus: ?int, refundStatus: string, channelRefundNo: string}
     */
    public static function extractRefund(array $flat, string $refundNo): array
    {
        $none = ['found' => false, 'localStatus' => null, 'refundStatus' => '', 'channelRefundNo' => ''];

        $topNo = (string) ($flat['refund_request_no'] ?? '');
        $topStatus = (string) ($flat['refund_status'] ?? '');
        if ($topStatus !== '' && ($topNo === '' || $topNo === $refundNo)) {
            return self::refundItem($flat, $topStatus);
        }

        $info = $flat['refund_info'] ?? null;
        if (is_string($info) && $info !== '') {
            $decoded = json_decode($info, true);
            $info = is_array($decoded) ? $decoded : null;
        }
        if (! is_array($info)) {
            return $none;
        }
        foreach ($info as $item) {
            if (! is_array($item) || (string) ($item['refund_request_no'] ?? '') !== $refundNo) {
                continue;
            }
            $status = (string) ($item['refund_status'] ?? $item['status'] ?? '');
            return self::refundItem($item, $status);
        }
        return $none;
    }

    /** @param array<string, mixed> $item */
    private static function refundItem(array $item, string $status): array
    {
        $channelNo = '';
        foreach (['refund_order_id', 'mm_refund_order_id', 'refund_id', 'refund_no'] as $key) {
            if (isset($item[$key]) && is_scalar($item[$key]) && (string) $item[$key] !== '') {
                $channelNo = mb_substr((string) $item[$key], 0, 64);
                break;
            }
        }
        return [
            'found' => true,
            'localStatus' => PaymentRules::mapRefundStatus($status),
            'refundStatus' => strtoupper($status),
            'channelRefundNo' => $channelNo,
        ];
    }
}
