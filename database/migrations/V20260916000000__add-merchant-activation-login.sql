SET NAMES utf8mb4;
USE `mtrip_business`;

DROP PROCEDURE IF EXISTS add_merchant_auth_column;
DELIMITER $$
CREATE PROCEDURE add_merchant_auth_column(IN p_column VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME=p_column
  ) THEN
    SET @merchant_auth_ddl=p_ddl;
    PREPARE merchant_auth_stmt FROM @merchant_auth_ddl;
    EXECUTE merchant_auth_stmt;
    DEALLOCATE PREPARE merchant_auth_stmt;
  END IF;
END$$
DELIMITER ;

CALL add_merchant_auth_column('verified_mobile_at',
  'ALTER TABLE merchant_admin ADD COLUMN verified_mobile_at DATETIME NULL COMMENT ''最近一次验证注册手机号时间'' AFTER email_index');
CALL add_merchant_auth_column('verified_email_at',
  'ALTER TABLE merchant_admin ADD COLUMN verified_email_at DATETIME NULL COMMENT ''最近一次验证注册邮箱时间'' AFTER verified_mobile_at');
CALL add_merchant_auth_column('google_subject_hash',
  'ALTER TABLE merchant_admin ADD COLUMN google_subject_hash CHAR(64) NULL COMMENT ''已关联Google subject检索哈希'' AFTER verified_email_at');
CALL add_merchant_auth_column('google_email',
  'ALTER TABLE merchant_admin ADD COLUMN google_email VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''已关联Google邮箱(加密)'' AFTER google_subject_hash');
CALL add_merchant_auth_column('google_linked_at',
  'ALTER TABLE merchant_admin ADD COLUMN google_linked_at DATETIME NULL COMMENT ''Google身份关联时间'' AFTER google_email');
CALL add_merchant_auth_column('activated_at',
  'ALTER TABLE merchant_admin ADD COLUMN activated_at DATETIME NULL COMMENT ''首次账号激活时间'' AFTER google_linked_at');
CALL add_merchant_auth_column('last_login_method',
  'ALTER TABLE merchant_admin ADD COLUMN last_login_method VARCHAR(30) NOT NULL DEFAULT '''' COMMENT ''最近认证方式'' AFTER activated_at');
DROP PROCEDURE IF EXISTS add_merchant_auth_column;

DROP PROCEDURE IF EXISTS add_merchant_auth_index;
DELIMITER $$
CREATE PROCEDURE add_merchant_auth_index(IN p_index VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND INDEX_NAME=p_index
  ) THEN
    SET @merchant_auth_ddl=p_ddl;
    PREPARE merchant_auth_stmt FROM @merchant_auth_ddl;
    EXECUTE merchant_auth_stmt;
    DEALLOCATE PREPARE merchant_auth_stmt;
  END IF;
END$$
DELIMITER ;

CALL add_merchant_auth_index('uk_google_subject_hash',
  'ALTER TABLE merchant_admin ADD UNIQUE INDEX uk_google_subject_hash (google_subject_hash)');
DROP PROCEDURE IF EXISTS add_merchant_auth_index;

CREATE TABLE IF NOT EXISTS merchant_auth_challenge (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  account_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  purpose VARCHAR(24) NOT NULL COMMENT 'activation_identity/activation/login/recovery',
  method VARCHAR(30) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  identifier_hash CHAR(64) NOT NULL DEFAULT '',
  recipient_ciphertext VARCHAR(500) NOT NULL DEFAULT '',
  google_subject_hash CHAR(64) NOT NULL DEFAULT '',
  otp_hash CHAR(64) NOT NULL DEFAULT '',
  provider_request_id VARCHAR(120) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/verified/consumed/expired/locked',
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 5,
  expires_at DATETIME NOT NULL,
  resend_available_at DATETIME NULL,
  verified_at DATETIME NULL,
  consumed_at DATETIME NULL,
  request_ip_hash CHAR(64) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_auth_challenge_token (token_hash),
  KEY idx_auth_challenge_account (account_id,purpose,status,id),
  KEY idx_auth_challenge_identifier (identifier_hash,purpose,status,id),
  KEY idx_auth_challenge_expiry (status,expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户激活与登录一次性挑战';
