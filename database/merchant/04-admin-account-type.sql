-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 业务表 04:商家账号体系改造(计划 12-商家账号体系)
-- 库:mtrip_business
-- merchant_admin 增加显式 account_type(1集团 2商户 3门店)与 store_id,
-- 不再靠 merchant_id=0 && group_id>0 隐式推断账号类型。
-- 本脚本幂等:全新安装(01-merchant.sql 已含列)会探测跳过,存量库补列并回填。
-- ============================================================
USE `mtrip_business`;

-- ---------- merchant_admin.account_type(存量库补列;新库 01 已含,探测跳过) ----------
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_admin' AND COLUMN_NAME = 'account_type');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_admin` ADD COLUMN `account_type` TINYINT NOT NULL DEFAULT 2 COMMENT ''账号类型:1集团 2商户 3门店'' AFTER `site_id`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- merchant_admin.store_id(门店账号绑定) ----------
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_admin' AND COLUMN_NAME = 'store_id');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_admin` ADD COLUMN `store_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''所属门店ID(account_type=3时>0),0=非门店账号'' AFTER `group_id`, ADD KEY `idx_store_id` (`store_id`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 存量账号回填类型:集团账号(merchant_id=0 且 group_id>0)→1,其余保持默认 2 ----------
UPDATE `merchant_admin` SET `account_type` = 1
WHERE `merchant_id` = 0 AND `group_id` > 0 AND `account_type` <> 1;
