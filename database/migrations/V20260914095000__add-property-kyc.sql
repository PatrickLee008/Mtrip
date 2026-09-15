SET NAMES utf8mb4;
USE mtrip_business;

-- Property KYC is independent from merchant onboarding KYC. All changes are additive.
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='kyc_status')=0,
  'ALTER TABLE merchant_store ADD COLUMN kyc_status TINYINT NOT NULL DEFAULT 0 COMMENT ''0 draft,1 approved,2 pending review,3 under review,4 rejected,5 resubmit required''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='kyc_template_id')=0,
  'ALTER TABLE merchant_store ADD COLUMN kyc_template_id BIGINT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='kyc_version')=0,
  'ALTER TABLE merchant_store ADD COLUMN kyc_version INT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='kyc_submitted_at')=0,
  'ALTER TABLE merchant_store ADD COLUMN kyc_submitted_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='kyc_approved_at')=0,
  'ALTER TABLE merchant_store ADD COLUMN kyc_approved_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='kyc_reject_reason')=0,
  'ALTER TABLE merchant_store ADD COLUMN kyc_reject_reason VARCHAR(500) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND INDEX_NAME='idx_property_kyc')=0,
  'ALTER TABLE merchant_store ADD INDEX idx_property_kyc (site_id,merchant_id,business_type,kyc_status)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_kyc_template' AND COLUMN_NAME='scope_type')=0,
  'ALTER TABLE merchant_kyc_template ADD COLUMN scope_type VARCHAR(20) NOT NULL DEFAULT ''merchant'' AFTER site_id, ADD INDEX idx_scope_business (scope_type,business_type,status)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO merchant_kyc_template (site_id, scope_type, name, business_type, docs, status, sort)
SELECT 0, 'property', 'Hotel Property KYC', 'hotel',
  '[{"name":"Business Registration","doc_type":"business_reg","required":true},{"name":"Hotel Operating License","doc_type":"hotel_license","required":true},{"name":"Owner ID / Passport","doc_type":"id_doc","required":true}]',
  1, 1
WHERE NOT EXISTS (
  SELECT 1 FROM merchant_kyc_template
  WHERE site_id=0 AND scope_type='property' AND business_type='hotel' AND status=1
);

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_verify_document' AND COLUMN_NAME='scope_type')=0,
  'ALTER TABLE merchant_verify_document ADD COLUMN scope_type VARCHAR(20) NOT NULL DEFAULT ''merchant'' AFTER merchant_id', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_verify_document' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE merchant_verify_document ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER scope_type', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_verify_document' AND INDEX_NAME='idx_property_document')=0,
  'ALTER TABLE merchant_verify_document ADD INDEX idx_property_document (site_id,property_id,status)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_verify_document_revision' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE merchant_verify_document_revision ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER merchant_id, ADD INDEX idx_property_revision (property_id,id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_document_event' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE merchant_document_event ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER merchant_id, ADD INDEX idx_property_event (property_id,id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS merchant_property_kyc_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT UNSIGNED NOT NULL,
  merchant_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  kyc_version INT UNSIGNED NOT NULL,
  action VARCHAR(30) NOT NULL,
  from_status TINYINT NOT NULL,
  to_status TINYINT NOT NULL,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  actor_type VARCHAR(20) NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  actor_name VARCHAR(50) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_property_kyc_event (site_id,property_id,id),
  KEY idx_merchant_kyc_event (site_id,merchant_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT IGNORE INTO merchant_menu
  (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort,account_scope)
VALUES
  (140001,1400,'新增物业','Add Property','mch:properties:add',3,1,'1,2'),
  (140002,1400,'上传物业KYC','Upload Property KYC','mch:properties:kyc-upload',3,2,'1,2'),
  (140003,1400,'提交物业KYC','Submit Property KYC','mch:properties:kyc-submit',3,3,'1,2');

INSERT IGNORE INTO merchant_role_menu (role_id,menu_id)
SELECT rm.role_id, p.menu_id
FROM merchant_role_menu rm
JOIN (SELECT 140001 AS menu_id UNION ALL SELECT 140002 UNION ALL SELECT 140003) p
WHERE rm.menu_id=1400;
