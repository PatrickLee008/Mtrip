-- Empty-database snapshot; production changes use the versioned migrations.
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

USE `mtrip_business`;

DROP PROCEDURE IF EXISTS enforce_merchant_email_uniqueness;
DELIMITER $$
CREATE PROCEDURE enforce_merchant_email_uniqueness()
BEGIN
    -- Fail before changing business tables. Never choose or delete a duplicate owner.
    IF EXISTS (SELECT 1 FROM merchant_admin WHERE email_released_at IS NULL AND email <> ''
        AND (email_index IS NULL OR email_index NOT REGEXP '^[a-f0-9]{64}$'))
        OR EXISTS (SELECT 1 FROM merchant_application WHERE registration_email_released_at IS NULL
        AND registration_email <> '' AND (registration_email_index IS NULL
        OR registration_email_index NOT REGEXP '^[a-f0-9]{64}$')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Merchant email indexes incomplete; run email identity audit';
    END IF;
    IF EXISTS (SELECT email_index FROM merchant_admin WHERE email_released_at IS NULL
        AND email_index IS NOT NULL AND email_index <> '' GROUP BY email_index HAVING COUNT(*) > 1)
        OR EXISTS (SELECT registration_email_index FROM merchant_application
        WHERE registration_email_released_at IS NULL AND registration_email_index IS NOT NULL
        AND registration_email_index <> '' GROUP BY registration_email_index HAVING COUNT(*) > 1)
        OR EXISTS (SELECT 1 FROM merchant_application p JOIN merchant_admin a
        ON a.email_index=p.registration_email_index WHERE p.registration_email_released_at IS NULL
        AND a.email_released_at IS NULL AND a.email_index <> ''
        AND (p.merchant_id=0 OR p.merchant_id<>a.merchant_id OR a.is_owner<>1 OR a.account_type<>2)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Merchant email ownership conflicts; resolve audit report before migration';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_application' AND COLUMN_NAME='registration_email_identity_key') THEN
        ALTER TABLE merchant_application ADD COLUMN registration_email_identity_key CHAR(64)
            GENERATED ALWAYS AS (CASE WHEN registration_email_released_at IS NULL
                THEN NULLIF(registration_email_index, '') ELSE NULL END) STORED;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_application' AND INDEX_NAME='uk_registration_email_identity') THEN
        ALTER TABLE merchant_application ADD UNIQUE INDEX uk_registration_email_identity (registration_email_identity_key);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='email_identity_key') THEN
        ALTER TABLE merchant_admin ADD COLUMN email_identity_key CHAR(64)
            GENERATED ALWAYS AS (CASE WHEN email_released_at IS NULL
                THEN NULLIF(email_index, '') ELSE NULL END) STORED;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_admin' AND INDEX_NAME='uk_merchant_account_email_identity') THEN
        ALTER TABLE merchant_admin ADD UNIQUE INDEX uk_merchant_account_email_identity (email_identity_key);
    END IF;
END$$
DELIMITER ;
CALL enforce_merchant_email_uniqueness();
DROP PROCEDURE IF EXISTS enforce_merchant_email_uniqueness;
