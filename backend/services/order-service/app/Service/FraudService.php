<?php

declare(strict_types=1);

namespace App\Service;

use Hyperf\DbConnection\Db;

/**
 * 风控评估:基于取消/退款行为的可配置阈值(PRD 模块10.1)。
 * 阈值取 sys_site_config,未配置(=0)则不启用——默认安全(不自动冻结)。
 */
class FraudService
{
    /**
     * 取消行为评估:统计近 N 天退款申请数,超阈值则升风控级别=2(限制)并冻结账号(user_status=2)。
     * 调用方应以 try 包裹,评估失败不影响主流程。
     */
    public function evaluateCancellation(int $siteId, int $userId): void
    {
        $threshold = (int) $this->config($siteId, 'fraud_cancel_threshold');
        if ($threshold <= 0) {
            return;
        }
        $windowDays = max(1, (int) $this->config($siteId, 'fraud_cancel_window_days'));
        $since = date('Y-m-d H:i:s', time() - $windowDays * 86400);
        $cancelCount = Db::table('order_refund')
            ->where('user_id', $userId)
            ->where('created_at', '>=', $since)
            ->whereNull('deleted_at')
            ->count();
        if ($cancelCount < $threshold) {
            return;
        }
        $reason = "近{$windowDays}天取消/退款 {$cancelCount} 次达风控阈值";
        $now = date('Y-m-d H:i:s');
        $exists = Db::table('user_fraud')->where('user_id', $userId)->exists();
        if ($exists) {
            Db::table('user_fraud')->where('user_id', $userId)->update([
                'fraud_score' => $cancelCount,
                'level' => 2,
                'last_reason' => $reason,
                'last_eval_at' => $now,
            ]);
        } else {
            Db::table('user_fraud')->insert([
                'site_id' => $siteId,
                'user_id' => $userId,
                'fraud_score' => $cancelCount,
                'level' => 2,
                'last_reason' => $reason,
                'last_eval_at' => $now,
            ]);
        }
        // 冻结账号:登录侧已按 user_status=2 拦截并提示联系客服/申诉
        Db::table('user_info')->where('id', $userId)->update(['user_status' => 2]);
    }

    /** 读站点风控配置(整数),未配=0 */
    private function config(int $siteId, string $key): float
    {
        $value = Db::connection('system')->table('sys_site_config')
            ->where('site_id', $siteId)
            ->where('config_key', $key)
            ->whereNull('deleted_at')
            ->value('config_value');
        return $value !== null ? (float) $value : 0.0;
    }
}
