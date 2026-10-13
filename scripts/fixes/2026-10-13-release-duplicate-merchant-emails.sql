-- One-off data fix (test server, 2026-10-13): unblock V20261012130100__enforce-merchant-email-uniqueness.
-- User-confirmed: release all three duplicated emails; soft-delete the five accounts. Merchant/property data untouched.
--   87af...  accounts 4707(m7005) 4708(m7006)            applications 1019 1027 1028
--   54b5...  accounts 4709(m7007) 4710(m7008) 4711(m7009) applications 1029 1030 1033
--   97ba...  no account                                    draft applications 1032 1039 (also soft-deleted)
-- Exact ids + hashes are verified first; any drift rolls back without changes. Not a migration: never move into database/.
SET NAMES utf8mb4;
USE `mtrip_business`;

DROP PROCEDURE IF EXISTS fix_duplicate_merchant_emails_20261013;
DELIMITER $$
CREATE PROCEDURE fix_duplicate_merchant_emails_20261013()
BEGIN
    DECLARE v_accounts INT DEFAULT 0;
    DECLARE v_applications INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

    START TRANSACTION;

    SELECT COUNT(*) INTO v_accounts FROM merchant_admin
    WHERE email_released_at IS NULL AND deleted_at IS NULL AND (id, email_index) IN (
        (4707, '87afbcddac87fed0af427568d0c9259ffdc19a8407162055a8b93c72e22693ea'),
        (4708, '87afbcddac87fed0af427568d0c9259ffdc19a8407162055a8b93c72e22693ea'),
        (4709, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'),
        (4710, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'),
        (4711, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'))
    FOR UPDATE;
    SELECT COUNT(*) INTO v_applications FROM merchant_application
    WHERE registration_email_released_at IS NULL AND (id, registration_email_index) IN (
        (1019, '87afbcddac87fed0af427568d0c9259ffdc19a8407162055a8b93c72e22693ea'),
        (1027, '87afbcddac87fed0af427568d0c9259ffdc19a8407162055a8b93c72e22693ea'),
        (1028, '87afbcddac87fed0af427568d0c9259ffdc19a8407162055a8b93c72e22693ea'),
        (1029, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'),
        (1030, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'),
        (1033, '54b5987ff63e3524e18d2d351054b6f34c55928363711ff78f3ef3c97640b5db'),
        (1032, '97ba5d0e1e92b4643cb4b7f0ec7ba2648de99d2d67eb3aaa01d33d22a00abb5a'),
        (1039, '97ba5d0e1e92b4643cb4b7f0ec7ba2648de99d2d67eb3aaa01d33d22a00abb5a'))
    FOR UPDATE;
    IF v_accounts <> 5 OR v_applications <> 8 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rows differ from the confirmed audit; nothing changed';
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

    -- Same ownership conditions as the migration guard: must be clean before commit.
    IF EXISTS (SELECT email_index FROM merchant_admin WHERE email_released_at IS NULL
        AND email_index IS NOT NULL AND email_index <> '' GROUP BY email_index HAVING COUNT(*) > 1)
        OR EXISTS (SELECT registration_email_index FROM merchant_application
        WHERE registration_email_released_at IS NULL AND registration_email_index IS NOT NULL
        AND registration_email_index <> '' GROUP BY registration_email_index HAVING COUNT(*) > 1)
        OR EXISTS (SELECT 1 FROM merchant_application p JOIN merchant_admin a
        ON a.email_index = p.registration_email_index WHERE p.registration_email_released_at IS NULL
        AND a.email_released_at IS NULL AND a.email_index <> ''
        AND (p.merchant_id = 0 OR p.merchant_id <> a.merchant_id OR a.is_owner <> 1 OR a.account_type <> 2)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email conflicts remain after fix; rolled back';
    END IF;

    COMMIT;
END$$
DELIMITER ;

CALL fix_duplicate_merchant_emails_20261013();
DROP PROCEDURE IF EXISTS fix_duplicate_merchant_emails_20261013;

SELECT id, username, merchant_id, email_released_at, deleted_at, auth_version
FROM merchant_admin WHERE id IN (4707, 4708, 4709, 4710, 4711);
SELECT id, merchant_id, registration_status, registration_email_released_at, deleted_at
FROM merchant_application WHERE id IN (1019, 1027, 1028, 1029, 1030, 1033, 1032, 1039);
