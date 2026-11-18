SET NAMES utf8mb4;
USE `mtrip_business`;

-- Public templates have application_business_id=0. Private immutable versions
-- remain addressable by ID after final approval, but are never offered as defaults.
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_kyc_template' AND COLUMN_NAME='application_business_id')=0,
  'ALTER TABLE merchant_kyc_template ADD COLUMN application_business_id BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD COLUMN source_template_id BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD INDEX idx_template_business (application_business_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
