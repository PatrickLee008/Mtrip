<?php

declare(strict_types=1);

namespace App\Controller\Internal;

use App\Controller\AbstractController;
use App\Service\RefundService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Support\Result;

/**
 * 内部接口:退款(方案 22 §4.2)
 */
class RefundController extends AbstractController
{
    #[Inject]
    protected RefundService $refunds;

    /** POST /internal/v1/refund/create */
    public function create(): array
    {
        return Result::success($this->refunds->create($this->request->all()));
    }

    /** POST /internal/v1/refund/query */
    public function query(): array
    {
        return Result::success($this->refunds->query($this->request->all()));
    }
}