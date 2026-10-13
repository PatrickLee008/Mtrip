USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS merchant_phone_identity_lock (
    phone_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (phone_hash)
) ENGINE=InnoDB COMMENT='Serializes registration and account creation for one mobile';

DROP PROCEDURE IF EXISTS add_merchant_mobile_release_columns;
DELIMITER $$
CREATE PROCEDURE add_merchant_mobile_release_columns()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='mobile_released_at') THEN
        ALTER TABLE merchant_admin ADD COLUMN mobile_released_at DATETIME NULL
            COMMENT 'Explicit audited mobile release; deletion alone does not release';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_application' AND COLUMN_NAME='registration_phone_released_at') THEN
        ALTER TABLE merchant_application ADD COLUMN registration_phone_released_at DATETIME NULL
            COMMENT 'Explicit audited registration mobile release';
    END IF;
END$$
DELIMITER ;
CALL add_merchant_mobile_release_columns();
DROP PROCEDURE IF EXISTS add_merchant_mobile_release_columns;

DROP PROCEDURE IF EXISTS add_merchant_contact_proofs;
DELIMITER $$
CREATE PROCEDURE add_merchant_contact_proofs()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_application' AND COLUMN_NAME='registration_otp_source') THEN
        ALTER TABLE merchant_application ADD COLUMN registration_otp_source VARCHAR(16) NOT NULL DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_application' AND COLUMN_NAME='registration_verified_email_at') THEN
        ALTER TABLE merchant_application ADD COLUMN registration_verified_email_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_application' AND COLUMN_NAME='registration_verified_mobile_at') THEN
        ALTER TABLE merchant_application ADD COLUMN registration_verified_mobile_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='email_verification_source') THEN
        ALTER TABLE merchant_admin ADD COLUMN email_verification_source VARCHAR(16) NOT NULL DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='mobile_verification_source') THEN
        ALTER TABLE merchant_admin ADD COLUMN mobile_verification_source VARCHAR(16) NOT NULL DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='test_verified_email_at') THEN
        ALTER TABLE merchant_admin ADD COLUMN test_verified_email_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='test_verified_mobile_at') THEN
        ALTER TABLE merchant_admin ADD COLUMN test_verified_mobile_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='credential_expires_at') THEN
        ALTER TABLE merchant_admin ADD COLUMN credential_expires_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_auth_challenge' AND COLUMN_NAME='context_json') THEN
        ALTER TABLE merchant_auth_challenge ADD COLUMN context_json JSON NULL;
    END IF;
END$$
DELIMITER ;
CALL add_merchant_contact_proofs();
DROP PROCEDURE IF EXISTS add_merchant_contact_proofs;

CREATE TABLE IF NOT EXISTS merchant_contact_identity_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    site_id BIGINT UNSIGNED NOT NULL, account_id BIGINT UNSIGNED NOT NULL,
    channel VARCHAR(10) NOT NULL, contact_ciphertext VARCHAR(255) NOT NULL,
    contact_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    released_at DATETIME NOT NULL, reason VARCHAR(100) NOT NULL,
    KEY idx_contact_history_account (account_id, id)
) ENGINE=InnoDB COMMENT='Audited historical contacts explicitly released during secure rebind';

USE `mtrip_business`;

DROP PROCEDURE IF EXISTS enforce_merchant_mobile_uniqueness;
DELIMITER $$
CREATE PROCEDURE enforce_merchant_mobile_uniqueness()
BEGIN
    -- Fail before changing business tables. Never choose or delete a duplicate owner.
    IF EXISTS (SELECT 1 FROM merchant_admin WHERE account_type=2 AND is_owner=1 AND mobile_released_at IS NULL AND mobile <> ''
        AND (mobile_index IS NULL OR mobile_index NOT REGEXP '^[a-f0-9]{64}$'))
        OR EXISTS (SELECT 1 FROM merchant_application WHERE registration_phone_released_at IS NULL
        AND registration_phone <> '' AND (registration_phone_index IS NULL
        OR registration_phone_index NOT REGEXP '^[a-f0-9]{64}$')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Merchant phone indexes incomplete; run mobile identity audit';
    END IF;
    IF EXISTS (SELECT mobile_index FROM merchant_admin WHERE account_type=2 AND is_owner=1 AND mobile_released_at IS NULL
        AND mobile_index IS NOT NULL AND mobile_index <> '' GROUP BY mobile_index HAVING COUNT(*) > 1)
        OR EXISTS (SELECT registration_phone_index FROM merchant_application
        WHERE registration_phone_released_at IS NULL AND registration_phone_index IS NOT NULL
        AND registration_phone_index <> '' GROUP BY registration_phone_index HAVING COUNT(*) > 1)
        OR EXISTS (SELECT 1 FROM merchant_application p JOIN merchant_admin a
        ON a.mobile_index=p.registration_phone_index WHERE p.registration_phone_released_at IS NULL
        AND a.account_type=2 AND a.is_owner=1 AND a.mobile_released_at IS NULL AND a.mobile_index <> ''
        AND (p.merchant_id=0 OR p.merchant_id<>a.merchant_id OR a.is_owner<>1 OR a.account_type<>2)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Merchant phone ownership conflicts; resolve audit report before migration';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_application' AND COLUMN_NAME='registration_phone_identity_key') THEN
        ALTER TABLE merchant_application ADD COLUMN registration_phone_identity_key CHAR(64)
            GENERATED ALWAYS AS (CASE WHEN registration_phone_released_at IS NULL
                THEN NULLIF(registration_phone_index, '') ELSE NULL END) STORED;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_application' AND INDEX_NAME='uk_registration_phone_identity') THEN
        ALTER TABLE merchant_application ADD UNIQUE INDEX uk_registration_phone_identity (registration_phone_identity_key);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_admin' AND COLUMN_NAME='mobile_identity_key') THEN
        ALTER TABLE merchant_admin ADD COLUMN mobile_identity_key CHAR(64)
            GENERATED ALWAYS AS (CASE WHEN account_type=2 AND is_owner=1 AND mobile_released_at IS NULL
                THEN NULLIF(mobile_index, '') ELSE NULL END) STORED;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='merchant_admin' AND INDEX_NAME='uk_merchant_account_mobile_identity') THEN
        ALTER TABLE merchant_admin ADD UNIQUE INDEX uk_merchant_account_mobile_identity (mobile_identity_key);
    END IF;
END$$
DELIMITER ;
CALL enforce_merchant_mobile_uniqueness();
DROP PROCEDURE IF EXISTS enforce_merchant_mobile_uniqueness;
