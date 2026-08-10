<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Support\Result;

/**
 * 推荐返利记录(Super Admin Portal Phase 2 · Referral)
 * C 端用户推荐绑定与奖励(user_referral),与 B2B Affiliate 独立。
 * 路由前缀 /api/v1/admin/user/referral-list(user 模块 → user_service)
 */
class AdminReferralController extends AbstractAdminController
{
    #[Permission('affiliate:referral:list')]
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_referral');
        $this->applySiteScope($query);
        $status = $this->input('rewardStatus');
        if ($status !== null && $status !== '') {
            $query->where('reward_status', (int) $status);
        }
        if (($inviter = $this->intInput('inviterUserId')) > 0) {
            $query->where('inviter_user_id', $inviter);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(static fn ($r) => (array) $r)->all();
        return Result::page($list, $total, $page, $pageSize);
    }
}
