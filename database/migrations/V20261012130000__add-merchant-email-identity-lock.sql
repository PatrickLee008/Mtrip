USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS merchant_email_identity_lock (
    email_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (email_hash)
) ENGINE=InnoDB COMMENT='Serializes registration and account creation for one email';

DROP PROCEDURE IF EXISTS add_merchant_email_release_columns;
DELIMITER $$
CREATE PROCEDURE add_merchant_email_release_columns()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='email_released_at') THEN
        ALTER TABLE merchant_admin ADD COLUMN email_released_at DATETIME NULL
            COMMENT 'Explicit audited email release; deletion alone does not release';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_application' AND COLUMN_NAME='registration_email_released_at') THEN
        ALTER TABLE merchant_application ADD COLUMN registration_email_released_at DATETIME NULL
            COMMENT 'Explicit audited registration email release';
    END IF;
END$$
DELIMITER ;
CALL add_merchant_email_release_columns();
DROP PROCEDURE IF EXISTS add_merchant_email_release_columns;
