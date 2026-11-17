<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use App\Service\PayAtHotelTermsService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class PayAtHotelTermsController extends AbstractController
{
    #[Inject]
    protected PayAtHotelTermsService $terms;

    public function show(): array
    {
        $merchant = $this->merchant();
        return Result::success($this->terms->current($merchant));
    }

    public function save(): array
    {
        if (! MerchantContext::isOwner() || MerchantContext::accountType() !== 2) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅商户主账号可更新未到店费用');
        }
        $merchant = $this->merchant();
        $enabled = filter_var($this->input('noShowEnabled', false), FILTER_VALIDATE_BOOLEAN);
        $rate = $this->floatInput('depositRate', 0);
        return Result::success($this->terms->saveMerchant($merchant, $enabled, $rate, MerchantContext::adminId()));
    }

    private function merchant(): array
    {
        $row = Db::table('merchant_info')->where('id', MerchantContext::merchantId())
            ->where('site_id', MerchantContext::siteId())->whereNull('deleted_at')->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '商户不存在');
        }
        return (array) $row;
    }
}
