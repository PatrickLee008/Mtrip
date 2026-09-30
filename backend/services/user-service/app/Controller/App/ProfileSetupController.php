<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;
use App\Service\ProfileSetupService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Support\Result;

/**
 * C端「Set Up Profile」向导:资料回填 / 第 1 步个人资料 / 第 2 步实名资料 / 图片上传
 */
class ProfileSetupController extends AbstractController
{
    #[Inject]
    protected ProfileSetupService $service;

    /** 向导回填(本人明文) */
    public function detail(): array
    {
        return Result::success($this->service->detail(UserContext::userId()));
    }

    /** 第 1 步:Complete Your Profile */
    public function saveProfile(): array
    {
        return Result::success($this->service->saveProfile(UserContext::userId(), $this->request->all()), '资料已保存');
    }

    /** 第 2 步:Identity Verification,提交后进入审核中 */
    public function submitIdentity(): array
    {
        return Result::success($this->service->submitIdentity(UserContext::userId(), $this->request->all()), '已提交审核');
    }

    /** 图片上传(multipart:scene + file) */
    public function upload(): array
    {
        return Result::success($this->service->upload(UserContext::userId(), $this->strInput('scene'), $this->request->file('file')));
    }
}
