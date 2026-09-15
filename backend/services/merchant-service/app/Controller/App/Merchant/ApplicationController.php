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
    public function detail(): array { return Result::success($this->onboarding->detail($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId'))); }
    public function save(): array { return Result::success($this->onboarding->save($this->requireAppSiteId(), $this->requireStr('registrationToken'), (array) $this->input('application', []))); }
    public function submit(): array { return Result::success($this->onboarding->submit($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId')), '申请已提交'); }
    public function status(): array { return Result::success($this->onboarding->status($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId'))); }
    public function kycRequirements(): array { return Result::success($this->onboarding->requirements($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId'))); }
    public function kycUpload(): array { return Result::success($this->onboarding->upload($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId'), $this->requireStr('scopeType'), $this->intInput('applicationBusinessId'), $this->requireStr('docType'), $this->request->file('file')), '文件上传成功'); }
    public function agreement(): array { return Result::success($this->onboarding->agreement($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId'))); }
    public function agreementRead(): array { return Result::success($this->onboarding->agreementRead($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId'), $this->requireId('agreementId'), $this->requireStr('version'), filter_var($this->input('scrollConfirmed'), FILTER_VALIDATE_BOOL))); }
    public function agreementSign(): array { return Result::success($this->onboarding->agreementSign($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId'), $this->requireId('agreementId'), $this->requireStr('version'), $this->requireStr('readReceipt'), $this->requireStr('signerName'), $this->strInput('signerRole'), $this->requireStr('signature'), $this->clientIp(), $this->request->getHeaderLine('user-agent')), '条款签署成功'); }
    public function kycSubmit(): array { return Result::success($this->onboarding->submitKyc($this->requireAppSiteId(), $this->requireStr('registrationToken'), $this->requireId('applicationId')), 'KYC 已提交审核'); }
}
