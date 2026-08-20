-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / 商户管理整改 A3+B3]:商户账户安全
-- 需求源:docs/redesign/需求分析-商户管理模块.md §3.5.5(Account Security / 2FA)
-- 库:mtrip_business
-- merchant_info 补 2FA 字段(守卫式幂等:探测列存在则跳过)
-- ============================================================
USE `mtrip_business`;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_info' AND COLUMN_NAME = 'two_fa_enabled');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_info` ADD COLUMN `two_fa_enabled` TINYINT NOT NULL DEFAULT 0 COMMENT ''2FA是否启用:0否 1是'' AFTER `reject_reason_code`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_info' AND COLUMN_NAME = 'two_fa_method');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_info` ADD COLUMN `two_fa_method` VARCHAR(30) NOT NULL DEFAULT '''' COMMENT ''2FA方式(google_authenticator等)'' AFTER `two_fa_enabled`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_info' AND COLUMN_NAME = 'two_fa_enrolled_at');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_info` ADD COLUMN `two_fa_enrolled_at` DATETIME NULL DEFAULT NULL COMMENT ''2FA绑定时间'' AFTER `two_fa_method`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_info' AND COLUMN_NAME = 'two_fa_last_reset_at');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_info` ADD COLUMN `two_fa_last_reset_at` DATETIME NULL DEFAULT NULL COMMENT ''2FA最近重置时间(重置后商户需重新绑定)'' AFTER `two_fa_enrolled_at`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
