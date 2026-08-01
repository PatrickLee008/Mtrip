<?php

declare(strict_types=1);

namespace App\Controller;

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

    /** 我的推荐:推荐码(为空则惰性生成)+ 邀请人数 + 累计已发奖励 */
    public function my(): array
    {
        $userId = UserContext::userId();
        $user = (array) Db::table('user_info')->where('id', $userId)->first(['referral_code']);
        $code = (string) ($user['referral_code'] ?? '');
        if ($code === '') {
            $code = $this->authService->genReferralCode($userId);
            Db::table('user_info')->where('id', $userId)->update(['referral_code' => $code]);
        }
        $inviteeCount = Db::table('user_referral')->where('inviter_user_id', $userId)->count();
        $rewardTotal = (float) Db::table('user_referral')
            ->where('inviter_user_id', $userId)->where('reward_status', 1)->sum('reward_amount');
        return Result::success([
            'referralCode' => $code,
            'inviteeCount' => $inviteeCount,
            'rewardTotal' => $rewardTotal,
        ]);
    }

    /** 我邀请的人:昵称/头像 + 奖励状态 */
    public function invitees(): array
    {
        $userId = UserContext::userId();
        [$page, $pageSize] = $this->pageParams();
        $query = Db::table('user_referral as ur')
            ->leftJoin('user_info as u', 'u.id', '=', 'ur.invitee_user_id')
            ->where('ur.inviter_user_id', $userId);
        $total = (clone $query)->count();
        $list = $query->orderByDesc('ur.id')->forPage($page, $pageSize)
            ->get(['ur.id', 'ur.reward_status', 'ur.reward_amount', 'ur.bind_time', 'ur.reward_time',
                'u.nickname', 'u.avatar'])
            ->map(static function ($row) {
                $row = (array) $row;
                $row['nickname'] = $row['nickname'] ?: '新用户';
                return $row;
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }
}
