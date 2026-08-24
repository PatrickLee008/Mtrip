-- ============================================================
-- 商户业务编号(MCH-XXXX)
-- 库:mtrip_business
-- 创建入驻线索即生成，批准转正式商户时沿用同一编号。
-- ============================================================

SET NAMES utf8mb4;
USE `mtrip_business`;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'merchant_application'
    AND COLUMN_NAME = 'merchant_code'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `merchant_application` ADD COLUMN `merchant_code` VARCHAR(20) NULL DEFAULT NULL COMMENT ''商户业务编号(MCH-XXXX)'' AFTER `app_no`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `merchant_application`
SET `merchant_code` = CONCAT(
  'MCH-',
  CASE
    WHEN `id` < 10000 THEN LPAD(CAST(`id` AS CHAR), 4, '0')
    ELSE CAST(`id` AS CHAR)
  END
)
WHERE `merchant_code` IS NULL OR `merchant_code` = '';

SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'merchant_application'
    AND INDEX_NAME = 'uk_merchant_code'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE `merchant_application` ADD UNIQUE KEY `uk_merchant_code` (`merchant_code`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'merchant_info'
    AND COLUMN_NAME = 'merchant_code'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `merchant_info` ADD COLUMN `merchant_code` VARCHAR(20) NULL DEFAULT NULL COMMENT ''商户业务编号(MCH-XXXX)'' AFTER `id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `merchant_info` AS m
INNER JOIN `merchant_application` AS a ON a.`merchant_id` = m.`id`
SET m.`merchant_code` = a.`merchant_code`
WHERE m.`merchant_code` IS NULL OR m.`merchant_code` = '';

SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'merchant_info'
    AND INDEX_NAME = 'uk_merchant_code'
);
SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE `merchant_info` ADD UNIQUE KEY `uk_merchant_code` (`merchant_code`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
