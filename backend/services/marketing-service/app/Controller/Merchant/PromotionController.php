<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

class PromotionController extends AbstractController
{
    public function summary(): array
    {
        $base = $this->baseQuery();
        $row = (array) (clone $base)->first([
            Db::raw('COUNT(*) AS total'),
            Db::raw('SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS draft'),
            Db::raw('SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS active'),
            Db::raw('SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS paused'),
            Db::raw('SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS ended'),
            Db::raw('COALESCE(SUM(received_count),0) AS claimed'),
            Db::raw('COALESCE(SUM(used_count),0) AS used'),
            Db::raw('COALESCE(SUM(CASE WHEN total_count > 0 THEN total_count * discount_value ELSE received_count * discount_value END),0) AS estimated_budget'),
        ]);

        return Result::success([
            'total' => (int) ($row['total'] ?? 0),
            'draft' => (int) ($row['draft'] ?? 0),
            'active' => (int) ($row['active'] ?? 0),
            'paused' => (int) ($row['paused'] ?? 0),
            'ended' => (int) ($row['ended'] ?? 0),
            'claimed' => (int) ($row['claimed'] ?? 0),
            'used' => (int) ($row['used'] ?? 0),
            'estimatedBudget' => round((float) ($row['estimated_budget'] ?? 0), 2),
        ]);
    }

    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = $this->baseQuery('c');

        if (($keyword = $this->strInput('keyword')) !== '') {
            $query->where(static function ($q) use ($keyword) {
                $q->where('c.coupon_name', 'like', "%{$keyword}%")
                    ->orWhere('c.remark', 'like', "%{$keyword}%")
                    ->orWhere('m.merchant_name', 'like', "%{$keyword}%");
            });
        }
        if (($type = $this->intInput('couponType')) > 0) {
            $query->where('c.coupon_type', $type);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('c.status', (int) $status);
        }

        $total = (clone $query)->count();
        $list = $query->orderByDesc('c.id')
            ->forPage($page, $pageSize)
            ->get($this->columns())
            ->map(fn ($row) => $this->normalize((array) $row))
            ->all();

        return Result::page($list, $total, $page, $pageSize);
    }

    public function detail(): array
    {
        return Result::success($this->findScoped($this->requireId()));
    }

    #[Permission('mch:promotions:add')]
    public function add(): array
    {
        $merchantId = $this->resolveMerchantId();
        $data = $this->validatedPayload($merchantId);
        $data['merchant_id'] = $merchantId;
        $data['site_id'] = $this->merchantSiteId($merchantId);
        $data['status'] = 0;
        $data['created_by_merchant_admin'] = MerchantContext::adminId();
        $id = (int) Db::table('marketing_coupon')->insertGetId($data);

        return Result::success(['id' => $id], 'promotion created');
    }

    #[Permission('mch:promotions:edit')]
    public function update(): array
    {
        $coupon = $this->findScoped($this->requireId());
        if (! in_array((int) $coupon['status'], [0, 2], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'only draft or paused promotions can be edited');
        }
        $data = $this->validatedPayload((int) $coupon['merchant_id']);
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update($data);

        return Result::success(null, 'promotion updated');
    }

    #[Permission('mch:promotions:status')]
    public function publish(): array
    {
        $coupon = $this->findScoped($this->requireId());
        if ((int) $coupon['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'only draft promotions can be published');
        }
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['status' => 1]);

        return Result::success(['status' => 1], 'promotion published');
    }

    #[Permission('mch:promotions:status')]
    public function toggleStatus(): array
    {
        $coupon = $this->findScoped($this->requireId());
        $status = (int) $coupon['status'];
        if (! in_array($status, [1, 2], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'only active or paused promotions can be toggled');
        }
        $next = $status === 1 ? 2 : 1;
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['status' => $next]);

        return Result::success(['status' => $next], 'promotion status updated');
    }

    #[Permission('mch:promotions:delete')]
    public function remove(): array
    {
        $coupon = $this->findScoped($this->requireId());
        if (! in_array((int) $coupon['status'], [0, 3], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, 'only draft or ended promotions can be deleted');
        }
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['deleted_at' => date('Y-m-d H:i:s')]);

        return Result::success(null, 'promotion deleted');
    }

    private function baseQuery(string $alias = ''): mixed
    {
        if ($alias === 'c') {
            return Db::table('marketing_coupon as c')
                ->leftJoin('merchant_info as m', 'm.id', '=', 'c.merchant_id')
                ->whereNull('c.deleted_at')
                ->whereIn('c.merchant_id', $this->scopeMerchantIds());
        }

        return Db::table('marketing_coupon')
            ->whereNull('deleted_at')
            ->whereIn('merchant_id', $this->scopeMerchantIds());
    }

    private function columns(): array
    {
        return [
            'c.id', 'c.site_id', 'c.merchant_id', 'c.coupon_name', 'c.coupon_type',
            'c.discount_value', 'c.min_amount', 'c.max_discount', 'c.funding_source',
            'c.goods_scope', 'c.goods_ids', 'c.total_count', 'c.received_count',
            'c.used_count', 'c.per_user_limit', 'c.valid_type', 'c.valid_start',
            'c.valid_end', 'c.valid_days', 'c.status', 'c.remark', 'c.created_at',
            'c.updated_at', 'm.merchant_name',
        ];
    }

    private function findScoped(int $id): array
    {
        $row = $this->baseQuery('c')->where('c.id', $id)->first($this->columns());
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, 'promotion not found');
        }

        return $this->normalize((array) $row);
    }

    private function validatedPayload(int $merchantId): array
    {
        $couponType = $this->intInput('couponType');
        if (! in_array($couponType, [1, 2, 3], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'invalid couponType');
        }
        $discountValue = round($this->floatInput('discountValue'), 2);
        if ($discountValue <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'discountValue must be greater than 0');
        }
        if ($couponType === 2 && $discountValue >= 10) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'discount coupon must be less than 10');
        }

        $goodsIds = $this->validGoodsIds($merchantId, (array) ($this->input('goodsIds') ?? []));
        if ($goodsIds === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'please select at least one goods item');
        }

        $validType = $this->intInput('validType', 1);
        if (! in_array($validType, [1, 2], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'invalid validType');
        }
        $validStart = $this->strInput('validStart');
        $validEnd = $this->strInput('validEnd');
        $validDays = $this->intInput('validDays');
        if ($validType === 1 && ($validStart === '' || $validEnd === '' || $validStart > $validEnd)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'invalid valid date range');
        }
        if ($validType === 2 && $validDays <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'validDays must be greater than 0');
        }

        return [
            'coupon_name' => $this->requireStr('couponName'),
            'coupon_type' => $couponType,
            'discount_value' => $discountValue,
            'min_amount' => round($this->floatInput('minAmount'), 2),
            'max_discount' => round($this->floatInput('maxDiscount'), 2),
            'funding_source' => 2,
            'funding_rules' => json_encode(['merchant' => 100], JSON_UNESCAPED_UNICODE),
            'goods_scope' => 3,
            'goods_ids' => json_encode($goodsIds, JSON_UNESCAPED_UNICODE),
            'total_count' => max(0, $this->intInput('totalCount')),
            'per_user_limit' => max(1, $this->intInput('perUserLimit', 1)),
            'valid_type' => $validType,
            'valid_start' => $validType === 1 ? $validStart : null,
            'valid_end' => $validType === 1 ? $validEnd : null,
            'valid_days' => $validType === 2 ? $validDays : 0,
            'remark' => mb_substr($this->strInput('remark'), 0, 500),
        ];
    }

    private function validGoodsIds(int $merchantId, array $inputIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $inputIds))));
        if ($ids === []) {
            return [];
        }

        $valid = Db::table('goods_info')
            ->where('merchant_id', $merchantId)
            ->whereIn('id', $ids)
            ->whereNull('deleted_at')
            ->where('status', '<>', 5)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        sort($valid);
        sort($ids);
        if ($valid !== $ids) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, 'selected goods are out of scope');
        }

        return $ids;
    }

    private function resolveMerchantId(): int
    {
        $scope = MerchantContext::scopeMerchantIds();
        if ($scope === []) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        if (MerchantContext::accountType() === 1) {
            $merchantId = $this->requireId('merchantId');
            if (! in_array($merchantId, $scope, true)) {
                throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, 'merchant out of scope');
            }
            return $merchantId;
        }

        return $scope[0];
    }

    private function merchantSiteId(int $merchantId): int
    {
        return (int) (Db::table('merchant_info')->where('id', $merchantId)->value('site_id') ?? MerchantContext::siteId());
    }

    private function normalize(array $row): array
    {
        $row['goods_ids'] = $this->jsonDecode($row['goods_ids'] ?? null);
        $row['budget_estimate'] = round(((int) ($row['total_count'] ?? 0)) * ((float) ($row['discount_value'] ?? 0)), 2);
        unset($row['deleted_at']);

        return $row;
    }

    private function scopeMerchantIds(): array
    {
        $ids = MerchantContext::scopeMerchantIds();
        return $ids === [] ? [0] : $ids;
    }

    private function jsonDecode(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : [];
        }
        return [];
    }
}
