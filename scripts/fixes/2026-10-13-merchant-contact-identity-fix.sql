-- One-off data fix (test server, 2026-10-13): unblock the merchant contact uniqueness migrations.
-- User-confirmed test data. Merchant/property rows are untouched; only owner accounts and applications change.
--
-- Part 1  V20261012130100__enforce-merchant-email-uniqueness (executed 2026-10-13; re-run skips)
--   Release all three duplicated emails, soft-delete the five accounts.
--   87af...  accounts 4707(m7005) 4708(m7006)            applications 1019 1027 1028
--   54b5...  accounts 4709(m7007) 4710(m7008) 4711(m7009) applications 1029 1030 1033
--   97ba...  no account                                    draft applications 1032 1039 (also soft-deleted)
-- Part 2  V20261013130100__enforce-merchant-phone-uniqueness
--   27 owner accounts have an AES-GCM mobile but no mobile_index (SQL cannot decrypt/rehash):
--   release the mobile and soft-delete 4001-4023, 4701-4704.
--   Phone ownership conflicts (hash prefix shown):
--   ac401c53  accounts 4710 4711 (already deleted) 4712 4713 (soft-deleted here)
--             applications 1020 1030 1033 1034 1036 1037            -> all released
--   09580782  application 1026 (merchant 0) vs owner 4714/app 1038   -> release 1026 only; 4714/1038 kept
--   cdade6f9  applications 1021 1022 (merchant 0, no account)       -> both released
--
-- Each part verifies exact ids first: all pending -> apply; all done -> skip; anything else -> rollback.
-- Before commit, each part re-checks the migration's own guard conditions.
-- Not a migration: never move into database/.
SET NAMES utf8mb4;
USE `mtrip_business`;

-- ---------------------------------------------------------------- Part 1: email
DROP PROCEDURE IF EXISTS fix_duplicate_merchant_emails_20261013;
DELIMITER $$
CREATE PROCEDURE fix_duplicate_merchant_emails_20261013()
fix: BEGIN
    DECLARE v_accounts INT DEFAULT 0;
    DECLARE v_applications INT DEFAULT 0;
    DECLARE v_done_accounts INT DEFAULT 0;
    DECLARE v_done_applications INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;

    SELECT COUNT(*), COALESCE(SUM(email_released_at IS NULL AND deleted_at IS NULL), 0)
    INTO v_done_accounts, v_accounts FROM merchant_admin
    WHERE (id, email_index) IN (
        (4707, '87afbcddac87fed0af427568d0c9259ffdc19a8407162055a8b93c72e22693ea'),
        (4708, '87afbcddac87fed0af427568d0c9259ffdc19a8407162055a8b93c72e22693ea'),
        (4709, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'),
        (4710, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'),
        (4711, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'))
    FOR UPDATE;
    SELECT COUNT(*), COALESCE(SUM(registration_email_released_at IS NULL), 0)
    INTO v_done_applications, v_applications FROM merchant_application
    WHERE (id, registration_email_index) IN (
        (1019, '87afbcddac87fed0af427568d0c9259ffdc19a8407162055a8b93c72e22693ea'),
        (1027, '87afbcddac87fed0af427568d0c9259ffdc19a8407162055a8b93c72e22693ea'),
        (1028, '87afbcddac87fed0af427568d0c9259ffdc19a8407162055a8b93c72e22693ea'),
        (1029, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'),
        (1030, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'),
        (1033, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'),
        (1032, '97ba5d0e1e92b4643cb4b7f0ec7ba2648de99d2d67eb3aaa01d33d22a00abb5a'),
        (1039, '97ba5d0e1e92b4643cb4b7f0ec7ba2648de99d2d67eb3aaa01d33d22a00abb5a'))
    FOR UPDATE;
    IF v_done_accounts = 5 AND v_done_applications = 8 AND v_accounts = 0 AND v_applications = 0 THEN
        ROLLBACK;
        SELECT 'Part 1 email: already applied, skipped' AS result;
        LEAVE fix;
    END IF;
    IF v_done_accounts <> 5 OR v_done_applications <> 8 OR v_accounts <> 5 OR v_applications <> 8 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Part 1: rows differ from the confirmed audit; nothing changed';
    END IF;

    UPDATE merchant_admin
    SET email_released_at = NOW(), deleted_at = NOW(), auth_version = auth_version + 1
    WHERE id IN (4707, 4708, 4709, 4710, 4711);

    UPDATE merchant_auth_challenge SET status = 'expired'
    WHERE account_id IN (4707, 4708, 4709, 4710, 4711) AND status IN ('pending', 'verified');

    UPDATE merchant_application SET registration_email_released_at = NOW()
    WHERE id IN (1019, 1027, 1028, 1029, 1030, 1033, 1032, 1039);
    UPDATE merchant_application SET deleted_at = NOW()
    WHERE id IN (1032, 1039) AND merchant_id = 0 AND deleted_at IS NULL;

    INSERT INTO merchant_activity_log
        (site_id, merchant_id, activity_type, description, performed_by, performed_by_id,
         actor_type, target_account_id, entity_type, entity_id, ip_address)
    SELECT site_id, merchant_id, 'account_change',
           CONCAT('Account ', id, ': duplicate email released and account soft-deleted (user-authorized maintenance 2026-10-13)'),
           'Maintenance', 0, 'system', id, 'account', id, ''
    FROM merchant_admin WHERE id IN (4707, 4708, 4709, 4710, 4711);

    INSERT INTO merchant_verify_timeline
        (site_id, merchant_id, application_id, action, actor_type, operator_id, operator_name, note)
    SELECT site_id, merchant_id, id, 'registration_email_released', 1, 0, 'Maintenance',
           'Duplicate registration email released (user-authorized maintenance 2026-10-13)'
    FROM merchant_application WHERE id IN (1019, 1027, 1028, 1029, 1030, 1033, 1032, 1039);

    -- Same ownership conditions as the email migration guard.
    IF EXISTS (SELECT email_index FROM merchant_admin WHERE email_released_at IS NULL
        AND email_index IS NOT NULL AND email_index <> '' GROUP BY email_index HAVING COUNT(*) > 1)
        OR EXISTS (SELECT registration_email_index FROM merchant_application
        WHERE registration_email_released_at IS NULL AND registration_email_index IS NOT NULL
        AND registration_email_index <> '' GROUP BY registration_email_index HAVING COUNT(*) > 1)
        OR EXISTS (SELECT 1 FROM merchant_application p JOIN merchant_admin a
        ON a.email_index = p.registration_email_index WHERE p.registration_email_released_at IS NULL
        AND a.email_released_at IS NULL AND a.email_index <> ''
        AND (p.merchant_id = 0 OR p.merchant_id <> a.merchant_id OR a.is_owner <> 1 OR a.account_type <> 2)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Part 1: email conflicts remain after fix; rolled back';
    END IF;

    COMMIT;
    SELECT 'Part 1 email: applied' AS result;
END$$
DELIMITER ;

CALL fix_duplicate_merchant_emails_20261013();
DROP PROCEDURE IF EXISTS fix_duplicate_merchant_emails_20261013;

-- ---------------------------------------------------------------- Part 2: phone
DROP PROCEDURE IF EXISTS fix_unindexed_merchant_mobiles_20261013;
DELIMITER $$
CREATE PROCEDURE fix_unindexed_merchant_mobiles_20261013()
fix: BEGIN
    DECLARE v_total INT DEFAULT 0;
    DECLARE v_pending INT DEFAULT 0;
    DECLARE v_conflict_accounts INT DEFAULT 0;
    DECLARE v_conflict_accounts_pending INT DEFAULT 0;
    DECLARE v_conflict_apps INT DEFAULT 0;
    DECLARE v_conflict_apps_pending INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    DROP TEMPORARY TABLE IF EXISTS tmp_fix_mobile_accounts;
    CREATE TEMPORARY TABLE tmp_fix_mobile_accounts (id BIGINT UNSIGNED PRIMARY KEY);
    INSERT INTO tmp_fix_mobile_accounts (id) VALUES
        (4001), (4002), (4003), (4004), (4005), (4006), (4007), (4008), (4009), (4010), (4011), (4012),
        (4013), (4014), (4015), (4016), (4017), (4018), (4019), (4020), (4021), (4022), (4023),
        (4701), (4702), (4703), (4704);

    START TRANSACTION;

    SELECT COUNT(*), COALESCE(SUM(a.mobile_released_at IS NULL AND a.deleted_at IS NULL
            AND (a.mobile_index IS NULL OR a.mobile_index NOT REGEXP '^[a-f0-9]{64}$')), 0)
    INTO v_total, v_pending
    FROM merchant_admin a JOIN tmp_fix_mobile_accounts t ON t.id = a.id
    WHERE a.account_type = 2 AND a.is_owner = 1 AND a.mobile <> ''
        AND a.username = CONCAT('m', a.merchant_id)
    FOR UPDATE;
    SELECT COUNT(*), COALESCE(SUM(mobile_released_at IS NULL), 0)
    INTO v_conflict_accounts, v_conflict_accounts_pending FROM merchant_admin
    WHERE account_type = 2 AND is_owner = 1 AND (id, LEFT(mobile_index, 8)) IN (
        (4710, 'ac401c53'), (4711, 'ac401c53'), (4712, 'ac401c53'), (4713, 'ac401c53'))
    FOR UPDATE;
    SELECT COUNT(*), COALESCE(SUM(registration_phone_released_at IS NULL), 0)
    INTO v_conflict_apps, v_conflict_apps_pending FROM merchant_application
    WHERE (id, LEFT(registration_phone_index, 8)) IN (
        (1020, 'ac401c53'), (1030, 'ac401c53'), (1033, 'ac401c53'), (1034, 'ac401c53'),
        (1036, 'ac401c53'), (1037, 'ac401c53'), (1026, '09580782'), (1021, 'cdade6f9'), (1022, 'cdade6f9'))
    FOR UPDATE;
    IF v_total = 27 AND v_pending = 0 AND v_conflict_accounts = 4 AND v_conflict_accounts_pending = 0
        AND v_conflict_apps = 9 AND v_conflict_apps_pending = 0 AND NOT EXISTS (SELECT 1 FROM merchant_admin a
        JOIN tmp_fix_mobile_accounts t ON t.id = a.id WHERE a.mobile_released_at IS NULL) THEN
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS tmp_fix_mobile_accounts;
        SELECT 'Part 2 phone: already applied, skipped' AS result;
        LEAVE fix;
    END IF;
    IF v_total <> 27 OR v_pending <> 27 OR v_conflict_accounts <> 4 OR v_conflict_accounts_pending <> 4
        OR v_conflict_apps <> 9 OR v_conflict_apps_pending <> 9 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Part 2: rows differ from the confirmed audit; nothing changed';
    END IF;

    UPDATE merchant_admin a JOIN tmp_fix_mobile_accounts t ON t.id = a.id
    SET a.mobile_released_at = NOW(), a.deleted_at = NOW(), a.auth_version = a.auth_version + 1;

    UPDATE merchant_auth_challenge c JOIN tmp_fix_mobile_accounts t ON t.id = c.account_id
    SET c.status = 'expired' WHERE c.status IN ('pending', 'verified');

    INSERT INTO merchant_activity_log
        (site_id, merchant_id, activity_type, description, performed_by, performed_by_id,
         actor_type, target_account_id, entity_type, entity_id, ip_address)
    SELECT a.site_id, a.merchant_id, 'account_change',
           CONCAT('Account ', a.id, ': unindexed test mobile released and account soft-deleted (user-authorized maintenance 2026-10-13)'),
           'Maintenance', 0, 'system', a.id, 'account', a.id, ''
    FROM merchant_admin a JOIN tmp_fix_mobile_accounts t ON t.id = a.id;

    -- Duplicate-phone test accounts: 4710/4711 were soft-deleted by Part 1, keep their original deleted_at.
    UPDATE merchant_admin
    SET mobile_released_at = NOW(), deleted_at = COALESCE(deleted_at, NOW()), auth_version = auth_version + 1
    WHERE id IN (4710, 4711, 4712, 4713);

    UPDATE merchant_auth_challenge SET status = 'expired'
    WHERE account_id IN (4710, 4711, 4712, 4713) AND status IN ('pending', 'verified');

    UPDATE merchant_application SET registration_phone_released_at = NOW()
    WHERE id IN (1020, 1030, 1033, 1034, 1036, 1037, 1026, 1021, 1022);

    INSERT INTO merchant_activity_log
        (site_id, merchant_id, activity_type, description, performed_by, performed_by_id,
         actor_type, target_account_id, entity_type, entity_id, ip_address)
    SELECT site_id, merchant_id, 'account_change',
           CONCAT('Account ', id, ': duplicate mobile released and account soft-deleted (user-authorized maintenance 2026-10-13)'),
           'Maintenance', 0, 'system', id, 'account', id, ''
    FROM merchant_admin WHERE id IN (4710, 4711, 4712, 4713);

    INSERT INTO merchant_verify_timeline
        (site_id, merchant_id, application_id, action, actor_type, operator_id, operator_name, note)
    SELECT site_id, merchant_id, id, 'registration_phone_released', 1, 0, 'Maintenance',
           'Duplicate registration mobile released (user-authorized maintenance 2026-10-13)'
    FROM merchant_application WHERE id IN (1020, 1030, 1033, 1034, 1036, 1037, 1026, 1021, 1022);

    -- Same conditions as both guards of the phone migration.
    IF EXISTS (SELECT 1 FROM merchant_admin WHERE account_type = 2 AND is_owner = 1 AND mobile_released_at IS NULL
        AND mobile <> '' AND (mobile_index IS NULL OR mobile_index NOT REGEXP '^[a-f0-9]{64}$'))
        OR EXISTS (SELECT 1 FROM merchant_application WHERE registration_phone_released_at IS NULL
        AND registration_phone <> '' AND (registration_phone_index IS NULL
        OR registration_phone_index NOT REGEXP '^[a-f0-9]{64}$')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Part 2: other unindexed phones remain; rolled back';
    END IF;
    IF EXISTS (SELECT mobile_index FROM merchant_admin WHERE account_type = 2 AND is_owner = 1 AND mobile_released_at IS NULL
        AND mobile_index IS NOT NULL AND mobile_index <> '' GROUP BY mobile_index HAVING COUNT(*) > 1)
        OR EXISTS (SELECT registration_phone_index FROM merchant_application
        WHERE registration_phone_released_at IS NULL AND registration_phone_index IS NOT NULL
        AND registration_phone_index <> '' GROUP BY registration_phone_index HAVING COUNT(*) > 1)
        OR EXISTS (SELECT 1 FROM merchant_application p JOIN merchant_admin a
        ON a.mobile_index = p.registration_phone_index WHERE p.registration_phone_released_at IS NULL
        AND a.account_type = 2 AND a.is_owner = 1 AND a.mobile_released_at IS NULL AND a.mobile_index <> ''
        AND (p.merchant_id = 0 OR p.merchant_id <> a.merchant_id)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Part 2: phone ownership conflicts remain; rolled back';
    END IF;

    COMMIT;
    DROP TEMPORARY TABLE IF EXISTS tmp_fix_mobile_accounts;
    SELECT 'Part 2 phone: applied' AS result;
END$$
DELIMITER ;

CALL fix_unindexed_merchant_mobiles_20261013();
DROP PROCEDURE IF EXISTS fix_unindexed_merchant_mobiles_20261013;

-- ---------------------------------------------------------------- Result
SELECT id, username, merchant_id, email_released_at, mobile_released_at, deleted_at, auth_version
FROM merchant_admin
WHERE id BETWEEN 4001 AND 4023 OR id BETWEEN 4701 AND 4714
ORDER BY id;
SELECT id, merchant_id, registration_status, registration_email_released_at, registration_phone_released_at, deleted_at
FROM merchant_application
WHERE id IN (1019, 1020, 1021, 1022, 1026, 1027, 1028, 1029, 1030, 1032, 1033, 1034, 1036, 1037, 1038, 1039)
ORDER BY id;
