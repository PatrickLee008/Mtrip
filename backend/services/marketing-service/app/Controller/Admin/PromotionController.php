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
 * 促销独立实体:代金券 / 促销码 / 新客奖励(Super Admin Portal 模块 05)
 * 路由前缀 /api/v1/admin/marketing/*(网关 map:marketing → marketing_service)
 */
class PromotionController extends AbstractController
{
    // ── 代金券 ─────────────────────────────────────────────────

    #[Permission('marketing:voucher:list')]
    public function vouchers(): array
    {
        return $this->listTable('marketing_voucher');
    }

    #[Permission('marketing:voucher:save')]
    public function voucherSave(): array
    {
        $data = [
            'name' => $this->requireStr('name'),
            'campaign_id' => $this->intInput('campaignId'),
            'voucher_type' => $this->strInput('voucherType', 'fixed'),
            'value' => $this->floatInput('value'),
            'value_display' => mb_substr($this->strInput('valueDisplay'), 0, 50),
            'status' => $this->intInput('status', 1),
            'start_date' => $this->strInput('startDate') ?: null,
            'end_date' => $this->strInput('endDate') ?: null,
            'quantity' => $this->intInput('quantity'),
            'min_spend' => $this->intInput('minSpend'),
            'per_user_limit' => $this->intInput('perUserLimit'),
            'total_redemption_limit' => $this->intInput('totalRedemptionLimit'),
            'merchant_scope' => $this->strInput('merchantScope', 'all'),
            'merchant_count' => $this->intInput('merchantCount'),
        ];
        return $this->saveTable('marketing_voucher', $data);
    }

    #[Permission('marketing:voucher:save')]
    public function voucherDelete(): array
    {
        return $this->softDelete('marketing_voucher');
    }

    // ── 促销码 ─────────────────────────────────────────────────

    #[Permission('marketing:promocode:list')]
    public function codes(): array
    {
        return $this->listTable('marketing_promo_code');
    }

    #[Permission('marketing:promocode:save')]
    public function codeSave(): array
    {
        $data = [
            'name' => $this->strInput('name'),
            'campaign_id' => $this->intInput('campaignId'),
            'discount_type' => $this->strInput('discountType', 'percentage'),
            'discount_value' => $this->floatInput('discountValue'),
            'discount_display' => mb_substr($this->strInput('discountDisplay'), 0, 50),
            'status' => $this->intInput('status', 1),
            'start_date' => $this->strInput('startDate') ?: null,
            'end_date' => $this->strInput('endDate') ?: null,
            'usage_limit' => $this->intInput('usageLimit'),
            'per_user_limit' => $this->intInput('perUserLimit'),
            'min_spend' => $this->intInput('minSpend'),
            'stackable' => $this->intInput('stackable') === 1 ? 1 : 0,
            'merchant_scope' => $this->strInput('merchantScope', 'all'),
            'merchant_count' => $this->intInput('merchantCount'),
        ];
        $id = $this->intInput('id');
        if ($id > 0) {
            Db::table('marketing_promo_code')->where('id', $id)->whereNull('deleted_at')->update($data);
            return Result::success(['id' => $id], '已保存');
        }
        $code = strtoupper($this->requireStr('code'));
        if (Db::table('marketing_promo_code')->where('code', $code)->whereNull('deleted_at')->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该促销码已存在');
        }
        $data['code'] = $code;
        $data['site_id'] = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
        $data['created_by'] = AdminContext::adminName() ?: 'Admin';
        $id = (int) Db::table('marketing_promo_code')->insertGetId($data);
        return Result::success(['id' => $id], '已保存');
    }

    #[Permission('marketing:promocode:save')]
    public function codeDelete(): array
    {
        return $this->softDelete('marketing_promo_code');
    }

    // ── 新客奖励 ───────────────────────────────────────────────

    #[Permission('marketing:welcome:list')]
    public function welcomes(): array
    {
        return $this->listTable('marketing_welcome_reward');
    }

    #[Permission('marketing:welcome:save')]
    public function welcomeSave(): array
    {
        $data = [
            'name' => $this->requireStr('name'),
            'reward_type' => $this->strInput('rewardType', 'new_user'),
            'discount_type' => $this->strInput('discountType', 'fixed'),
            'discount_value' => $this->floatInput('discountValue'),
            'discount_display' => mb_substr($this->strInput('discountDisplay'), 0, 50),
            'status' => $this->intInput('status', 1),
            'validity_days' => $this->intInput('validityDays', 30),
            'usage_limit' => $this->intInput('usageLimit'),
            'min_spend' => $this->intInput('minSpend'),
        ];
        return $this->saveTable('marketing_welcome_reward', $data);
    }

    #[Permission('marketing:welcome:save')]
    public function welcomeDelete(): array
    {
        return $this->softDelete('marketing_welcome_reward');
    }

    // ── 通用助手 ───────────────────────────────────────────────

    private function listTable(string $table): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table($table)->whereNull('deleted_at');
        $this->applySiteScope($query);
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        if (($kw = $this->strInput('keyword')) !== '') {
            $query->where('name', 'like', "%{$kw}%");
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    private function saveTable(string $table, array $data): array
    {
        $id = $this->intInput('id');
        if ($id > 0) {
            Db::table($table)->where('id', $id)->whereNull('deleted_at')->update($data);
        } else {
            $data['site_id'] = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
            $data['created_by'] = AdminContext::adminName() ?: 'Admin';
            $id = (int) Db::table($table)->insertGetId($data);
        }
        return Result::success(['id' => $id], '已保存');
    }

    private function softDelete(string $table): array
    {
        Db::table($table)->where('id', $this->requireId())->whereNull('deleted_at')
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }
}
