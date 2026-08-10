<?php

declare(strict_types=1);

namespace App\Controller;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\Result;

/**
 * 带货达人与联盟(Super Admin Portal Phase 2)
 * 设计源:docs/redesign/super-admin-portal/modules/06-affiliate-influencer.md
 * 路由前缀 /api/v1/admin/affiliate/*(网关 map:affiliate → marketing_service)
 * 注:Affiliate(B2B 达人)≠ Referral(C 端返利,复用 user_referral / ReferralController)
 */
class AffiliateController extends AbstractController
{
    // ── 1. 达人申请 ────────────────────────────────────────────

    #[Permission('affiliate:application:list')]
    public function applications(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('affiliate_application');
        $this->applySiteScope($query);
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        if (($type = $this->strInput('type')) !== '') {
            $query->where('type', $type);
        }
        if (($kw = $this->strInput('keyword')) !== '') {
            $query->where(function ($q) use ($kw) {
                $q->where('name', 'like', "%{$kw}%")->orWhere('handle', 'like', "%{$kw}%");
            });
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static function ($r) {
                $r = (array) $r;
                unset($r['contact_phone']); // 加密字段不直出
                return $r;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 通过申请:生成达人记录并回填 partner_id */
    #[Permission('affiliate:application:approve')]
    public function applicationApprove(): array
    {
        $app = $this->findApplication($this->requireId());
        if ((int) $app['status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审申请可通过');
        }
        $rate = $this->floatInput('commissionRate', 5);
        $partnerId = (int) Db::transaction(function () use ($app, $rate) {
            $pid = (int) Db::table('affiliate_partner')->insertGetId([
                'site_id' => (int) $app['site_id'],
                'name' => $app['name'],
                'handle' => $app['handle'],
                'type' => $app['type'],
                'platform' => $app['platform'],
                'followers' => (int) $app['followers'],
                'status' => 1,
                'commission_rate' => $rate,
                'join_date' => date('Y-m-d'),
                'last_activity' => date('Y-m-d H:i:s'),
            ]);
            Db::table('affiliate_application')->where('id', $app['id'])->update([
                'status' => 2,
                'reviewer_id' => AdminContext::adminId(),
                'reviewer_name' => AdminContext::adminName(),
                'partner_id' => $pid,
            ]);
            return $pid;
        });
        return Result::success(['partnerId' => $partnerId], '申请已通过,达人已创建');
    }

    #[Permission('affiliate:application:reject')]
    public function applicationReject(): array
    {
        $app = $this->findApplication($this->requireId());
        if ((int) $app['status'] !== 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅待审申请可驳回');
        }
        $reason = $this->requireStr('reason');
        Db::table('affiliate_application')->where('id', $app['id'])->update([
            'status' => 3,
            'reviewer_id' => AdminContext::adminId(),
            'reviewer_name' => AdminContext::adminName(),
            'review_note' => mb_substr($reason, 0, 500),
        ]);
        return Result::success(null, '申请已驳回');
    }

    // ── 2. 合作方名录 ──────────────────────────────────────────

    #[Permission('affiliate:partner:list')]
    public function partners(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('affiliate_partner')->whereNull('deleted_at');
        $this->applySiteScope($query);
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        if (($type = $this->strInput('type')) !== '') {
            $query->where('type', $type);
        }
        if (($kw = $this->strInput('keyword')) !== '') {
            $query->where(function ($q) use ($kw) {
                $q->where('name', 'like', "%{$kw}%")->orWhere('handle', 'like', "%{$kw}%");
            });
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 达人启停:1活跃 ⇄ 3暂停 */
    #[Permission('affiliate:partner:list')]
    public function partnerToggle(): array
    {
        $partner = $this->findPartner($this->requireId());
        $status = (int) $partner['status'];
        if (! in_array($status, [1, 3], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '仅活跃/暂停达人可切换');
        }
        $next = $status === 1 ? 3 : 1;
        Db::table('affiliate_partner')->where('id', $partner['id'])->update(['status' => $next]);
        return Result::success(['status' => $next], $next === 1 ? '已恢复' : '已暂停');
    }

    // ── 3. 联盟计划(佣金/奖励/全局参数)────────────────────────

    #[Permission('affiliate:program:list')]
    public function program(): array
    {
        $rows = Db::table('affiliate_program');
        $this->applySiteScope($rows);
        $all = $rows->orderBy('kind')->orderBy('sort')->get()->map(static fn ($r) => (array) $r)->all();
        return Result::success([
            'commissionRules' => array_values(array_filter($all, static fn ($r) => (int) $r['kind'] === 1)),
            'rewardRules' => array_values(array_filter($all, static fn ($r) => (int) $r['kind'] === 2)),
            'settings' => array_values(array_filter($all, static fn ($r) => (int) $r['kind'] === 3)),
        ]);
    }

    /** 新增/编辑计划规则(kind 1佣金 2奖励 3设置;config 为 JSON) */
    #[Permission('affiliate:program:save')]
    public function programSave(): array
    {
        $kind = $this->intInput('kind');
        if (! in_array($kind, [1, 2, 3], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 kind 不正确');
        }
        $config = $this->input('config');
        $data = [
            'kind' => $kind,
            'name' => mb_substr($this->strInput('name'), 0, 100),
            'config' => is_array($config) ? json_encode($config, JSON_UNESCAPED_UNICODE) : '{}',
            'enabled' => $this->intInput('enabled', 1) === 0 ? 0 : 1,
            'sort' => $this->intInput('sort'),
        ];
        $id = $this->intInput('id');
        if ($id > 0) {
            Db::table('affiliate_program')->where('id', $id)->update($data);
        } else {
            $data['site_id'] = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
            $id = (int) Db::table('affiliate_program')->insertGetId($data);
        }
        return Result::success(['id' => $id], '已保存');
    }

    // ── 4. 联盟折扣码 ──────────────────────────────────────────

    #[Permission('affiliate:code:list')]
    public function codes(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('affiliate_code')->whereNull('deleted_at');
        $this->applySiteScope($query);
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        if (($pid = $this->intInput('partnerId')) > 0) {
            $query->where('partner_id', $pid);
        }
        if (($kw = $this->strInput('keyword')) !== '') {
            $query->where(function ($q) use ($kw) {
                $q->where('code', 'like', "%{$kw}%")->orWhere('partner_name', 'like', "%{$kw}%");
            });
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('affiliate:code:save')]
    public function codeSave(): array
    {
        $partner = $this->findPartner($this->requireId('partnerId'));
        $data = [
            'promotion_type' => $this->strInput('promotionType', 'percentage'),
            'discount_value' => $this->floatInput('discountValue'),
            'discount_display' => mb_substr($this->strInput('discountDisplay'), 0, 50),
            'status' => $this->intInput('status', 1),
            'start_date' => $this->strInput('startDate') ?: null,
            'end_date' => $this->strInput('endDate') ?: null,
            'usage_limit' => $this->intInput('usageLimit'),
            'per_user_limit' => $this->intInput('perUserLimit'),
            'min_spend' => $this->intInput('minSpend'),
            'eligible_merchants' => $this->strInput('eligibleMerchants', 'all'),
            'merchant_count' => $this->intInput('merchantCount'),
            'commission_rate' => $this->floatInput('commissionRate', (float) $partner['commission_rate']),
        ];
        $id = $this->intInput('id');
        if ($id > 0) {
            Db::table('affiliate_code')->where('id', $id)->whereNull('deleted_at')->update($data);
        } else {
            $code = strtoupper($this->requireStr('code'));
            if (Db::table('affiliate_code')->where('code', $code)->whereNull('deleted_at')->exists()) {
                throw new BusinessException(ErrorCode::DATA_CONFLICT, '该折扣码已存在');
            }
            $data['site_id'] = (int) $partner['site_id'];
            $data['code'] = $code;
            $data['partner_id'] = (int) $partner['id'];
            $data['partner_name'] = (string) $partner['name'];
            $data['partner_handle'] = (string) $partner['handle'];
            $data['referral_link'] = 'https://mtrip.com/r/' . strtolower($code);
            $data['created_by'] = AdminContext::adminName() ?: 'Admin';
            $id = (int) Db::table('affiliate_code')->insertGetId($data);
        }
        return Result::success(['id' => $id], '已保存');
    }

    #[Permission('affiliate:code:delete')]
    public function codeDelete(): array
    {
        $id = $this->requireId();
        Db::table('affiliate_code')->where('id', $id)->whereNull('deleted_at')
            ->update(['deleted_at' => date('Y-m-d H:i:s')]);
        return Result::success(null, '已删除');
    }

    // ── 5. 奖励钱包(佣金流水 + 提现)──────────────────────────

    #[Permission('affiliate:wallet:list')]
    public function commissionLog(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('affiliate_commission_log');
        $this->applySiteScope($query);
        if (($pid = $this->intInput('partnerId')) > 0) {
            $query->where('partner_id', $pid);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('affiliate:wallet:list')]
    public function withdraws(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('affiliate_withdraw');
        $this->applySiteScope($query);
        if (($pid = $this->intInput('partnerId')) > 0) {
            $query->where('partner_id', $pid);
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static function ($r) {
                $r = (array) $r;
                unset($r['bank_info']); // 加密字段不直出
                return $r;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 提现打款:待审/已批 → 已打款,扣减可提现余额 */
    #[Permission('affiliate:withdraw:pay')]
    public function withdrawPay(): array
    {
        $id = $this->requireId();
        $wd = Db::table('affiliate_withdraw')->where('id', $id)->first();
        if (! $wd) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '提现单不存在');
        }
        $wd = (array) $wd;
        $this->assertSiteScope((int) $wd['site_id']);
        if (! in_array((int) $wd['status'], [1, 2], true)) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '该提现单不可打款');
        }
        Db::transaction(function () use ($wd) {
            Db::table('affiliate_withdraw')->where('id', $wd['id'])->update([
                'status' => 3,
                'operator_id' => AdminContext::adminId(),
                'paid_at' => date('Y-m-d H:i:s'),
            ]);
            Db::table('affiliate_partner')->where('id', $wd['partner_id'])
                ->decrement('withdrawable', (int) $wd['amount']);
        });
        return Result::success(null, '已打款');
    }

    /** 人工调整达人可提现余额(正=入账 负=扣减)+ 记佣金流水 */
    #[Permission('affiliate:wallet:adjust')]
    public function walletAdjust(): array
    {
        $partner = $this->findPartner($this->requireId('partnerId'));
        $amount = $this->intInput('amount');
        if ($amount === 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '调整金额不能为 0');
        }
        Db::transaction(function () use ($partner, $amount) {
            Db::table('affiliate_partner')->where('id', $partner['id'])->increment('withdrawable', $amount);
            Db::table('affiliate_commission_log')->insert([
                'site_id' => (int) $partner['site_id'],
                'partner_id' => (int) $partner['id'],
                'amount' => $amount,
                'status' => 2,
            ]);
        });
        return Result::success(null, '已调整');
    }

    // ── 6. 反欺诈合规 ──────────────────────────────────────────

    #[Permission('affiliate:fraud:list')]
    public function fraudCases(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('affiliate_fraud_flag');
        $this->applySiteScope($query);
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('investigation_status', (int) $status);
        }
        if (($risk = $this->intInput('riskLevel')) > 0) {
            $query->where('risk_level', $risk);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 处置案件:更新调查状态;suspend=1 时联动暂停达人 */
    #[Permission('affiliate:fraud:handle')]
    public function fraudHandle(): array
    {
        $id = $this->requireId();
        $case = Db::table('affiliate_fraud_flag')->where('id', $id)->first();
        if (! $case) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '案件不存在');
        }
        $case = (array) $case;
        $this->assertSiteScope((int) $case['site_id']);
        $status = $this->intInput('investigationStatus');
        if (! in_array($status, [1, 2, 3, 4], true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 investigationStatus 不正确');
        }
        Db::table('affiliate_fraud_flag')->where('id', $id)->update([
            'investigation_status' => $status,
            'reviewer' => AdminContext::adminName() ?: 'Admin',
        ]);
        if ($this->intInput('suspend') === 1 && (int) $case['partner_id'] > 0) {
            Db::table('affiliate_partner')->where('id', $case['partner_id'])->update(['status' => 3]);
        }
        return Result::success(null, '已处置');
    }

    // ── 私有助手 ───────────────────────────────────────────────

    private function findApplication(int $id): array
    {
        $row = Db::table('affiliate_application')->where('id', $id)->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '申请不存在');
        }
        $row = (array) $row;
        $this->assertSiteScope((int) $row['site_id']);
        return $row;
    }

    private function findPartner(int $id): array
    {
        $row = Db::table('affiliate_partner')->where('id', $id)->whereNull('deleted_at')->first();
        if (! $row) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '达人不存在');
        }
        $row = (array) $row;
        $this->assertSiteScope((int) $row['site_id']);
        return $row;
    }
}
