SET NAMES utf8mb4;

-- Consumer App PRD 模块 19.2「关联邮箱」:同一邮箱不得关联到多个 mTrip 账号。
--
--   user_info.email_hash   规范化(去空白、小写)后的邮箱 HMAC-SHA256(密钥同 mobile_hash = MTRIP_AES_KEY);
--                          只有经邮箱验证码验证过的邮箱才写入,NULL = 未关联 / 历史未验证邮箱(Apple 登录带回的邮箱)。
--   uk_site_email_hash     (site_id, email_hash) 唯一,兜底并发;跨站点查重由 user-service 按已启用站点做(与手机号同口径)。
-- 账户注销时 email_hash 置空并归档到 user_account_deletion,同一邮箱可重新注册 / 关联新账号。
-- 幂等:information_schema 守卫。

USE `mtrip_business`;

SET @user_email_hash_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_info' AND COLUMN_NAME = 'email_hash'),
  'SELECT 1',
  'ALTER TABLE user_info ADD COLUMN email_hash CHAR(64) NULL DEFAULT NULL COMMENT ''已验证邮箱 HMAC(小写规范化);NULL=未关联'' AFTER email'
);
PREPARE user_email_hash_stmt FROM @user_email_hash_ddl;
EXECUTE user_email_hash_stmt;
DEALLOCATE PREPARE user_email_hash_stmt;

SET @user_email_hash_idx = IF(
  EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_info' AND INDEX_NAME = 'uk_site_email_hash'),
  'SELECT 1',
  'ALTER TABLE user_info ADD UNIQUE KEY uk_site_email_hash (site_id, email_hash)'
);
PREPARE user_email_hash_idx_stmt FROM @user_email_hash_idx;
EXECUTE user_email_hash_idx_stmt;
DEALLOCATE PREPARE user_email_hash_idx_stmt;
