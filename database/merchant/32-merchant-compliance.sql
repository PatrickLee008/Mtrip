SET NAMES utf8mb4;
USE `mtrip_business`;
-- S6: preserve legacy originals. Draft changes never overwrite published snapshots.
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='platform_rule' AND COLUMN_NAME='version')=0, 'ALTER TABLE platform_rule ADD version BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD body TEXT NULL, ADD exceptions_json JSON NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS platform_rule_revision (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 rule_id BIGINT UNSIGNED NOT NULL,
 site_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
 version BIGINT UNSIGNED NOT NULL,
 action VARCHAR(20) NOT NULL,
 snapshot_json JSON NOT NULL,
 effective_at DATETIME NULL,
 note VARCHAR(500) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 actor_name VARCHAR(50) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uk_rule_version (rule_id,version),
 KEY idx_effective (rule_id,effective_at,version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_violation' AND COLUMN_NAME='rule_revision_id')=0, 'ALTER TABLE merchant_violation ADD rule_revision_id BIGINT UNSIGNED NULL, ADD category_code VARCHAR(30) NOT NULL DEFAULT '''', ADD details TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_warning' AND COLUMN_NAME='violation_id')=0, 'ALTER TABLE merchant_warning ADD violation_id BIGINT UNSIGNED NULL, ADD rule_revision_id BIGINT UNSIGNED NULL, ADD category_code VARCHAR(30) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='compliance_history' AND COLUMN_NAME='request_id')=0, 'ALTER TABLE compliance_history ADD violation_id BIGINT UNSIGNED NULL, ADD warning_id BIGINT UNSIGNED NULL, ADD rule_revision_id BIGINT UNSIGNED NULL, ADD category_code VARCHAR(30) NOT NULL DEFAULT '''', ADD action VARCHAR(30) NOT NULL DEFAULT '''', ADD note VARCHAR(500) NOT NULL DEFAULT '''', ADD case_version BIGINT UNSIGNED NULL, ADD case_status TINYINT NULL, ADD actor_id BIGINT UNSIGNED NULL, ADD actor_type VARCHAR(20) NOT NULL DEFAULT ''legacy'', ADD ip_address VARCHAR(45) NOT NULL DEFAULT '''', ADD request_id VARCHAR(80) NULL, ADD request_hash CHAR(64) NULL, ADD result_json JSON NULL, ADD merchant_status_history_id BIGINT UNSIGNED NULL, ADD UNIQUE KEY uk_compliance_request (merchant_id,actor_id,request_id), ADD UNIQUE KEY uk_case_version (violation_id,case_version), ADD KEY idx_warning (warning_id,action), ADD KEY idx_category (site_id,category_code,id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
USE `mtrip_system`;
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort)
VALUES (70202,702,'登记违规','Record violation','platform:violation:record',3,2);
-- Do not grant new permissions to existing roles automatically.
