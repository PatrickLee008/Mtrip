SET NAMES utf8mb4;
USE `mtrip_business`;

DROP PROCEDURE IF EXISTS add_registration_identity_column;
DELIMITER $$
CREATE PROCEDURE add_registration_identity_column()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'merchant_application'
      AND COLUMN_NAME = 'registration_identity_key'
  ) THEN
    ALTER TABLE merchant_application
      ADD COLUMN registration_identity_key CHAR(129)
        GENERATED ALWAYS AS (
          CASE
            WHEN deleted_at IS NULL
              AND registration_phone_index IS NOT NULL
              AND registration_phone_index <> ''
              AND registration_email_index IS NOT NULL
              AND registration_email_index <> ''
            THEN CONCAT(registration_phone_index, ':', registration_email_index)
            ELSE NULL
          END
        ) STORED
        COMMENT '有效注册草稿双联系方式唯一键'
        AFTER registration_email_index;
  END IF;
END$$
DELIMITER ;

CALL add_registration_identity_column();
DROP PROCEDURE IF EXISTS add_registration_identity_column;

DROP PROCEDURE IF EXISTS add_registration_identity_index;
DELIMITER $$
CREATE PROCEDURE add_registration_identity_index()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'merchant_application'
      AND INDEX_NAME = 'uk_registration_identity'
  ) THEN
    ALTER TABLE merchant_application
      ADD UNIQUE INDEX uk_registration_identity (site_id, registration_identity_key);
  END IF;
END$$
DELIMITER ;

CALL add_registration_identity_index();
DROP PROCEDURE IF EXISTS add_registration_identity_index;
