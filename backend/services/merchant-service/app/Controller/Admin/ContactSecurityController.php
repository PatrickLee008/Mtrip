<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;
use App\Service\MerchantContactRecoveryService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Support\Result;

class ContactSecurityController extends AbstractController
{
    #[Inject]
    protected MerchantContactRecoveryService $recovery;

    #[Permission('merchant:list:contacts')]
    public function correct(): array
    {
        return Result::success($this->recovery->correct($this->requireId('merchantId'), $this->requireStr('phone'),
            $this->requireStr('email'), $this->requireStr('reason')));
    }
}
