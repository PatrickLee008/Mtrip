<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use App\Service\PropertyKycService;
use App\Service\PropertyProfileService;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class PropertyController extends AbstractController
{
    #[Inject]
    protected PropertyKycService $properties;

    #[Inject]
    protected PropertyProfileService $profiles;

    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $data = $this->properties->properties($page, $pageSize);
        return Result::page($data['list'], $data['total'], $data['page'], $data['pageSize']);
    }

    public function kyc(): array
    {
        return Result::success($this->properties->requirements($this->requireId('propertyId')));
    }

    public function profile(): array
    {
        return Result::success($this->profiles->detail($this->requireId('propertyId')));
    }

    #[Permission('mch:properties:add')]
    public function save(): array
    {
        return Result::success($this->properties->save($this->request->all()), '物业草稿已保存');
    }

    #[Permission('mch:properties:kyc-upload')]
    public function upload(): array
    {
        return Result::success($this->properties->upload(
            $this->requireId('propertyId'),
            $this->requireStr('docType'),
            $this->request->file('file')
        ), '文件上传成功');
    }

    #[Permission('mch:properties:kyc-submit')]
    public function submit(): array
    {
        return Result::success($this->properties->submit($this->requireId('propertyId')), '物业 KYC 已提交审核');
    }

    #[Permission(['mch:properties:profile-edit', 'mch:properties:profile-submit'])]
    public function saveProfile(): array
    {
        $submit = $this->intInput('submit') === 1;
        $required = $submit ? 'mch:properties:profile-submit' : 'mch:properties:profile-edit';
        if (! MerchantContext::hasPermission($required)) {
            throw new BusinessException(ErrorCode::FORBIDDEN);
        }
        return Result::success($this->profiles->save($this->request->all(), $submit),
            $submit ? '物业资料已提交审核' : '物业资料草稿已保存');
    }

    #[Permission('mch:properties:publish')]
    public function publish(): array
    {
        return Result::success($this->profiles->publish($this->requireId('propertyId'), $this->intInput('enabled') === 1));
    }
}
