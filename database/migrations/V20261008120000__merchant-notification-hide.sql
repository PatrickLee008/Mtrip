SET NAMES utf8mb4;
USE `mtrip_business`;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_notify_read' AND COLUMN_NAME = 'hidden_at');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `merchant_notify_read` ADD COLUMN `hidden_at` DATETIME NULL DEFAULT NULL AFTER `read_at`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
