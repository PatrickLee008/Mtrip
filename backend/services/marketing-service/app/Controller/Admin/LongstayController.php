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

        $maxNights = $this->intInput('maxNights', (int) ($row->max_nights ?? LongStayOffer::ORDINARY_NIGHTS));
        if ($minNights < 1 || $maxNights < $minNights) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '最高晚数不得低于最低晚数');
        }
        $propertyId = $this->intInput('propertyId', (int) ($row->property_id ?? 0));
        if ($propertyId < 1 || (! Db::table('merchant_store')->where('site_id', $siteId)
            ->where('id', $propertyId)->where('business_type', 'hotel')->whereNull('deleted_at')->exists())) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '请选择该站点内的酒店');
        }
        $startsAt = $this->parseSchedule('startsAt', $row->starts_at ?? null);
        $endsAt = $this->parseSchedule('endsAt', $row->ends_at ?? null);
        if ($startsAt !== null && $endsAt !== null && $startsAt >= $endsAt) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '结束时间须晚于开始时间');
        }
        $source = $this->strInput('offerSource', (string) ($row->offer_source ?? 'platform'));
        $platformShare = $this->floatInput('platformFundingPct', (float) ($row->platform_funding_pct ?? 0));
        if (! in_array($source, ['platform', 'merchant'], true) || $platformShare < 0 || $platformShare > 100) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'Invalid Long Stay source or funding share');
        }
        $data += ['property_id' => $propertyId, 'starts_at' => $startsAt, 'ends_at' => $endsAt,
            'priority' => $this->intInput('priority', (int) ($row->priority ?? 0)),
            'coupon_stackable' => 1, 'max_nights' => $maxNights, 'offer_source' => $source, 'platform_funding_pct' => round($platformShare, 2)];
        return Db::transaction(function () use ($data, $siteId, $propertyId, $id, $endsAt, $startsAt, $source, $minNights, $maxNights, $status) {
            Db::table('merchant_store')->where('id', $propertyId)->lockForUpdate()->first();
            if ($source === 'merchant' && ! Db::table('marketing_longstay_proposal')->where('tier_id', $id)
                ->where('property_id', $propertyId)->where('site_id', $siteId)->where('state', 'approved')->exists()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Approve the hotel proposal before configuring its merchant rate');
            }
            if ($status === 1) {
                $conflict = LongStayOffer::conflictingTier($siteId, $propertyId, $source, $minNights, $maxNights, $startsAt, $endsAt, $id);
                if ($conflict) throw new BusinessException(ErrorCode::DATA_CONFLICT, "Conflicting Long Stay tier #{$conflict}");
            }

            if ($id > 0) {
                $changed = Db::table('marketing_longstay_tier')->where('id', $id)->whereNull('deleted_at')->update($data);
                if ($changed && $source === 'merchant') {
                    $proposal = Db::table('marketing_longstay_proposal')->where('tier_id', $id)->first();
                    $now = gmdate('Y-m-d H:i:s');
                    $state = $status === 1 ? 'Enabled' : 'Disabled';
                    $funding = $data['platform_funding_pct'];
                    $terms = "{$state}. {$minNights}–{$maxNights} nights, {$data['discount_rate']}% discount. "
                        . "Platform funding {$funding}%. UTC schedule: " . ($startsAt ?? 'open') . ' / ' . ($endsAt ?? 'open');
                    Db::table('merchant_notify')->insert(['site_id' => $siteId, 'merchant_id' => $proposal->merchant_id, 'property_id' => $propertyId,
                        'category' => 'promotion', 'title' => "Long Stay proposal #{$proposal->id}", 'message' => $terms,
                        'operator_id' => AdminContext::adminId(), 'channels' => 'inapp', 'send_at' => $now, 'delivered_at' => $now,
                        'request_id' => 'longstay-terms-' . $id . '-' . bin2hex(random_bytes(8))]);
                }
                return Result::success(['id' => $id], '已保存');
            }
            $data['site_id'] = $siteId;
            $newId = (int) Db::table('marketing_longstay_tier')->insertGetId($data);
            return Result::success(['id' => $newId], '已保存');
        });
    }

    #[Permission('marketing:longstay:save')]
    public function proposals(): array
    {
        [$page, $size] = $this->pageParams();
        $query = Db::table('marketing_longstay_proposal');
        $this->applySiteScope($query);
        $total = (clone $query)->count();
        return Result::page($query->orderByDesc('id')->forPage($page, $size)->get()->all(), $total, $page, $size);
    }

    #[Permission('marketing:longstay:save')]
    public function review(): array
    {
        $id = $this->requireId();
        $action = $this->requireStr('action');
        $reason = $this->strInput('reason');
        if (! in_array($action, ['reviewing', 'approved', 'returned', 'rejected'], true)
            || mb_strlen($reason) > 500 || (in_array($action, ['returned', 'rejected'], true) && $reason === '')) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, 'Provide a valid decision and reason');
        }
        return Db::transaction(function () use ($id, $action, $reason) {
            $request = Db::table('marketing_longstay_proposal')->where('id', $id)->lockForUpdate()->first();
            if (! $request) throw new BusinessException(ErrorCode::NOT_FOUND);
            $this->assertSiteScope((int) $request->site_id);
            if (($action === 'reviewing' && $request->state !== 'submitted')
                || ($action !== 'reviewing' && $request->state !== 'reviewing')) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, 'Reload the proposal before reviewing');
            }
            $now = gmdate('Y-m-d H:i:s');
            $change = ['state' => $action, 'reason' => $reason, 'reviewed_by' => AdminContext::adminId(), 'reviewed_at' => $now];
            if ($action === 'approved') {
                $property = Db::table('merchant_store')->where('id', $request->property_id)->where('site_id', $request->site_id)
                    ->whereNull('deleted_at')->lockForUpdate()->first();
                if (! $property) throw new BusinessException(ErrorCode::NOT_FOUND);
                $conflict = LongStayOffer::conflictingTier((int) $request->site_id, (int) $request->property_id,
                    'merchant', (int) $request->min_nights, (int) $request->max_nights, $request->starts_at, $request->ends_at);
                if ($conflict) throw new BusinessException(ErrorCode::DATA_CONFLICT, "Conflicting Long Stay tier #{$conflict}");
                $change['tier_id'] = Db::table('marketing_longstay_tier')->insertGetId([
                    'site_id' => $request->site_id, 'property_id' => $request->property_id, 'offer_source' => 'merchant',
                    'min_nights' => $request->min_nights, 'max_nights' => $request->max_nights, 'discount_rate' => $request->discount_rate,
                    'starts_at' => $request->starts_at, 'ends_at' => $request->ends_at, 'coupon_stackable' => 1, 'status' => 2,
                ]);
            }
            Db::table('marketing_longstay_proposal')->where('id', $id)->update($change);
            Db::table('merchant_notify')->insert(['site_id' => $request->site_id, 'merchant_id' => $request->merchant_id,
                'property_id' => $request->property_id, 'category' => 'promotion', 'title' => "Long Stay proposal #{$id}",
                'message' => trim($action . ' ' . $reason), 'operator_id' => AdminContext::adminId(), 'channels' => 'inapp',
                'send_at' => $now, 'delivered_at' => $now, 'request_id' => "longstay-{$id}-{$action}"]);
            return Result::success($change);
        });
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
