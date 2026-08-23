-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / 商户管理整改 B4]:KYC 商户确认状态位
-- 需求源:docs/redesign/需求分析-商户管理模块.md §3.3.2(Merchant Confirmation)
-- 库:mtrip_business;确认接口本期仅契约(merchant-web 接入另行排期)
-- ============================================================
USE `mtrip_business`;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_application' AND COLUMN_NAME = 'confirmation_status');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_application` ADD COLUMN `confirmation_status` TINYINT NOT NULL DEFAULT 0 COMMENT ''商户确认KYC提交:0未确认 1已确认'' AFTER `submission_method`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_application' AND COLUMN_NAME = 'confirmed_at');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_application` ADD COLUMN `confirmed_at` DATETIME NULL DEFAULT NULL COMMENT ''商户确认时间'' AFTER `confirmation_status`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
