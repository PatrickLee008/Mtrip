-- ============================================================
-- 商户入驻申请公司注册号唯一性
-- 库:mtrip_business
-- 空注册号与软删除记录不参与唯一校验；有效注册号全平台唯一。
-- ============================================================

USE `mtrip_business`;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'merchant_application'
    AND COLUMN_NAME = 'active_reg_number'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `merchant_application` ADD COLUMN `active_reg_number` VARCHAR(50) GENERATED ALWAYS AS (CASE WHEN `deleted_at` IS NULL AND `reg_number` <> '''' THEN `reg_number` ELSE NULL END) STORED COMMENT ''有效公司注册号(唯一校验)'' AFTER `reg_number`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'merchant_application'
    AND INDEX_NAME = 'uk_active_reg_number'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE `merchant_application` ADD UNIQUE KEY `uk_active_reg_number` (`active_reg_number`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
