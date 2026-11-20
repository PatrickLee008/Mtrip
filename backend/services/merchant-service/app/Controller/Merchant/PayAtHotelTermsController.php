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
use Mtrip\Shared\Merchant\PayAtHotelTerms;

class PayAtHotelTermsController extends AbstractController
{
    #[Inject]
    protected PayAtHotelTermsService $terms;

    public function show(): array
    {
        $merchant = $this->merchant();
        return Result::success($this->present($merchant, $this->terms->current($merchant)));
    }

    public function save(): array
    {
        if (! MerchantContext::isOwner() || MerchantContext::accountType() !== 2) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅商户主账号可更新未到店费用');
        }
        $merchant = $this->merchant();
        $input = [];
        foreach (['noShowEnabled','depositRate','selectionVersion','policyVersion','policySource'] as $key) $input[$key] = $this->input($key);
        return Result::success($this->present($merchant, $this->terms->saveMerchant($merchant, $input, MerchantContext::adminId())));
    }

    private function present(array $merchant, array $terms): array
    {
        $terms['properties'] = Db::table('merchant_store')->where('merchant_id', $merchant['id'])->where('site_id', $merchant['site_id'])
            ->whereIn('id', MerchantContext::scopePropertyIds())->whereNull('deleted_at')->orderBy('id')->get()
            ->map(static function ($row) use ($merchant) {
                $effective = PayAtHotelTerms::resolve($merchant, (array) $row);
                return ['id' => (int) $row->id, 'store_name' => $row->store_name,
                    'commission_rate' => $effective['commission_rate'], 'commission_scope' => $effective['commission_scope']];
            })->all();
        return $terms;
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
