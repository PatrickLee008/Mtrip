SET NAMES utf8mb4;
USE `mtrip_business`;

-- Abort before changing ambiguous records; an empty hash with a real phone needs repair.
DROP PROCEDURE IF EXISTS mtrip_prepare_social_users;
DELIMITER $$
CREATE PROCEDURE mtrip_prepare_social_users()
BEGIN
  IF EXISTS (SELECT 1 FROM user_info WHERE (mobile_hash = '' OR mobile_hash IS NULL) AND mobile <> '') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit required: user has mobile without mobile_hash';
  END IF;
END$$
DELIMITER ;
CALL mtrip_prepare_social_users();
DROP PROCEDURE mtrip_prepare_social_users;

ALTER TABLE user_info MODIFY COLUMN mobile_hash CHAR(64) NULL DEFAULT NULL COMMENT 'Phone HMAC; NULL when unbound';
UPDATE user_info SET mobile_hash = NULL WHERE mobile = '' AND mobile_hash = '';

CREATE TABLE IF NOT EXISTS user_social_identity (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(20) NOT NULL,
  provider_app_id VARCHAR(64) NOT NULL,
  provider_user_id VARCHAR(128) NOT NULL,
  consent_version VARCHAR(64) NOT NULL,
  consent_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_social_identity (site_id, provider, provider_app_id, provider_user_id),
  KEY idx_social_user (site_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='Third party login identities';
