<?php

declare(strict_types=1);

namespace App\Controller\App;

use App\Controller\AbstractController;

use App\Service\UserAuthService;
use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Context\UserContext;
use Mtrip\Shared\Support\Result;

/**
 * C端推荐返利(Refer & Earn):我的推荐码/战绩 + 邀请列表
 * PRD 模块 14:推荐码分享;被推荐人首单达成后奖励入推荐人钱包(发放在 order-service 支付成功时)
 */
class ReferralController extends AbstractController
{
    #[Inject]
    protected UserAuthService $authService;

    /** 我的推荐:推荐码(为空则惰性生成)+ 邀请人数 + 待结算/已奖励拆分 + 累计已发奖励 */
    public function my(): array
    {
        $userId = UserContext::userId();
        $user = (array) Db::table('user_info')->where('id', $userId)->first(['referral_code']);
        $code = (string) ($user['referral_code'] ?? '');
        if ($code === '') {
            $code = $this->authService->genReferralCode($userId);
            Db::table('user_info')->where('id', $userId)->update(['referral_code' => $code]);
        }
        // 统计卡要「已邀请/待结算/已奖励」三格 + 累计金额,一次聚合查完(无记录时 SUM 为 NULL,强转兜 0)
        $stat = (array) Db::table('user_referral')
            ->where('inviter_user_id', $userId)
            ->selectRaw('COUNT(*) AS invitee_count')
            ->selectRaw('SUM(reward_status = 0) AS pending_count')
            ->selectRaw('SUM(reward_status = 1) AS rewarded_count')
            ->selectRaw('SUM(CASE WHEN reward_status = 1 THEN reward_amount ELSE 0 END) AS reward_total')
            ->first();
        return Result::success([
            'referralCode' => $code,
            'inviteeCount' => (int) ($stat['invitee_count'] ?? 0),
            'pendingCount' => (int) ($stat['pending_count'] ?? 0),
            'rewardedCount' => (int) ($stat['rewarded_count'] ?? 0),
            'rewardTotal' => (float) ($stat['reward_total'] ?? 0),
        ]);
    }

    /**
     * 我邀请的人:昵称/头像 + 奖励状态
     *
     * `status` 选填(0待达成 1已发放 2已失效),对应 App 推荐明细页的 Pending / Rewarded 两个页签;
     * 不传则返回全部。注意 status=0 是合法值,只能判 null/'' 不能判 falsy。
     */
    public function invitees(): array
    {
        $userId = UserContext::userId();
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_referral as ur')
            ->leftJoin('user_info as u', 'u.id', '=', 'ur.invitee_user_id')
            ->where('ur.inviter_user_id', $userId);
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('ur.reward_status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('ur.id')->forPage($page, $pageSize)
            ->get(['ur.id', 'ur.reward_status', 'ur.reward_amount', 'ur.reward_order_id',
                'ur.bind_time', 'ur.reward_time', 'u.nickname', 'u.avatar'])
            ->map(static function ($row) {
                $row = (array) $row;
                $row['nickname'] = $row['nickname'] ?: '新用户';
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }
}
