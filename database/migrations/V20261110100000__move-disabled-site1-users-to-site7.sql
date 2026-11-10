SET NAMES utf8mb4;
USE mtrip_business;

-- 生产 App 默认站点曾是 1(该站点已停用),2026-11 改为 7(仰光)后,站点 1 的 C 端账号在 7 下查不到、
-- 登录提示「手机号或密码错误」。把这些账号迁到站点 7(登录侧另有跨已启用站点回退,两者互为兜底)。
--
-- 只迁「跟人走」的数据:账号本身与其个人流水 / 记录。订单、退款、资金流水、领券、评价、收藏、会话、
-- 促销码核销的 site_id 表示酒店 / 券所属站点,保持不变(App 按 user_id 查自己的订单与券,不受影响)。
-- 同一手机号在站点 7 已有账号(被锁在外后重新注册)的,迁过去会撞唯一键 uk_site_mobile_hash,原地保留;
-- 登录时优先命中站点 7 的账号。
-- 前置条件:站点 7 已启用且站点 1 已停用,否则整段不执行。幂等:重跑只会再处理仍留在站点 1 的账号。

SET @move_ok := (SELECT COUNT(*) FROM mtrip_system.sys_site WHERE id = 7 AND status = 1 AND deleted_at IS NULL)
              * (SELECT COUNT(*) FROM mtrip_system.sys_site WHERE id = 1 AND status = 2);

DROP TEMPORARY TABLE IF EXISTS tmp_site1_move;
CREATE TEMPORARY TABLE tmp_site1_move (id BIGINT UNSIGNED NOT NULL PRIMARY KEY);
INSERT INTO tmp_site1_move (id)
SELECT u.id
FROM user_info u
WHERE @move_ok = 1
  AND u.site_id = 1
  AND NOT EXISTS (
      SELECT 1 FROM user_info s7
      WHERE s7.site_id = 7 AND s7.mobile_hash = u.mobile_hash
  );

UPDATE user_info SET site_id = 7 WHERE site_id = 1 AND id IN (SELECT id FROM tmp_site1_move);

UPDATE user_balance_log     SET site_id = 7 WHERE site_id = 1 AND user_id IN (SELECT id FROM tmp_site1_move);
UPDATE user_points_log      SET site_id = 7 WHERE site_id = 1 AND user_id IN (SELECT id FROM tmp_site1_move);
UPDATE user_action_log      SET site_id = 7 WHERE site_id = 1 AND user_id IN (SELECT id FROM tmp_site1_move);
UPDATE user_traveler        SET site_id = 7 WHERE site_id = 1 AND user_id IN (SELECT id FROM tmp_site1_move);
UPDATE user_feedback        SET site_id = 7 WHERE site_id = 1 AND user_id IN (SELECT id FROM tmp_site1_move);
UPDATE user_appeal          SET site_id = 7 WHERE site_id = 1 AND user_id IN (SELECT id FROM tmp_site1_move);
UPDATE user_fraud           SET site_id = 7 WHERE site_id = 1 AND user_id IN (SELECT id FROM tmp_site1_move);
UPDATE user_blacklist       SET site_id = 7 WHERE site_id = 1 AND user_id IN (SELECT id FROM tmp_site1_move);
UPDATE user_social_identity SET site_id = 7 WHERE site_id = 1 AND user_id IN (SELECT id FROM tmp_site1_move);
UPDATE notify_record        SET site_id = 7 WHERE site_id = 1 AND user_id IN (SELECT id FROM tmp_site1_move);
UPDATE user_referral        SET site_id = 7 WHERE site_id = 1 AND invitee_user_id IN (SELECT id FROM tmp_site1_move);

DROP TEMPORARY TABLE IF EXISTS tmp_site1_move;
