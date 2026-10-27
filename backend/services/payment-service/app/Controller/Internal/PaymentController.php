<?php

declare(strict_types=1);

namespace App\Controller\Internal;

use App\Controller\AbstractController;
use App\Service\BizNotifyService;
use App\Service\PaymentService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Support\Result;

/**
 * 内部接口:支付单(方案 22 §4.2)—— 仅供 order-service / system-service 经 docker 内网调用
 * 鉴权由 InternalAuthMiddleware(/internal/* + X-Internal-Token)完成;入参出参驼峰。
 */
class PaymentController extends AbstractController
{
    #[Inject]
    protected PaymentService $payments;

    #[Inject]
    protected BizNotifyService $notifier;

    /** POST /internal/v1/payment/create */
    public function create(): array
    {
        return Result::success($this->payments->create($this->request->all()));
    }

    /** POST /internal/v1/payment/query(payNo 或 bizType+bizNo;refresh=1 实时查 KBZ) */
    public function query(): array
    {
        return Result::success($this->payments->query($this->request->all()));
    }

    /** POST /internal/v1/payment/renotify(payNo 或 refundNo) */
    public function renotify(): array
    {
        return Result::success($this->notifier->renotify($this->strInput('payNo'), $this->strInput('refundNo')));
    }
}