-- 推荐返利奖励金额(PRD 模块14:Refer & Earn)
--
-- 背景:order-service `ReferralService::grantOnFirstBooking` 读 sys_site_config 的
-- `referral_reward_inviter` / `referral_reward_invitee` 决定发多少,读不到按 0 处理。
-- 这两个键此前**全库没有任何一行**(没有种子、没有后台配置入口),于是被推荐人首单达成时
-- 钱包一分钱不进,但 user_referral 仍被置成 reward_status=1 —— 推荐关系被静默消耗掉。
-- 本迁移补上默认值,让奖励真正发得出去。
--
-- 金额口径:`reward()` 取的是**绝对金额**(不是比例),单位即站点自身币种。
-- 因此**只给 MMK 站点(5/6/7)写 50000**,与 App 文案「Earn 50,000 MMK」一致;
-- EUR 站点(1/2/3/4)故意不写 —— 50000 落到 EUR 站点就是每单 5 万欧元。
-- EUR 站点要开推荐返利,需按欧元口径单独配一行(后台配置入口尚未实现,现阶段手工 INSERT)。
--
-- 幂等:uk_site_key(site_id, config_key) + INSERT IGNORE,重复执行不产生第二行。

SET NAMES utf8mb4;
USE mtrip_system;

INSERT IGNORE INTO sys_site_config (site_id, config_group, config_key, config_value, config_name)
SELECT s.id, 'operate', 'referral_reward_inviter', '50000', '推荐返利-邀请人奖励(绝对金额)'
FROM sys_site s WHERE s.currency = 'MMK';

INSERT IGNORE INTO sys_site_config (site_id, config_group, config_key, config_value, config_name)
SELECT s.id, 'operate', 'referral_reward_invitee', '50000', '推荐返利-新人奖励(绝对金额)'
FROM sys_site s WHERE s.currency = 'MMK';
