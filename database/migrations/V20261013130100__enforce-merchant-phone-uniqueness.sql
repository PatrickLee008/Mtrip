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
