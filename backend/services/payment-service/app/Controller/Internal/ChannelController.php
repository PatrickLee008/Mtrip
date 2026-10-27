<?php

declare(strict_types=1);

namespace App\Controller\Internal;

use App\Controller\AbstractController;
use App\Service\ChannelTestService;
use App\Service\PayAccountResolver;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Support\Result;

/**
 * 内部接口:渠道(方案 22 §4.2)—— 收款账户连通性测试,权限与站点隔离由调用方 system-service 负责
 */
class ChannelController extends AbstractController
{
    #[Inject]
    protected ChannelTestService $tester;

    #[Inject]
    protected PayAccountResolver $resolver;

    /** POST /internal/v1/channel/test(accountId)→ {ok, kind, code, message} */
    public function test(): array
    {
        return Result::success($this->tester->test($this->requireId('accountId')));
    }

    /**
     * POST /internal/v1/channel/available(siteId)→ [{channel, currencies, minAmount, maxAmount}]
     * 沿站点树回溯取第一个可用绑定;绑定或收款账户停用即不可用(返回空数组)。供 order-service 渲染支付方式。
     */
    public function available(): array
    {
        return Result::success($this->resolver->availableForSite(max(0, $this->intInput('siteId'))));
    }
}