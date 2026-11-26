<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;
use App\Service\MerchantAccountSecurityService;
use App\Service\MerchantLoginControlService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Support\Result;

class MerchantLoginControlController extends AbstractController
{
    #[Inject] protected MerchantLoginControlService $control;
    #[Inject] protected MerchantAccountSecurityService $security;

    #[Permission('merchant:list:security')]
    public function show(): array
    {
        $this->security->assertSuper();
        return Result::success($this->control->snapshot($this->security->merchant($this->requireId('merchantId'))));
    }

    #[Permission('merchant:list:security')]
    public function change(): array
    {
        $this->security->assertSuper();
        return Result::success($this->control->change(
            $this->security->merchant($this->requireId('merchantId')), $this->requireStr('action'), $this->intInput('deviceId'),
            $this->requireStr('reason'), $this->intInput('reviewed') === 1,
            ['id' => AdminContext::adminId(), 'name' => AdminContext::adminName()],
            $this->clientIp()
        ));
    }
}
