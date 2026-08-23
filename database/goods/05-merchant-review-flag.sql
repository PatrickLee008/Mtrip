-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Merchant App PRD v1.0 / M9 评价管理]:商户标记评价复核
-- 库:mtrip_business;既有环境幂等补列,全新环境 03-consumer-review.sql 已含这些列
-- ============================================================
USE `mtrip_business`;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'goods_review' AND COLUMN_NAME = 'merchant_flag_status');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `goods_review` ADD COLUMN `merchant_flag_status` TINYINT NOT NULL DEFAULT 0 COMMENT ''商户标记复核状态:0未标记 1已标记'' AFTER `reply_content`, ADD COLUMN `merchant_flag_reason` VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''商户标记复核原因'' AFTER `merchant_flag_status`, ADD COLUMN `merchant_flagged_at` DATETIME NULL DEFAULT NULL COMMENT ''商户标记复核时间'' AFTER `merchant_flag_reason`, ADD COLUMN `merchant_flagged_by` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''商户标记复核操作员ID'' AFTER `merchant_flagged_at`, ADD KEY `idx_merchant_flag` (`merchant_flag_status`, `merchant_flagged_at`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
