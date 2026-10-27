<?php

declare(strict_types=1);

namespace App\Payment;

use Mtrip\Shared\Pay\KbzPay\KbzPayClient;

/**
 * KBZPay 客户端的本服务扩展:按退款单号查询
 *
 * 依据:官方 PHP SDK `QueryOrderRequest` 的 biz_content 除 merch_order_id 外还支持
 * `refund_request_no`(与 `mm_order_id`),即退款状态复用 kbz.payment.queryorder(version 3.0)查询,
 * KBZ 没有独立的退款查询接口。返回字段名未能在线核实,由 KbzMmqrChannel::extractRefund 防御式解析。
 */
class KbzMmqrClient extends KbzPayClient
{
    /** @return array<string, mixed> 验签通过的 Response 平铺数组(refund_info 不参与签名,原样保留) */
    public function queryRefund(string $merchOrderId, string $refundRequestNo): array
    {
        $biz = self::buildQueryBiz($this->config, $merchOrderId);
        $biz['refund_request_no'] = $refundRequestNo;
        $request = self::buildRequest(self::METHOD_QUERY_ORDER, $biz, $this->config->appKey, self::VERSION_3_0);
        return $this->send(self::urlFor($this->config->env, 'queryorder'), $request, false);
    }
}
