SET NAMES utf8mb4;
USE `mtrip_business`;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_coupon' AND COLUMN_NAME='current_version_id')=0,
  'ALTER TABLE marketing_coupon ADD COLUMN current_version_id BIGINT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_coupon_receive' AND COLUMN_NAME='coupon_version_id')=0,
  'ALTER TABLE marketing_coupon_receive ADD COLUMN coupon_version_id BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD KEY idx_coupon_version (coupon_version_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_coupon' AND COLUMN_NAME='merchant_policy')=0,
  'ALTER TABLE marketing_coupon ADD COLUMN merchant_policy JSON NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_coupon_receive' AND COLUMN_NAME='rules_snapshot')=0,
  'ALTER TABLE marketing_coupon_receive ADD COLUMN rules_snapshot JSON NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS marketing_coupon_version (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT UNSIGNED NOT NULL,
  coupon_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(32) NOT NULL,
  actor_type VARCHAR(16) NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  rules_snapshot JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_coupon_history (coupon_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Existing receipts have no historical rules to reconstruct. Before the next
-- change/claim, the service freezes the last known template and links legacy
-- receipts to a clearly identified legacy_baseline version.
