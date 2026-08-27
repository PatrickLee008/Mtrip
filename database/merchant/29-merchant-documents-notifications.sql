-- M12 S3: additive, replay-safe. Legacy revisions remain unchanged.
SET NAMES utf8mb4;
USE `mtrip_business`;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_verify_document' AND COLUMN_NAME='document_version')=0,
 'ALTER TABLE merchant_verify_document ADD COLUMN document_version INT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_verify_document_revision' AND COLUMN_NAME='lifecycle_version')=0,
 'ALTER TABLE merchant_verify_document_revision ADD COLUMN lifecycle_version INT UNSIGNED NULL, ADD COLUMN file_sha256 CHAR(64) NULL, ADD COLUMN source VARCHAR(30) NOT NULL DEFAULT ''legacy'', ADD COLUMN uploader_id BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD COLUMN expiry_date DATE NULL, ADD COLUMN file_name VARCHAR(100) NOT NULL DEFAULT '''', ADD UNIQUE KEY uk_doc_lifecycle(doc_id,lifecycle_version)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS merchant_document_event (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 site_id BIGINT UNSIGNED NOT NULL,
 merchant_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
 doc_id BIGINT UNSIGNED NOT NULL,
 version INT UNSIGNED NOT NULL,
 action VARCHAR(30) NOT NULL,
 status TINYINT NOT NULL,
 reason VARCHAR(500) NOT NULL DEFAULT '',
 actor_type VARCHAR(20) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
 actor_name VARCHAR(50) NOT NULL DEFAULT '',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_doc_event(doc_id,id), KEY idx_merchant_event(site_id,merchant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_activity_log' AND COLUMN_NAME='actor_type')=0,
 'ALTER TABLE merchant_activity_log ADD COLUMN actor_type VARCHAR(20) NOT NULL DEFAULT ''legacy'', ADD COLUMN target_account_id BIGINT UNSIGNED NULL, ADD COLUMN entity_type VARCHAR(30) NOT NULL DEFAULT '''', ADD COLUMN entity_id BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_notify' AND COLUMN_NAME='request_id')=0,
 'ALTER TABLE merchant_notify ADD COLUMN request_id VARCHAR(64) NULL, ADD COLUMN payload_hash CHAR(64) NULL, ADD COLUMN template_id BIGINT UNSIGNED NULL, ADD COLUMN delivered_at DATETIME NULL, ADD UNIQUE KEY uk_notify_request(merchant_id,request_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS merchant_notify_delivery (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 notify_id BIGINT UNSIGNED NOT NULL,
 channel VARCHAR(20) NOT NULL,
 status VARCHAR(20) NOT NULL,
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 error_code VARCHAR(60) NOT NULL DEFAULT '',
 scheduled_at DATETIME NULL,
 delivered_at DATETIME NULL,
 receipt VARCHAR(255) NOT NULL DEFAULT '',
 UNIQUE KEY uk_notify_channel(notify_id,channel), KEY idx_delivery_due(status,scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_notify_read (
 notify_id BIGINT UNSIGNED NOT NULL,
 account_id BIGINT UNSIGNED NOT NULL,
 read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(notify_id,account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
-- Preserve only the reader explicitly recorded by the legacy schema, never mark all accounts read.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_notify' AND COLUMN_NAME IN ('read_at','read_by'))=2,
 'INSERT IGNORE INTO merchant_notify_read(notify_id,account_id,read_at) SELECT id,read_by,read_at FROM merchant_notify WHERE read_at IS NOT NULL AND read_by>0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- Do not fabricate provider receipts or change historical message statuses.
USE mtrip_system;
INSERT IGNORE INTO sys_menu(id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(30201,302,'替换证件','Replace Document','merchant:document:replace',3,1),
(30202,302,'审核证件','Review Document','merchant:document:verify',3,2),
(30203,302,'下载证件','Download Document','merchant:document:download',3,3),
(30501,305,'导出活动','Export Activities','merchant:activity:export',3,1);
-- Existing role grants are intentionally not changed.
