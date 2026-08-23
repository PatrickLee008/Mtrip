-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Merchant App PRD v1.0 / M6 通知中心]:商户端通知已读状态
-- 库:mtrip_business;既有环境幂等补列,全新环境 11-merchant-notify.sql 已含这些列
-- ============================================================
USE `mtrip_business`;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_notify' AND COLUMN_NAME = 'read_at');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_notify` ADD COLUMN `read_at` DATETIME NULL DEFAULT NULL COMMENT ''商户端已读时间'' AFTER `status`, ADD COLUMN `read_by` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''商户端已读操作员ID'' AFTER `read_at`, ADD KEY `idx_read_at` (`read_at`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
