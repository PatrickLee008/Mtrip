-- 「注册强制短信验证」开关:站点级 → 全局安全配置
--
-- 上一版(V20260917032003)把开关做成了站点级 `sys_site.sms_verify_required`,有两个问题:
--   1. 注册时的站点来自**客户端可控的 `X-Site-Id`**(`requireSiteId()` 只校验 >0,不校验站点存在/启用),
--      只要有任一站点被设成「跟随渠道」,带上那个站点 id 就能免验证码注册 —— 站点级挡不住「挑弱站点」。
--   2. 这本质是平台级安全策略,不是站点差异化配置。
-- 故改存 `sys_config` 的 security 分组,后台走「平台配置 → 全局配置 → 安全配置」。
--
-- value_type=3 表示开关,后台全局配置页据此自动渲染成 a-switch(前端无需为它加控件)。
-- default_value='1' 供该页的「一键恢复默认」使用;remark 会显示在控件下方作为说明。

SET NAMES utf8mb4;
USE mtrip_system;

INSERT INTO sys_config (config_group, config_key, config_value, value_type, config_name, default_value, remark)
SELECT 'security', 'register_sms_required', '1', 3, '注册强制短信验证', '1',
       '开启后 App 注册必须通过短信验证码;短信渠道不可用时直接拒绝注册。关闭则跟随渠道状态——渠道停用即免验证码注册,请谨慎。'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sys_config c WHERE c.config_key = 'register_sms_required');

-- 退役上一版的站点级列(昨天刚加,除默认值 1 外没有任何业务数据)
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_site' AND COLUMN_NAME='sms_verify_required')>0,
  'ALTER TABLE sys_site DROP COLUMN sms_verify_required', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
