<?php

declare(strict_types=1);

namespace App\Controller\Internal;

use App\Controller\AbstractController;
use App\Service\Payment\PaymentSettleService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Support\Result;

/**
 * 支付中心业务通知接收(方案 22 §4.2):POST /internal/v1/order/payment-notify
 *
 * - 鉴权:InternalAuthMiddleware(docker 内网来源 + X-Internal-Token),网关无 /internal location;
 * - body 为 payment-service BizNotifyService 的事件:paid / refunded / refund_failed(驼峰字段);
 * - 业务结论(已入账 / 已恢复 / 已发起退款 / 退款失败转人工 / 忽略)一律回 code=0 确认,不让支付中心重推;
 *   只有数据库等非预期异常才回非 0,由支付中心 outbox 退避重推(处理全程幂等)。
 */
class PaymentNotifyController extends AbstractController
{
    #[Inject]
    protected PaymentSettleService $settle;

    public function notify(): array
    {
        return Result::success($this->settle->handleNotify($this->request->all()));
    }
}
