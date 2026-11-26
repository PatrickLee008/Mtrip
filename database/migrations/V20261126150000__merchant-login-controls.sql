SET NAMES utf8mb4;
USE mtrip_business;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_info' AND COLUMN_NAME='email_login_enabled')=0,
 'ALTER TABLE merchant_info ADD email_login_enabled TINYINT NOT NULL DEFAULT 1, ADD sms_login_enabled TINYINT NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS merchant_trusted_device (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 site_id BIGINT UNSIGNED NOT NULL,
 merchant_id BIGINT UNSIGNED NOT NULL,
 account_id BIGINT UNSIGNED NOT NULL,
 installation_hash CHAR(64) NOT NULL,
 platform VARCHAR(16) NOT NULL,
 device_name VARCHAR(160) NOT NULL DEFAULT '',
 trusted_at DATETIME NOT NULL,
 revoked_at DATETIME NULL,
 UNIQUE KEY uk_device_installation(account_id,installation_hash),
 KEY idx_device_merchant(site_id,merchant_id,revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_login_session (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 site_id BIGINT UNSIGNED NOT NULL,
 merchant_id BIGINT UNSIGNED NOT NULL,
 account_id BIGINT UNSIGNED NOT NULL,
 auth_version BIGINT UNSIGNED NOT NULL,
 device_id BIGINT UNSIGNED NULL,
 method VARCHAR(24) NOT NULL,
 client VARCHAR(16) NOT NULL,
 device_name VARCHAR(160) NOT NULL DEFAULT '',
 ip_address VARCHAR(45) NOT NULL DEFAULT '',
 logged_in_at DATETIME NOT NULL,
 expires_at DATETIME NOT NULL,
 revoked_at DATETIME NULL,
 KEY idx_login_merchant(site_id,merchant_id,revoked_at,expires_at),
 KEY idx_login_account(account_id,revoked_at,expires_at),
 KEY idx_login_device(device_id,revoked_at,expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_login_pairing (
 code_hash CHAR(64) NOT NULL PRIMARY KEY,
 account_id BIGINT UNSIGNED NOT NULL,
 auth_version BIGINT UNSIGNED NOT NULL,
 expires_at DATETIME NOT NULL,
 consumed_at DATETIME NULL,
 KEY idx_pairing_account(account_id,consumed_at,expires_at),
 KEY idx_pairing_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_login_audit (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 site_id BIGINT UNSIGNED NOT NULL,
 merchant_id BIGINT UNSIGNED NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 actor_name VARCHAR(100) NOT NULL,
 actor_type VARCHAR(12) NOT NULL,
 action VARCHAR(24) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 changes_json JSON NOT NULL,
 created_at DATETIME NOT NULL,
 KEY idx_login_audit_merchant(site_id,merchant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

USE mtrip_system;
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(30118,301,'商户登录及设备管控','Manage Merchant Login and Devices','merchant:list:security',3,18);
