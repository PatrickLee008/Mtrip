-- M12 S4: account-specific authentication. Do not copy legacy merchant-level secrets.
SET NAMES utf8mb4;
USE `mtrip_business`;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='two_fa_status')=0,
 'ALTER TABLE merchant_admin ADD COLUMN two_fa_status TINYINT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='two_fa_method')=0,
 'ALTER TABLE merchant_admin ADD COLUMN two_fa_method VARCHAR(30) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='two_fa_secret_enc')=0,
 'ALTER TABLE merchant_admin ADD COLUMN two_fa_secret_enc VARCHAR(255) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='two_fa_enrolled_at')=0,
 'ALTER TABLE merchant_admin ADD COLUMN two_fa_enrolled_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='two_fa_last_reset_at')=0,
 'ALTER TABLE merchant_admin ADD COLUMN two_fa_last_reset_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='auth_version')=0,
 'ALTER TABLE merchant_admin ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='last_accepted_totp_step')=0,
 'ALTER TABLE merchant_admin ADD COLUMN last_accepted_totp_step BIGINT NOT NULL DEFAULT -1', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='challenge_hash')=0,
 'ALTER TABLE merchant_admin ADD COLUMN challenge_hash CHAR(64) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='challenge_expires_at')=0,
 'ALTER TABLE merchant_admin ADD COLUMN challenge_expires_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='pending_secret_enc')=0,
 'ALTER TABLE merchant_admin ADD COLUMN pending_secret_enc VARCHAR(255) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='security_fail_count')=0,
 'ALTER TABLE merchant_admin ADD COLUMN security_fail_count INT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='security_locked_until')=0,
 'ALTER TABLE merchant_admin ADD COLUMN security_locked_until DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_impersonation_session' AND COLUMN_NAME='target_account_id')=0,
 'ALTER TABLE merchant_impersonation_session ADD COLUMN target_account_id BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_impersonation_session' AND COLUMN_NAME='auth_version')=0,
 'ALTER TABLE merchant_impersonation_session ADD COLUMN auth_version INT UNSIGNED NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_impersonation_session' AND COLUMN_NAME='exchange_hash')=0,
 'ALTER TABLE merchant_impersonation_session ADD COLUMN exchange_hash CHAR(64) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_impersonation_session' AND COLUMN_NAME='exchange_expires_at')=0,
 'ALTER TABLE merchant_impersonation_session ADD COLUMN exchange_expires_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_impersonation_session' AND COLUMN_NAME='exchanged_at')=0,
 'ALTER TABLE merchant_impersonation_session ADD COLUMN exchanged_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_impersonation_session' AND COLUMN_NAME='expires_at')=0,
 'ALTER TABLE merchant_impersonation_session ADD COLUMN expires_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_activity_log' AND COLUMN_NAME='impersonation_session_id')=0,
 'ALTER TABLE merchant_activity_log ADD COLUMN impersonation_session_id BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_impersonation_session' AND INDEX_NAME='uk_exchange_hash')=0,
 'ALTER TABLE merchant_impersonation_session ADD UNIQUE INDEX uk_exchange_hash (exchange_hash)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_impersonation_session' AND INDEX_NAME='idx_status_expires')=0,
 'ALTER TABLE merchant_impersonation_session ADD INDEX idx_status_expires (status, expires_at)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Old placeholder sessions have no target/expiry and cannot be exchanged or authorized.
-- Existing accounts enroll independently at their next login; old JWTs lack auth_version.
