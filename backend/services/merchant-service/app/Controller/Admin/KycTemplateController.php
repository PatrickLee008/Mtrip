<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;
use App\Service\KycTemplateService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Support\Result;

class KycTemplateController extends AbstractController
{
    #[Inject]
    protected KycTemplateService $templates;

    #[Permission('config:kyc:list')]
    public function index(): array { return Result::success($this->templates->listing($this->request->all())); }

    #[Permission('config:kyc:list')]
    public function history(): array { return Result::success($this->templates->history($this->request->all())); }

    #[Permission('config:kyc:add')]
    public function create(): array { return Result::success($this->templates->create($this->request->all())); }

    #[Permission('config:kyc:edit')]
    public function update(): array { return Result::success($this->templates->update($this->request->all())); }

    #[Permission('config:kyc:status')]
    public function status(): array { return Result::success($this->templates->status($this->request->all())); }
}
