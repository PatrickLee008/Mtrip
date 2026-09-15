SET NAMES utf8mb4;
USE `mtrip_business`;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='mobile_index')=0,
  'ALTER TABLE merchant_admin ADD COLUMN mobile_index CHAR(64) NULL AFTER mobile, ADD INDEX idx_mobile_index(site_id,mobile_index)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='email')=0,
  'ALTER TABLE merchant_admin ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT '''' AFTER mobile_index', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='email_index')=0,
  'ALTER TABLE merchant_admin ADD COLUMN email_index CHAR(64) NULL AFTER email, ADD INDEX idx_email_index(site_id,email_index)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS merchant_credential_delivery (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL,
  application_id BIGINT UNSIGNED NOT NULL,
  merchant_id BIGINT UNSIGNED NOT NULL,
  account_id BIGINT UNSIGNED NOT NULL,
  approval_request_id VARCHAR(80) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  recipient_ciphertext VARCHAR(500) NOT NULL DEFAULT '',
  credential_ciphertext TEXT NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/processing/delivered/failed',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 5,
  next_attempt_at DATETIME NULL,
  locked_at DATETIME NULL,
  delivered_at DATETIME NULL,
  provider_receipt VARCHAR(255) NOT NULL DEFAULT '',
  last_error VARCHAR(255) NOT NULL DEFAULT '',
  created_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_application_channel (application_id,channel),
  KEY idx_credential_delivery_due (status,next_attempt_at),
  KEY idx_credential_delivery_merchant (site_id,merchant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='入驻凭证投递outbox';
