SET NAMES utf8mb4;

-- Bind public mobile-app application calls to the recipient that completed
-- registration OTP. The raw recipient stays out of this table and JWT claims.
USE `mtrip_business`;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_application' AND COLUMN_NAME = 'registration_channel');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `merchant_application` ADD COLUMN `registration_channel` VARCHAR(10) NOT NULL DEFAULT '''' COMMENT ''注册验证渠道:email/sms'' AFTER `submission_method`, ADD COLUMN `registration_contact_hash` CHAR(64) NOT NULL DEFAULT '''' COMMENT ''已验证注册收件人哈希'' AFTER `registration_channel`, ADD KEY `idx_registration_owner` (`site_id`,`registration_channel`,`registration_contact_hash`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
