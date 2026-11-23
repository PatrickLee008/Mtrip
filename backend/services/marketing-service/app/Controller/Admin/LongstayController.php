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
use Mtrip\Shared\Support\LongStayOffer;

/**
 * 管理端长住折扣梯度(PRD 模块2.1):列表 / 保存 / 删除
 */
class LongstayController extends AbstractController
{
    /** 梯度列表(按最低夜数升序) */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('marketing_longstay_tier')->whereNull('deleted_at');
        $this->applySiteScope($query);
        $total = (clone $query)->count();
        $list = $query->orderBy('min_nights')->orderBy('id')->forPage($page, $pageSize)
            ->get()->map(static fn ($row) => (array) $row)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 新增/编辑梯度:minNights/discountRate/status */
    #[Permission('marketing:longstay:save')]
    public function save(): array
    {
        $minNights = $this->intInput('minNights');
        $discountRate = round($this->floatInput('discountRate'), 2);
        if ($minNights < 1 || $minNights > LongStayOffer::MAX_BOOKABLE_NIGHTS) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '最低夜数须为 1 至 ' . LongStayOffer::MAX_BOOKABLE_NIGHTS);
        }
        if ($discountRate <= 0 || $discountRate >= 100) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '折扣率须为0-100之间');
        }
        $status = $this->intInput('status', 1) === 2 ? 2 : 1;
        $data = ['min_nights' => $minNights, 'discount_rate' => $discountRate, 'status' => $status];

        $id = $this->intInput('id');
        $siteId = AdminContext::siteId();
        $row = null;
        if ($id > 0) {
            $row = Db::table('marketing_longstay_tier')->where('id', $id)->whereNull('deleted_at')->first();
            if (! $row) {
                throw new BusinessException(ErrorCode::NOT_FOUND, '梯度不存在');
            }
            $this->assertSiteScope((int) ((array) $row)['site_id']);
            $siteId = (int) $row->site_id;
        } elseif ($siteId === 0) {
            $siteId = $this->requireId('siteId');
            $this->assertSiteScope($siteId);
        }

        $propertyId = $this->intInput('propertyId', (int) ($row->property_id ?? 0));
        if ($propertyId < 0 || ($propertyId > 0 && ! Db::table('merchant_store')->where('site_id', $siteId)
            ->where('id', $propertyId)->where('business_type', 'hotel')->whereNull('deleted_at')->exists())) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择该站点内的酒店');
        }
        $startsAt = $this->parseSchedule('startsAt', $row->starts_at ?? null);
        $endsAt = $this->parseSchedule('endsAt', $row->ends_at ?? null);
        if ($startsAt !== null && $endsAt !== null && $startsAt >= $endsAt) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '结束时间须晚于开始时间');
        }
        $stackable = $this->input('couponStackable', $row ? $row->coupon_stackable : 0);
        if (! in_array($stackable, [null, 0, 1, false, true], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '优惠券叠加设置无效');
        }
        $data += ['property_id' => $propertyId, 'starts_at' => $startsAt, 'ends_at' => $endsAt,
            'priority' => $this->intInput('priority', (int) ($row->priority ?? 0)),
            'coupon_stackable' => $stackable === null ? null : (int) $stackable];

        if ($id > 0) {
            Db::table('marketing_longstay_tier')->where('id', $id)->update($data);
            return Result::success(['id' => $id], '已保存');
        }
        $data['site_id'] = $siteId;
        $newId = (int) Db::table('marketing_longstay_tier')->insertGetId($data);
        return Result::success(['id' => $newId], '已保存');
    }

    private function parseSchedule(string $field, ?string $fallback): ?string
    {
        $value = $this->input($field, $fallback);
        if ($value === null || $value === '') return null;
        $parsed = is_string($value) ? \DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, new \DateTimeZone('UTC')) : false;
        if (! $parsed || $parsed->format('Y-m-d H:i:s') !== $value) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '时间须使用 UTC，格式 YYYY-MM-DD HH:mm:ss');
        }
        return $value;
    }

    /** 删除梯度(软删) */
    #[Permission('marketing:longstay:delete')]
    public function delete(): array
    {
        $id = $this->requireId();
        $row = Db::table('marketing_longstay_tier')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '梯度不存在');
        }
        $this->assertSiteScope((int) ((array) $row)['site_id']);
        Db::table('marketing_longstay_tier')->where('id', $id)->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }
}
