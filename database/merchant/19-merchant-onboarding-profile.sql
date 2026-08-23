-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [最新原型 localhost:8443 v4.2.1]:线索档案字段补充
-- 库:mtrip_business
--
-- 原型表格/详情:Merchant Name(商家名称) 与 Business Name(公司名称) 分列展示,
-- 注册信息含 City(城市)/Address(注册地址);录入线索时分开填写。
-- ============================================================
USE `mtrip_business`;

-- merchant_application.merchant_name 商家/品牌名称(表格 Merchant Name 列)
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_application' AND COLUMN_NAME = 'merchant_name');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_application` ADD COLUMN `merchant_name` VARCHAR(100) NOT NULL DEFAULT '''' COMMENT ''商家/品牌名称(Merchant Name)'' AFTER `company_name`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- merchant_application.city 城市
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_application' AND COLUMN_NAME = 'city');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_application` ADD COLUMN `city` VARCHAR(50) NOT NULL DEFAULT '''' COMMENT ''城市'' AFTER `country`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- merchant_application.address 注册地址
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_application' AND COLUMN_NAME = 'address');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_application` ADD COLUMN `address` VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''注册地址'' AFTER `city`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
