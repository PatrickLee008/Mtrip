<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 优惠券模板管理(文档 6.4.6)
 * 状态机:0未开始 →(发布)1进行中 ⇄(停发/恢复)2已停发;1/2 →(结束)3已结束
 * 券类型:1满减 2折扣(discount_value=折扣率如8.50,max_discount 封顶) 3无门槛
 */
class CouponController extends AbstractController
{
    /** 优惠券列表:筛选 名称/类型/状态 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('marketing_coupon')->whereNull('deleted_at');
        $this->applySiteScope($query);
        if (($name = $this->strInput('couponName')) !== '') {
            $query->where('coupon_name', 'like', "%{$name}%");
        }
        if (($type = $this->intInput('couponType')) > 0) {
            $query->where('coupon_type', $type);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['goods_ids'] = $this->jsonDecode($row['goods_ids']);
                $row['property_ids'] = $this->jsonDecode($row['property_ids'] ?? null);
                $row['sku_ids'] = $this->jsonDecode($row['sku_ids'] ?? null);
                $row['room_type_ids'] = $this->jsonDecode($row['room_type_ids'] ?? null);
                unset($row['deleted_at']);
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 优惠券详情 */
    public function detail(): array
    {
        $coupon = $this->findScoped($this->requireId());
        $coupon['goods_ids'] = $this->jsonDecode($coupon['goods_ids']);
        $coupon['property_ids'] = $this->jsonDecode($coupon['property_ids'] ?? null);
        $coupon['sku_ids'] = $this->jsonDecode($coupon['sku_ids'] ?? null);
        $coupon['room_type_ids'] = $this->jsonDecode($coupon['room_type_ids'] ?? null);
        unset($coupon['deleted_at']);
        return Result::success($coupon);
    }

    /** 新增优惠券(初始状态 0未开始) */
    #[Permission('marketing:coupon:add')]
    public function add(): array
    {
        $siteId = AdminContext::isSuper() ? $this->requireId('siteId') : (int) AdminContext::siteId();
        $data = $this->validatedPayload($siteId);
        $data['site_id'] = $siteId;
        $data['status'] = 0;
        $id = Db::table('marketing_coupon')->insertGetId($data);
        return Result::success(['id' => $id], '优惠券已创建');
    }

    /** 编辑优惠券:仅未开始(0)可改全部;进行中仅可增发 totalCount */
    #[Permission('marketing:coupon:edit')]
    public function update(): array
    {
        $coupon = $this->findScoped($this->requireId());
        $status = (int) $coupon['status'];
        if ($status === 0) {
            Db::table('marketing_coupon')->where('id', $coupon['id'])->update($this->validatedPayload((int) $coupon['site_id']));
            return Result::success(null, '优惠券已更新');
        }
        if ($status === 1) {
            // 进行中仅允许增发数量(不得低于已领取)
            $totalCount = $this->intInput('totalCount', -1);
            if ($totalCount < 0) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '进行中的优惠券仅可调整发行总量');
            }
            if ($totalCount !== 0 && $totalCount < (int) $coupon['received_count']) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '发行总量不得低于已领取数量');
            }
            Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['total_count' => $totalCount]);
            return Result::success(null, '发行总量已调整');
        }
        throw new BusinessException(ErrorCode::DATA_CONFLICT, '已停发/已结束优惠券不可编辑');
    }

    /** 发布:0未开始 → 1进行中 */
    #[Permission('marketing:coupon:edit')]
    public function publish(): array
    {
        $coupon = $this->findScoped($this->requireId());
        if ((int) $coupon['status'] !== 0) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅未开始优惠券可发布');
        }
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['status' => 1]);
        return Result::success(null, '优惠券已发布');
    }

    /** 停发/恢复:1进行中 ⇄ 2已停发(已领取券不受影响) */
    #[Permission('marketing:coupon:stop')]
    public function toggleStatus(): array
    {
        $coupon = $this->findScoped($this->requireId());
        $status = (int) $coupon['status'];
        if (! in_array($status, [1, 2], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅进行中/已停发优惠券可切换');
        }
        $target = $status === 1 ? 2 : 1;
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['status' => $target]);
        return Result::success(['status' => $target], $target === 2 ? '优惠券已停发' : '优惠券已恢复发放');
    }

    /** 结束:1/2 → 3已结束(不可逆) */
    #[Permission('marketing:coupon:stop')]
    public function finish(): array
    {
        $coupon = $this->findScoped($this->requireId());
        if (! in_array((int) $coupon['status'], [1, 2], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅进行中/已停发优惠券可结束');
        }
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['status' => 3]);
        return Result::success(null, '优惠券已结束');
    }

    /** 删除(软删):仅未开始或已结束 */
    #[Permission('marketing:coupon:delete')]
    public function remove(): array
    {
        $coupon = $this->findScoped($this->requireId());
        if (! in_array((int) $coupon['status'], [0, 3], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅未开始/已结束优惠券可删除');
        }
        Db::table('marketing_coupon')->where('id', $coupon['id'])->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '优惠券已删除');
    }

    /** 领券记录:筛选 券模板/用户/状态 */
    public function receives(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('marketing_coupon_receive');
        $this->applySiteScope($query);
        if (($couponId = $this->intInput('couponId')) > 0) {
            $query->where('coupon_id', $couponId);
        }
        if (($userId = $this->intInput('userId')) > 0) {
            $query->where('user_id', $userId);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 组装并校验优惠券入参 */
    private function validatedPayload(int $siteId): array
    {
        $couponType = $this->intInput('couponType');
        if (! in_array($couponType, [1, 2, 3], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 couponType 不正确');
        }
        $discountValue = round($this->floatInput('discountValue'), 2);
        if ($discountValue <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '优惠值须大于0');
        }
        if ($couponType === 2 && $discountValue >= 10) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '折扣率须小于10(如8.50=85折)');
        }
        $goodsScope = $this->intInput('goodsScope');
        if (! in_array($goodsScope, [0, 1, 2, 3], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 goodsScope 不正确');
        }
        $goodsIds = $goodsScope === 3 ? $this->idList($this->input('goodsIds')) : [];
        $propertyIds = $goodsScope === 3 ? $this->idList($this->input('propertyIds')) : [];
        $skuIds = $goodsScope === 3 ? $this->idList($this->input('skuIds')) : [];
        $roomTypeIds = $goodsScope === 3 ? $this->idList($this->input('roomTypeIds')) : [];
        if ($goodsScope === 3 && $goodsIds === [] && $propertyIds === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '指定范围必须选择物业或门票商品');
        }
        $this->validateScopeIds($siteId, $propertyIds, $roomTypeIds, $goodsIds, $skuIds);
        $validType = $this->intInput('validType', 1);
        $validStart = $this->strInput('validStart');
        $validEnd = $this->strInput('validEnd');
        $validDays = $this->intInput('validDays');
        if ($validType === 1 && ($validStart === '' || $validEnd === '' || $validStart > $validEnd)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '固定有效期起止时间不正确');
        }
        if ($validType === 2 && $validDays <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '领取后有效天数须大于0');
        }
        return [
            'coupon_name' => $this->requireStr('couponName'),
            'coupon_type' => $couponType,
            'discount_value' => $discountValue,
            'min_amount' => round($this->floatInput('minAmount'), 2),
            'max_discount' => round($this->floatInput('maxDiscount'), 2),
            'funding_source' => in_array($this->intInput('fundingSource', 1), [1, 2, 3, 4], true) ? $this->intInput('fundingSource', 1) : 1,
            'funding_rules' => is_array($fr = $this->input('fundingRules')) ? json_encode($fr, JSON_UNESCAPED_UNICODE) : null,
            'goods_scope' => $goodsScope,
            'goods_ids' => $goodsIds === [] ? null : json_encode($goodsIds),
            'property_ids' => $propertyIds === [] ? null : json_encode($propertyIds),
            'sku_ids' => $skuIds === [] ? null : json_encode(array_map('intval', $skuIds)),
            'room_type_ids' => $roomTypeIds === [] ? null : json_encode(array_map('intval', $roomTypeIds)),
            'total_count' => max(0, $this->intInput('totalCount')),
            'per_user_limit' => max(1, $this->intInput('perUserLimit', 1)),
            'valid_type' => $validType,
            'valid_start' => $validType === 1 ? $validStart : null,
            'valid_end' => $validType === 1 ? $validEnd : null,
            'valid_days' => $validType === 2 ? $validDays : 0,
            'remark' => mb_substr($this->strInput('remark'), 0, 500),
        ];
    }

    private function validateScopeIds(int $siteId, array $propertyIds, array $roomTypeIds, array $goodsIds, array $skuIds): void
    {
        if ($propertyIds !== [] && Db::table('merchant_store')->whereIn('id', $propertyIds)
            ->where('site_id', $siteId)->where('business_type', 'hotel')->whereNull('deleted_at')->count() !== count($propertyIds)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '物业不属于优惠券站点');
        }
        if ($roomTypeIds !== [] && ($propertyIds === [] || Db::table('hotel_room_type')->whereIn('id', $roomTypeIds)
            ->whereIn('property_id', $propertyIds)->where('site_id', $siteId)->whereNull('deleted_at')->count() !== count($roomTypeIds))) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '房型必须属于所选物业');
        }
        if ($goodsIds !== [] && Db::table('goods_info')->whereIn('id', $goodsIds)
            ->where('site_id', $siteId)->where('goods_type', 2)->whereNull('deleted_at')->count() !== count($goodsIds)) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION, '门票商品不属于优惠券站点');
        }
        if ($skuIds !== [] && ($goodsIds === [] || Db::table('ticket_type')->whereIn('id', $skuIds)
            ->whereIn('goods_id', $goodsIds)->where('site_id', $siteId)->whereNull('deleted_at')->count() !== count($skuIds))) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '票种必须属于所选门票商品');
        }
    }

    private function idList(mixed $value): array
    {
        if (! is_array($value)) return [];
        $ids = array_values(array_unique(array_map('intval', $value)));
        foreach ($ids as $id) {
            if ($id <= 0) throw new BusinessException(ErrorCode::PARAM_ERROR, '适用范围 ID 不正确');
        }
        return $ids;
    }

    /** 取优惠券并校验站点数据权限 */
    private function findScoped(int $id): array
    {
        $coupon = Db::table('marketing_coupon')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $coupon) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '优惠券不存在');
        }
        $coupon = (array) $coupon;
        $this->assertSiteScope((int) $coupon['site_id']);
        return $coupon;
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
