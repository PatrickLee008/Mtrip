SET NAMES utf8mb4;
USE mtrip_business;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='amenities')=0,
  'ALTER TABLE merchant_store ADD COLUMN amenities JSON NULL COMMENT ''分组设施、图标及启用亮点状态'' AFTER facilities', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
