SET NAMES utf8mb4;
USE `mtrip_business`;

DROP PROCEDURE IF EXISTS add_final_approval_column;
DELIMITER $$
CREATE PROCEDURE add_final_approval_column(IN p_column VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME=p_column
  ) THEN
    SET @final_approval_ddl=p_ddl;
    PREPARE final_approval_stmt FROM @final_approval_ddl;
    EXECUTE final_approval_stmt;
    DEALLOCATE PREPARE final_approval_stmt;
  END IF;
END$$
DELIMITER ;

CALL add_final_approval_column('email',
  'ALTER TABLE merchant_admin ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''登录账号邮箱(加密)'' AFTER mobile');
CALL add_final_approval_column('mobile_index',
  'ALTER TABLE merchant_admin ADD COLUMN mobile_index CHAR(64) NULL COMMENT ''登录账号手机检索哈希'' AFTER mobile');
CALL add_final_approval_column('email_index',
  'ALTER TABLE merchant_admin ADD COLUMN email_index CHAR(64) NULL COMMENT ''登录账号邮箱检索哈希'' AFTER email');
DROP PROCEDURE IF EXISTS add_final_approval_column;

DROP PROCEDURE IF EXISTS add_final_approval_index;
DELIMITER $$
CREATE PROCEDURE add_final_approval_index(IN p_index VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND INDEX_NAME=p_index
  ) THEN
    SET @final_approval_ddl=p_ddl;
    PREPARE final_approval_stmt FROM @final_approval_ddl;
    EXECUTE final_approval_stmt;
    DEALLOCATE PREPARE final_approval_stmt;
  END IF;
END$$
DELIMITER ;

CALL add_final_approval_index('idx_mobile_index',
  'ALTER TABLE merchant_admin ADD INDEX idx_mobile_index (site_id,mobile_index)');
CALL add_final_approval_index('idx_email_index',
  'ALTER TABLE merchant_admin ADD INDEX idx_email_index (site_id,email_index)');
DROP PROCEDURE IF EXISTS add_final_approval_index;

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

USE `mtrip_system`;
UPDATE sys_menu
SET menu_name='基础注册通过',menu_name_en='Approve Registration',perm_key='merchant:onboarding:registration-approve'
WHERE id=20505;
INSERT IGNORE INTO sys_menu(id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(20507,205,'最终批准','Final Approval','merchant:onboarding:final-approve',3,7),
(20508,205,'重试凭证投递','Retry Credentials','merchant:onboarding:credential-retry',3,8);
-- Existing role grants are intentionally unchanged; super administrators bypass role grants.
