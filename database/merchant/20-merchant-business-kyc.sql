-- ============================================================
-- Mtrip 商户库增量:业务单元级 KYC 配置
-- 原型 KYC Management:点击 Registered Businesses 卡片切换
-- Verification Scope / Business Type / Verification Template / Required Documents
-- 数据库: mtrip_business
-- ============================================================
USE `mtrip_business`;

-- merchant_application_business 增加验证范围
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'merchant_application_business' AND COLUMN_NAME = 'kyc_scope');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_application_business` ADD COLUMN `kyc_scope` TINYINT NOT NULL DEFAULT 1 COMMENT ''验证范围:1新商户 2追加业务'' AFTER `city`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- merchant_application_business 增加 KYC 模板
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'merchant_application_business' AND COLUMN_NAME = 'kyc_template_id');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_application_business` ADD COLUMN `kyc_template_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''KYC模板ID(merchant_kyc_template)'' AFTER `kyc_scope`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 存量回填:未配置模板的业务单元取同业态首个启用模板(与前端默认推导一致)
UPDATE `merchant_application_business` b
JOIN (
  SELECT `business_type`, MIN(`id`) AS tpl_id
  FROM `merchant_kyc_template`
  WHERE `status` = 1
  GROUP BY `business_type`
) m ON m.business_type = b.business_type
SET b.kyc_template_id = m.tpl_id
WHERE b.kyc_template_id = 0;
