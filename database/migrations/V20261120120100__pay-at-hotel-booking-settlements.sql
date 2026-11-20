SET NAMES utf8mb4;
USE mtrip_business;

SET @pah_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_merchant_settle' AND COLUMN_NAME='order_id'),
 'SELECT 1', 'ALTER TABLE finance_merchant_settle ADD COLUMN order_id BIGINT UNSIGNED NULL, ADD UNIQUE KEY uk_booking_settle (order_id)');
PREPARE pah_stmt FROM @pah_ddl; EXECUTE pah_stmt; DEALLOCATE PREPARE pah_stmt;
SET @pah_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_merchant_settle' AND COLUMN_NAME='accounting_snapshot'),
 'SELECT 1', 'ALTER TABLE finance_merchant_settle ADD COLUMN accounting_snapshot JSON NULL');
PREPARE pah_stmt FROM @pah_ddl; EXECUTE pah_stmt; DEALLOCATE PREPARE pah_stmt;
SET @pah_ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_main' AND COLUMN_NAME='hotel_reconciliation_status'),
 'SELECT 1', 'ALTER TABLE order_main ADD COLUMN hotel_reconciliation_status TINYINT NOT NULL DEFAULT 0 COMMENT ''0 pending 1 reconciled 2 review'', ADD COLUMN hotel_reconciled_at DATETIME NULL');
PREPARE pah_stmt FROM @pah_ddl; EXECUTE pah_stmt; DEALLOCATE PREPARE pah_stmt;
