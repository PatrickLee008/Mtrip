<?php

declare(strict_types=1);

namespace App\Controller\App\Merchant;

use App\Controller\AbstractController;
use App\Service\MerchantAppOnboardingService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Support\Result;

class ApplicationController extends AbstractController
{
    #[Inject] protected MerchantAppOnboardingService $onboarding;
    public function save(): array { return Result::success($this->onboarding->save($this->requireAppSiteId(), $this->requireStr('registrationToken'), (array) $this->input('application', []))); }
    public function submit(): array { return Result::success($this->onboarding->submit($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId')), '申请已提交'); }
    public function status(): array { return Result::success($this->onboarding->status($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId'))); }
    public function kycRequirements(): array { return Result::success($this->onboarding->requirements($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId'))); }
    public function kycUpload(): array { return Result::success($this->onboarding->upload($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId'), $this->requireStr('docType'), $this->request->file('file')), '文件上传成功'); }
}
