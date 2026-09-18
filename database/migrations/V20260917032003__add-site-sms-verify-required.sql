-- 站点级「注册强制短信验证」开关
--
-- 背景:注册此前用的是「渠道启用即强制」(AuthController::register 读 SmsVerifyService::enabled),
-- 短信渠道一旦被停用 / 软删 / 凭证失效,enabled() 变 false,注册就**静默降级成免验证码注册**。
-- 开发期方便,生产上等于「短信一挂注册门就开」,且无任何告警。本列把「是否要求验证」与
-- 「渠道是否可用」解耦。
--
-- 取值:1=强制(渠道不可用时直接拒绝注册) 0=跟随渠道(旧行为)
-- DEFAULT 1:存量站点与新建站点一律强制(按用户决定),要放开的站点在后台逐个翻成 0。

SET NAMES utf8mb4;
USE mtrip_system;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_site' AND COLUMN_NAME='sms_verify_required')=0,
  'ALTER TABLE sys_site ADD COLUMN sms_verify_required TINYINT NOT NULL DEFAULT 1 COMMENT ''注册是否强制短信验证:1=强制 0=跟随渠道''',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
