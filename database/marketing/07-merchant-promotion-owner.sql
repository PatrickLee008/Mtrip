-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Merchant App PRD v1.0 / M8 营销活动]:商家端优惠券归属字段
-- 库:mtrip_business;全新环境 01-marketing.sql 已包含这些列,存量库幂等补列/索引
-- ============================================================
USE `mtrip_business`;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'marketing_coupon' AND COLUMN_NAME = 'merchant_id');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `marketing_coupon` ADD COLUMN `merchant_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''商家ID(0=平台券)'' AFTER `site_id`, ADD COLUMN `created_by_merchant_admin` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''商家端创建人ID'' AFTER `merchant_id`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'marketing_coupon' AND INDEX_NAME = 'idx_merchant_id');
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE `marketing_coupon` ADD KEY `idx_merchant_id` (`merchant_id`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
