<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;
use Hyperf\Di\Annotation\Inject;

/**
 * 推荐返利发放(PRD 模块14):被推荐人首个已支付酒店订单达成时,给推荐人+新人钱包入账。
 * 单酒店(OrderController)与多酒店 Trip(TripController)共用;reward_status=0→1 保证仅首单发放。
 */
class ReferralService
{
    #[Inject]
    protected WalletService $walletService;

    /** 首单达成发放(须在支付事务内调用) */
    public function grantOnFirstBooking(int $siteId, int $inviteeUserId, int $orderId): void
    {
        $ref = Db::table('user_referral')
            ->where('invitee_user_id', $inviteeUserId)
            ->where('reward_status', 0)
            ->lockForUpdate()
            ->first();
        if (! $ref) {
            return;
        }
        $ref = (array) $ref;
        $inviterReward = $this->reward($siteId, 'referral_reward_inviter');
        $inviteeReward = $this->reward($siteId, 'referral_reward_invitee');
        if ($inviterReward > 0) {
            $this->walletService->credit($siteId, (int) $ref['inviter_user_id'], $inviterReward, 4, $orderId, 0, '推荐返利-邀请奖励');
        }
        if ($inviteeReward > 0) {
            $this->walletService->credit($siteId, $inviteeUserId, $inviteeReward, 4, $orderId, 0, '推荐返利-新人奖励');
        }
        Db::table('user_referral')->where('id', $ref['id'])->update([
            'reward_status' => 1,
            'reward_amount' => $inviterReward,
            'reward_order_id' => $orderId,
            'reward_time' => date('Y-m-d H:i:s'),
        ]);
    }

    /** 推荐奖励额:sys_site_config[key](绝对金额 MMK),未配=0 */
    private function reward(int $siteId, string $key): float
    {
        $value = Db::connection('system')->table('sys_site_config')
            ->where('site_id', $siteId)
            ->where('config_key', $key)
            ->whereNull('deleted_at')
            ->value('config_value');
        return $value !== null ? max(0.0, (float) $value) : 0.0;
    }
}
