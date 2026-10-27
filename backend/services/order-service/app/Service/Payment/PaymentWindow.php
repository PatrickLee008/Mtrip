<?php

declare(strict_types=1);

namespace App\Service\Payment;

use Hyperf\DbConnection\Db;
use Mtrip\Shared\Payment\SettleRules;

/**
 * 订单支付窗口(方案 22 §6.1):sys_site_config(本站点,key payment_window_minutes)→ sys_config → 30 分钟
 *
 * - 空串 / 非正整数视为未覆盖;超过 1440 按 1440(SettleRules::windowMinutes);
 * - 站点配置只认本站点一行,**刻意不沿站点树(城市 → 国家 → 全球)继承**:2026-10-27 核实,仓库内所有
 *   sys_site_config 读取(system-service SiteController::configs / AppSiteController、order-service
 *   platform_fee_rate / commission_rate / referral / fraud 阈值)都只按 site_id 精确匹配,没有继承约定;
 *   后台「差异化配置」也按单站点维护。上级站点需要统一值时配全局 sys_config 即可。
 *   (站点树回溯只用于支付渠道绑定 PaymentRules::siteCandidates,那是收款路由,不是配置项。)
 * - 读库失败按默认值,不阻断下单。
 */
class PaymentWindow
{
    public const CONFIG_KEY = 'payment_window_minutes';

    public function minutes(int $siteId): int
    {
        try {
            $site = $siteId > 0
                ? Db::connection('system')->table('sys_site_config')
                    ->where('site_id', $siteId)->where('config_key', self::CONFIG_KEY)
                    ->whereNull('deleted_at')->value('config_value')
                : null;
            $global = SettleRules::parseWindowMinutes($site) === null
                ? Db::connection('system')->table('sys_config')
                    ->where('config_key', self::CONFIG_KEY)->whereNull('deleted_at')->value('config_value')
                : null;
        } catch (\Throwable) {
            return SettleRules::DEFAULT_WINDOW_MINUTES;
        }
        return SettleRules::windowMinutes($site, $global);
    }
}
