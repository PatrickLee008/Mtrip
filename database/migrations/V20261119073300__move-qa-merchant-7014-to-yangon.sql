SET NAMES utf8mb4;
USE `mtrip_business`;

-- Exact QA repair: merchant 7014 / application 1041 / property 7522, site 1 -> 7.
-- Run during a merchant write maintenance window via scripts/db-migrate.sh.
-- SET @qa_7014_preview=1 before SOURCE to validate and report without business writes.
-- Backups are committed atomically with the repair; failures roll both back.
CREATE TABLE IF NOT EXISTS migration_merchant_site_backup (
    migration_version CHAR(14) NOT NULL,
    table_name VARCHAR(64) NOT NULL,
    row_id BIGINT UNSIGNED NOT NULL,
    source_site_id BIGINT UNSIGNED NOT NULL,
    target_site_id BIGINT UNSIGNED NOT NULL,
    row_json JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (migration_version,table_name,row_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
COMMENT='Immutable before-images for narrowly scoped merchant site repairs';

DROP PROCEDURE IF EXISTS migrate_qa_merchant_7014;
DELIMITER //
CREATE PROCEDURE migrate_qa_merchant_7014()
qa_move: BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE current_site BIGINT;
    DECLARE table_to_move VARCHAR(64);
    DECLARE row_filter TEXT;
    DECLARE reviewed_filter TEXT;
    DECLARE row_json_expression LONGTEXT;
    DECLARE error_text VARCHAR(128);
    DECLARE update_timestamp VARCHAR(64);
    DECLARE plan_cursor CURSOR FOR SELECT table_name,predicate_sql FROM qa_7014_plan ORDER BY sequence_id;
    DECLARE dependency_cursor CURSOR FOR
        SELECT c.TABLE_NAME,GROUP_CONCAT(CASE
            WHEN c.COLUMN_NAME='merchant_id' THEN '`merchant_id`=7014'
            WHEN c.COLUMN_NAME='property_id' THEN '`property_id`=7522'
            WHEN c.COLUMN_NAME='room_type_id' THEN '`room_type_id`=7021'
            WHEN c.COLUMN_NAME='store_id' AND c.TABLE_NAME LIKE 'merchant\_%' THEN '`store_id`=7522'
            WHEN c.COLUMN_NAME='application_id' AND c.TABLE_NAME LIKE 'merchant\_%' THEN '`application_id`=1041'
            WHEN c.COLUMN_NAME='application_business_id' AND c.TABLE_NAME LIKE 'merchant\_%' THEN '`application_business_id`=2080'
            WHEN c.COLUMN_NAME IN ('account_id','admin_id','target_account_id') AND (c.TABLE_NAME LIKE 'merchant\_%' OR c.TABLE_NAME LIKE 'chat\_%')
                THEN CONCAT('`',c.COLUMN_NAME,'`=4716')
            WHEN c.COLUMN_NAME='recipient_id' AND c.TABLE_NAME='merchant_notify' THEN '`recipient_id`=4716'
            ELSE NULL END SEPARATOR ' OR ')
        FROM information_schema.COLUMNS c
        JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME AND t.TABLE_TYPE='BASE TABLE'
        WHERE c.TABLE_SCHEMA=DATABASE()
        GROUP BY c.TABLE_NAME HAVING COUNT(CASE
            WHEN c.COLUMN_NAME IN ('merchant_id','property_id','room_type_id') THEN 1
            WHEN c.COLUMN_NAME IN ('store_id','application_id','application_business_id','account_id','admin_id','target_account_id') AND c.TABLE_NAME LIKE 'merchant\_%' THEN 1
            WHEN c.COLUMN_NAME='admin_id' AND c.TABLE_NAME LIKE 'chat\_%' THEN 1
            ELSE NULL END)>0;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done=1;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET SESSION group_concat_max_len=1000000;
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    START TRANSACTION;
    IF NOT EXISTS (SELECT 1 FROM merchant_info WHERE id=7014) THEN
        IF EXISTS (SELECT 1 FROM merchant_store WHERE merchant_id=7014)
            OR EXISTS (SELECT 1 FROM merchant_application WHERE merchant_id=7014) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: orphaned target chain; review before repairing';
        END IF;
        COMMIT;
        SELECT 'QA7014: target absent; no business data changed' AS result;
        LEAVE qa_move;
    END IF;

    SELECT site_id INTO current_site FROM merchant_info WHERE id=7014 FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='migration_merchant_site_backup' AND ENGINE='InnoDB') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: backup table must use InnoDB';
    END IF;
    -- A successful replay must remain harmless after normal merchant activity.
    IF current_site=7 AND EXISTS (SELECT 1 FROM migration_merchant_site_backup
        WHERE migration_version='20261119073300' AND table_name='merchant_info' AND row_id=7014) THEN
        IF NOT EXISTS (SELECT 1 FROM merchant_application WHERE id=1041 AND merchant_id=7014 AND site_id=7)
            OR NOT EXISTS (SELECT 1 FROM merchant_application_business WHERE id=2080 AND application_id=1041 AND site_id=7)
            OR NOT EXISTS (SELECT 1 FROM merchant_store WHERE id=7522 AND merchant_id=7014 AND site_id=7)
            OR NOT EXISTS (SELECT 1 FROM merchant_admin WHERE id=4716 AND merchant_id=7014 AND site_id=7)
            OR NOT EXISTS (SELECT 1 FROM hotel_room_type WHERE id=7021 AND property_id=7522 AND site_id=7) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: completed repair core chain has inconsistent ownership';
        END IF;
        COMMIT;
        SELECT 'QA7014: already migrated; no business data changed' AS result;
        LEAVE qa_move;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM merchant_info WHERE id=7014 AND merchant_code='MCH-0010'
        AND merchant_name='Testing Hotel' AND group_id=0 AND status=3 AND deleted_at IS NULL)
        OR NOT EXISTS (SELECT 1 FROM merchant_application WHERE id=1041 AND merchant_id=7014
            AND app_no='APP-2026-B7998A92D6' AND deleted_at IS NULL)
        OR NOT EXISTS (SELECT 1 FROM merchant_application_business WHERE id=2080 AND application_id=1041 AND business_type='hotel')
        OR NOT EXISTS (SELECT 1 FROM merchant_store WHERE id=7522 AND merchant_id=7014 AND source_business_id=2080
            AND store_name='Test Hotel' AND country_code='MM' AND city_key='yangon' AND deleted_at IS NULL)
        OR NOT EXISTS (SELECT 1 FROM merchant_admin WHERE id=4716 AND merchant_id=7014 AND username='m007014'
            AND account_type=2 AND is_owner=1 AND group_id=0 AND deleted_at IS NULL)
        OR NOT EXISTS (SELECT 1 FROM hotel_room_type WHERE id=7021 AND property_id=7522 AND deleted_at IS NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: identity anchors differ; refusing to guess the target';
    END IF;
    IF current_site NOT IN (1,7) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: unexpected source site';
    END IF;
    IF EXISTS (SELECT 1 FROM merchant_store WHERE merchant_id=7014 AND id<>7522)
        OR EXISTS (SELECT 1 FROM merchant_application WHERE merchant_id=7014 AND id<>1041)
        OR EXISTS (SELECT 1 FROM merchant_application_business WHERE application_id=1041 AND id<>2080)
        OR EXISTS (SELECT 1 FROM merchant_admin WHERE merchant_id=7014 AND id<>4716)
        OR EXISTS (SELECT 1 FROM hotel_room_type WHERE property_id=7522 AND id<>7021) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: target gained additional accounts/applications/properties/rooms';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM `mtrip_system`.sys_site WHERE id=7 AND status=1 AND country_code='MM' AND deleted_at IS NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: target site 7 is unavailable';
    END IF;
    IF current_site=7 AND NOT EXISTS (SELECT 1 FROM migration_merchant_site_backup
        WHERE migration_version='20261119073300' AND table_name='merchant_info' AND row_id=7014) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: site already changed without this repair backup';
    END IF;

    DROP TEMPORARY TABLE IF EXISTS qa_7014_plan;
    DROP TEMPORARY TABLE IF EXISTS qa_7014_rows;
    CREATE TEMPORARY TABLE qa_7014_plan (
        sequence_id INT AUTO_INCREMENT PRIMARY KEY,
        table_name VARCHAR(64) NOT NULL UNIQUE,
        predicate_sql TEXT NOT NULL,
        row_count BIGINT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB;
    CREATE TEMPORARY TABLE qa_7014_rows (
        table_name VARCHAR(64) NOT NULL, row_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY(table_name,row_id)
    ) ENGINE=InnoDB;
    INSERT INTO qa_7014_plan(table_name,predicate_sql) VALUES
        ('merchant_info','id=7014'),
        ('merchant_application','merchant_id=7014'),
        ('merchant_application_business','application_id=1041'),
        ('merchant_store','merchant_id=7014'),
        ('merchant_admin','merchant_id=7014'),
        ('merchant_application_note','application_id=1041'),
        ('merchant_application_signature','application_id=1041'),
        ('merchant_verify_document','merchant_id=7014 OR application_id=1041 OR application_business_id=2080 OR property_id=7522'),
        ('merchant_verify_document_revision','doc_id IN (SELECT id FROM merchant_verify_document WHERE merchant_id=7014 OR application_id=1041 OR application_business_id=2080 OR property_id=7522)'),
        ('merchant_verify_timeline','merchant_id=7014 OR application_id=1041'),
        ('merchant_document_event','merchant_id=7014 OR property_id=7522 OR doc_id IN (SELECT id FROM merchant_verify_document WHERE merchant_id=7014 OR application_id=1041 OR application_business_id=2080 OR property_id=7522)'),
        ('merchant_property_kyc_event','merchant_id=7014 OR property_id=7522'),
        ('merchant_property_content_revision','merchant_id=7014 OR property_id=7522'),
        ('merchant_property_history','merchant_id=7014 OR store_id=7522'),
        ('merchant_access_code_log','merchant_id=7014'),
        ('merchant_activity_log','merchant_id=7014 OR target_account_id=4716'),
        ('merchant_account','merchant_id=7014'),
        ('merchant_module_grant','merchant_id=7014'),
        ('merchant_role','merchant_id=7014 AND is_builtin=0'),
        ('merchant_employee_property','admin_id=4716 OR property_id=7522'),
        ('merchant_contact_identity_history','account_id=4716'),
        ('merchant_credential_delivery','merchant_id=7014 OR application_id=1041 OR account_id=4716'),
        ('merchant_auth_challenge','account_id=4716'),
        ('merchant_impersonation_session','merchant_id=7014 OR target_account_id=4716'),
        ('merchant_notify','merchant_id=7014 OR property_id=7522 OR recipient_id=4716'),
        ('merchant_commercial_config','merchant_id=7014'),
        ('merchant_pay_at_hotel_terms','merchant_id=7014'),
        ('merchant_kyc_template','application_business_id=2080'),
        ('hotel_room_type','property_id=7522'),
        ('hotel_room_type_revision','property_id=7522 OR merchant_id=7014'),
        ('hotel_room_media','property_id=7522'),
        ('goods_daily_stock','property_id=7522'),
        ('goods_refund_rule','property_id=7522');

    -- Discover dependencies outside the reviewed manifest, including orders,
    -- finance, support, customer favorites/reviews, legacy goods and ranking rows.
    -- Role links are site-less; their referenced role scope is checked separately.
    SET done=0;
    OPEN dependency_cursor;
    dependencies: LOOP
        FETCH dependency_cursor INTO table_to_move,row_filter;
        IF done=1 THEN LEAVE dependencies; END IF;
        IF EXISTS (SELECT 1 FROM qa_7014_plan WHERE table_name=table_to_move) THEN
            SELECT predicate_sql INTO reviewed_filter FROM qa_7014_plan WHERE table_name=table_to_move;
            SET @qa_7014_sql=CONCAT('SELECT COUNT(*) INTO @qa_7014_count FROM `',REPLACE(table_to_move,'`','``'),'` WHERE (',row_filter,') AND NOT (',reviewed_filter,') FOR UPDATE');
            PREPARE qa_stmt FROM @qa_7014_sql; EXECUTE qa_stmt; DEALLOCATE PREPARE qa_stmt;
            IF @qa_7014_count>0 THEN
                SET error_text=CONCAT('QA7014: uncovered ownership in ',table_to_move);
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT=error_text;
            END IF;
        ELSEIF table_to_move NOT IN ('merchant_admin_role') THEN
            SET @qa_7014_sql=CONCAT('SELECT COUNT(*) INTO @qa_7014_count FROM `',REPLACE(table_to_move,'`','``'),'` WHERE ',row_filter,' FOR UPDATE');
            PREPARE qa_stmt FROM @qa_7014_sql; EXECUTE qa_stmt; DEALLOCATE PREPARE qa_stmt;
            IF @qa_7014_count>0 THEN
                SET error_text=CONCAT('QA7014: unreviewed dependency in ',table_to_move);
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT=error_text;
            END IF;
        END IF;
    END LOOP;
    CLOSE dependency_cursor;

    IF EXISTS (SELECT 1 FROM merchant_admin_role ar JOIN merchant_role r ON r.id=ar.role_id
        WHERE ar.admin_id=4716 AND (r.group_id<>0 OR r.merchant_id NOT IN (0,7014)
            OR (NOT (r.merchant_id=7014 AND r.is_builtin=0) AND r.site_id NOT IN (0,7))))
        OR EXISTS (SELECT 1 FROM merchant_admin_role ar JOIN merchant_role r ON r.id=ar.role_id
            WHERE r.merchant_id=7014 AND ar.admin_id<>4716)
        OR EXISTS (SELECT 1 FROM merchant_admin_role ar LEFT JOIN merchant_role r ON r.id=ar.role_id WHERE ar.admin_id=4716 AND r.id IS NULL)
        OR EXISTS (SELECT 1 FROM merchant_employee_property WHERE (admin_id=4716 OR property_id=7522) AND (admin_id<>4716 OR property_id<>7522)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: shared/foreign account or role assignment needs review';
    END IF;
    IF EXISTS (SELECT 1 FROM merchant_kyc_template t WHERE
        (t.id IN (SELECT kyc_template_id FROM merchant_application WHERE id=1041)
          OR t.id IN (SELECT kyc_template_id FROM merchant_application_business WHERE id=2080)
          OR t.id IN (SELECT kyc_template_id FROM merchant_store WHERE id=7522)
          OR t.id IN (SELECT source_template_id FROM merchant_kyc_template WHERE application_business_id=2080))
        AND t.application_business_id<>2080 AND t.site_id NOT IN (0,7))
        OR EXISTS (SELECT 1 FROM merchant_application_signature s LEFT JOIN merchant_onboarding_agreement a ON a.id=s.agreement_id
            WHERE s.application_id=1041 AND (a.id IS NULL OR a.site_id NOT IN (0,7))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: site-specific shared KYC template or signed agreement needs review';
    END IF;
    IF EXISTS (SELECT 1 FROM merchant_application a LEFT JOIN merchant_kyc_template t ON t.id=a.kyc_template_id WHERE a.id=1041 AND a.kyc_template_id>0 AND t.id IS NULL)
        OR EXISTS (SELECT 1 FROM merchant_application_business b LEFT JOIN merchant_kyc_template t ON t.id=b.kyc_template_id WHERE b.id=2080 AND b.kyc_template_id>0 AND t.id IS NULL)
        OR EXISTS (SELECT 1 FROM merchant_store s LEFT JOIN merchant_kyc_template t ON t.id=s.kyc_template_id WHERE s.id=7522 AND s.kyc_template_id>0 AND t.id IS NULL)
        OR EXISTS (SELECT 1 FROM merchant_kyc_template p LEFT JOIN merchant_kyc_template t ON t.id=p.source_template_id WHERE p.application_business_id=2080 AND p.source_template_id>0 AND t.id IS NULL) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: missing referenced KYC template';
    END IF;
    IF EXISTS (SELECT 1 FROM merchant_credential_delivery WHERE (merchant_id=7014 OR application_id=1041 OR account_id=4716)
            AND status NOT IN ('accepted','delivered'))
        OR EXISTS (SELECT 1 FROM goods_daily_stock WHERE property_id=7522 AND (stock_sold>0 OR stock_locked>0)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: pending credential delivery or sold/locked inventory needs review';
    END IF;
    IF EXISTS (SELECT 1 FROM ranking_market m JOIN JSON_TABLE(COALESCE(m.published_json,JSON_ARRAY()),'$[*]'
            COLUMNS(property_id BIGINT PATH '$.property_id')) j ON j.property_id=7522)
        OR EXISTS (SELECT 1 FROM marketing_coupon WHERE JSON_CONTAINS(COALESCE(property_ids,JSON_ARRAY()),'7522')
            OR JSON_CONTAINS(COALESCE(room_type_ids,JSON_ARRAY()),'7021')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: shared published ranking or promotion snapshot needs review';
    END IF;
    IF EXISTS (SELECT 1 FROM order_main WHERE order_type=1 AND sku_id=7021)
        OR EXISTS (SELECT 1 FROM merchant_support_request WHERE actor_type='merchant' AND actor_id=4716)
        OR EXISTS (SELECT 1 FROM goods_daily_stock WHERE sku_type=1 AND sku_id=7021 AND property_id<>7522)
        OR EXISTS (SELECT 1 FROM goods_refund_rule WHERE sku_type=1 AND sku_id=7021 AND property_id<>7522) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: indirect order or support dependency needs review';
    END IF;
    IF EXISTS (SELECT 1 FROM merchant_verify_document WHERE (application_id=1041 OR application_business_id=2080 OR property_id=7522 OR merchant_id=7014)
        AND (merchant_id NOT IN (0,7014) OR application_id NOT IN (0,1041) OR application_business_id NOT IN (0,2080) OR property_id NOT IN (0,7522))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: cross-merchant document reference';
    END IF;

    SET done=0;
    OPEN plan_cursor;
    inventory: LOOP
        FETCH plan_cursor INTO table_to_move,row_filter;
        IF done=1 THEN LEAVE inventory; END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
                AND TABLE_NAME=table_to_move AND ENGINE='InnoDB')
            OR (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
                AND TABLE_NAME=table_to_move AND COLUMN_NAME IN ('id','site_id'))<>2 THEN
            SET error_text=CONCAT('QA7014: missing transactional schema for ',table_to_move);
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT=error_text;
        END IF;
        SET @qa_7014_sql=CONCAT('INSERT INTO qa_7014_rows SELECT ',QUOTE(table_to_move),',id FROM `',table_to_move,'` WHERE ',row_filter,' FOR UPDATE');
        PREPARE qa_stmt FROM @qa_7014_sql; EXECUTE qa_stmt; DEALLOCATE PREPARE qa_stmt;
        UPDATE qa_7014_plan SET row_count=(SELECT COUNT(*) FROM qa_7014_rows WHERE table_name=table_to_move) WHERE table_name=table_to_move;
        SET @qa_7014_sql=CONCAT('SELECT COUNT(*) INTO @qa_7014_count FROM `',table_to_move,'` t JOIN qa_7014_rows r ON r.table_name=',QUOTE(table_to_move),' AND r.row_id=t.id WHERE t.site_id<>',current_site);
        PREPARE qa_stmt FROM @qa_7014_sql; EXECUTE qa_stmt; DEALLOCATE PREPARE qa_stmt;
        IF @qa_7014_count>0 THEN
            SET error_text=CONCAT('QA7014: mixed site ownership in ',table_to_move);
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT=error_text;
        END IF;
        IF current_site=1 AND COALESCE(@qa_7014_preview,0)<>1 THEN
            SELECT GROUP_CONCAT(CONCAT(QUOTE(COLUMN_NAME),',',CASE
                WHEN DATA_TYPE IN ('binary','varbinary','blob','tinyblob','mediumblob','longblob') THEN CONCAT('HEX(t.`',COLUMN_NAME,'`)')
                ELSE CONCAT('t.`',COLUMN_NAME,'`') END) ORDER BY ORDINAL_POSITION SEPARATOR ',')
                INTO row_json_expression FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=table_to_move;
            SET @qa_7014_sql=CONCAT('INSERT INTO migration_merchant_site_backup(migration_version,table_name,row_id,source_site_id,target_site_id,row_json) SELECT ''20261119073300'',',QUOTE(table_to_move),',t.id,1,7,JSON_OBJECT(',row_json_expression,') FROM `',table_to_move,'` t JOIN qa_7014_rows r ON r.table_name=',QUOTE(table_to_move),' AND r.row_id=t.id');
            PREPARE qa_stmt FROM @qa_7014_sql; EXECUTE qa_stmt; DEALLOCATE PREPARE qa_stmt;
        END IF;
    END LOOP;
    CLOSE plan_cursor;
    SELECT table_name,row_count FROM qa_7014_plan ORDER BY sequence_id;
    IF current_site=7 THEN
        COMMIT;
        SELECT 'QA7014: already migrated; no business data changed' AS result;
        LEAVE qa_move;
    END IF;
    IF COALESCE(@qa_7014_preview,0)=1 THEN
        ROLLBACK;
        SELECT 'QA7014: preview passed; no business data changed' AS result;
        LEAVE qa_move;
    END IF;

    SET done=0;
    OPEN plan_cursor;
    move_rows: LOOP
        FETCH plan_cursor INTO table_to_move,row_filter;
        IF done=1 THEN LEAVE move_rows; END IF;
        SET update_timestamp=IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=table_to_move AND COLUMN_NAME='updated_at'),',t.updated_at=t.updated_at','');
        SET @qa_7014_sql=CONCAT('UPDATE `',table_to_move,'` t JOIN qa_7014_rows r ON r.table_name=',QUOTE(table_to_move),' AND r.row_id=t.id SET t.site_id=7',update_timestamp,' WHERE t.site_id=1');
        PREPARE qa_stmt FROM @qa_7014_sql; EXECUTE qa_stmt; DEALLOCATE PREPARE qa_stmt;
        SET @qa_7014_sql=CONCAT('SELECT COUNT(*) INTO @qa_7014_count FROM `',table_to_move,'` WHERE (',row_filter,') AND site_id<>7');
        PREPARE qa_stmt FROM @qa_7014_sql; EXECUTE qa_stmt; DEALLOCATE PREPARE qa_stmt;
        IF @qa_7014_count>0 THEN
            SET error_text=CONCAT('QA7014: post-move scope verification failed for ',table_to_move);
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT=error_text;
        END IF;
    END LOOP;
    CLOSE plan_cursor;

    -- Keep passwords and the enrolled authenticator; revoke the old scope/session.
    UPDATE merchant_admin SET auth_version=auth_version+1,challenge_hash=NULL,
        challenge_expires_at=NULL,pending_secret_enc='',updated_at=updated_at WHERE id=4716;
    UPDATE merchant_auth_challenge SET status='expired',expires_at=LEAST(expires_at,NOW()),updated_at=updated_at
        WHERE account_id=4716 AND status NOT IN ('consumed','expired');
    UPDATE merchant_impersonation_session SET status=2,ended_at=COALESCE(ended_at,NOW()),
        exchange_hash=NULL,exchange_expires_at=NULL WHERE (merchant_id=7014 OR target_account_id=4716) AND status=1;

    IF NOT EXISTS (SELECT 1 FROM merchant_store s JOIN merchant_info m ON m.id=s.merchant_id AND m.site_id=s.site_id
        WHERE s.id=7522 AND s.site_id=7 AND m.status=3 AND s.status=1 AND s.kyc_status=1
            AND s.content_status=2 AND s.content_approved_version>0 AND s.publish_status=1
            AND s.operating_status=1 AND s.display_enabled=1
            AND EXISTS (SELECT 1 FROM hotel_room_type r WHERE r.property_id=s.id AND r.site_id=7
                AND r.status=1 AND r.publish_status=2 AND r.approved_version>0 AND r.deleted_at IS NULL)) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA7014: target property is not consumer-visible after repair';
    END IF;
    INSERT INTO merchant_activity_log(site_id,merchant_id,activity_type,description,performed_by,performed_by_id,ip_address,status,actor_type,entity_type,entity_id)
        VALUES(7,7014,'site_migration','Migration 20261119073300: QA merchant 7014 / property 7522 moved from site 1 to 7',
            'database migration',0,'',1,'system','merchant',7014);
    COMMIT;
    SELECT 'QA7014: migrated to site 7; merchant must sign in again' AS result;
END//
DELIMITER ;
CALL migrate_qa_merchant_7014();
DROP PROCEDURE migrate_qa_merchant_7014;
