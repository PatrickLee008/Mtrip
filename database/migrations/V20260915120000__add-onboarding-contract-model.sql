SET NAMES utf8mb4;
USE `mtrip_business`;

-- Stage 1 only adds the target data model and deterministic legacy markers.
-- Runtime behavior remains on the existing fields until later stages switch it.

SET @duplicate_access_codes := (
  SELECT COUNT(*)
  FROM (
    SELECT UPPER(access_code)
    FROM merchant_info
    WHERE access_code <> ''
    GROUP BY UPPER(access_code)
    HAVING COUNT(*) > 1
  ) duplicates
);

DROP PROCEDURE IF EXISTS assert_onboarding_contract_preflight;
DELIMITER $$
CREATE PROCEDURE assert_onboarding_contract_preflight()
BEGIN
  IF @duplicate_access_codes > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Onboarding contract migration blocked: duplicate case-insensitive merchant access codes';
  END IF;
END$$
DELIMITER ;
CALL assert_onboarding_contract_preflight();
DROP PROCEDURE IF EXISTS assert_onboarding_contract_preflight;

DROP PROCEDURE IF EXISTS add_onboarding_column;
DELIMITER $$
CREATE PROCEDURE add_onboarding_column(IN p_table_name VARCHAR(64), IN p_column_name VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table_name AND COLUMN_NAME = p_column_name
  ) THEN
    SET @onboarding_ddl := p_ddl;
    PREPARE onboarding_stmt FROM @onboarding_ddl;
    EXECUTE onboarding_stmt;
    DEALLOCATE PREPARE onboarding_stmt;
  END IF;
END$$
DELIMITER ;

CALL add_onboarding_column('merchant_application', 'registration_phone',
  'ALTER TABLE merchant_application ADD COLUMN registration_phone VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''注册手机号(加密)'' AFTER registration_contact_hash');
CALL add_onboarding_column('merchant_application', 'registration_phone_index',
  'ALTER TABLE merchant_application ADD COLUMN registration_phone_index CHAR(64) NULL COMMENT ''注册手机号检索哈希'' AFTER registration_phone');
CALL add_onboarding_column('merchant_application', 'registration_email',
  'ALTER TABLE merchant_application ADD COLUMN registration_email VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''注册邮箱(加密)'' AFTER registration_phone_index');
CALL add_onboarding_column('merchant_application', 'registration_email_index',
  'ALTER TABLE merchant_application ADD COLUMN registration_email_index CHAR(64) NULL COMMENT ''注册邮箱检索哈希'' AFTER registration_email');
CALL add_onboarding_column('merchant_application', 'contact_data_status',
  'ALTER TABLE merchant_application ADD COLUMN contact_data_status TINYINT NOT NULL DEFAULT 1 COMMENT ''双联系方式:0完整 1待补全'' AFTER registration_email_index');
CALL add_onboarding_column('merchant_application', 'registration_status',
  'ALTER TABLE merchant_application ADD COLUMN registration_status TINYINT NOT NULL DEFAULT 0 COMMENT ''注册:0草稿 1已提交 2审核中 3通过 4待补正 5驳回'' AFTER stage');
CALL add_onboarding_column('merchant_application', 'merchant_kyc_status',
  'ALTER TABLE merchant_application ADD COLUMN merchant_kyc_status TINYINT NOT NULL DEFAULT 0 COMMENT ''商户KYC:0锁定 1草稿 2已提交 3审核中 4待补正 5通过 6驳回'' AFTER registration_status');
CALL add_onboarding_column('merchant_application', 'account_status',
  'ALTER TABLE merchant_application ADD COLUMN account_status TINYINT NOT NULL DEFAULT 0 COMMENT ''账号:0未创建 1待激活 2已激活 3暂停 4禁用'' AFTER merchant_kyc_status');
CALL add_onboarding_column('merchant_application', 'state_model_version',
  'ALTER TABLE merchant_application ADD COLUMN state_model_version TINYINT NOT NULL DEFAULT 0 COMMENT ''入驻状态模型版本'' AFTER account_status');
CALL add_onboarding_column('merchant_application', 'current_step',
  'ALTER TABLE merchant_application ADD COLUMN current_step SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''当前注册步骤'' AFTER state_model_version');
CALL add_onboarding_column('merchant_application', 'completion_percent',
  'ALTER TABLE merchant_application ADD COLUMN completion_percent TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''注册完成百分比'' AFTER current_step');
CALL add_onboarding_column('merchant_application', 'last_activity_at',
  'ALTER TABLE merchant_application ADD COLUMN last_activity_at DATETIME NULL COMMENT ''申请人最后活动时间'' AFTER completion_percent');
CALL add_onboarding_column('merchant_application', 'primary_business_type',
  'ALTER TABLE merchant_application ADD COLUMN primary_business_type VARCHAR(30) NOT NULL DEFAULT '''' COMMENT ''最终批准访问码使用的主业务类型'' AFTER business_types');
CALL add_onboarding_column('merchant_application', 'registration_reviewed_by',
  'ALTER TABLE merchant_application ADD COLUMN registration_reviewed_by BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''基础注册审核人'' AFTER assigned_ops_name');
CALL add_onboarding_column('merchant_application', 'registration_reviewed_at',
  'ALTER TABLE merchant_application ADD COLUMN registration_reviewed_at DATETIME NULL COMMENT ''基础注册审核时间'' AFTER registration_reviewed_by');
CALL add_onboarding_column('merchant_application', 'registration_review_reason',
  'ALTER TABLE merchant_application ADD COLUMN registration_review_reason VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''基础注册驳回或补正原因'' AFTER registration_reviewed_at');
CALL add_onboarding_column('merchant_application', 'merchant_kyc_submitted_at',
  'ALTER TABLE merchant_application ADD COLUMN merchant_kyc_submitted_at DATETIME NULL COMMENT ''商户KYC提交时间'' AFTER confirmed_at');
CALL add_onboarding_column('merchant_application', 'merchant_kyc_reviewed_by',
  'ALTER TABLE merchant_application ADD COLUMN merchant_kyc_reviewed_by BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''商户KYC审核人'' AFTER merchant_kyc_submitted_at');
CALL add_onboarding_column('merchant_application', 'merchant_kyc_reviewed_at',
  'ALTER TABLE merchant_application ADD COLUMN merchant_kyc_reviewed_at DATETIME NULL COMMENT ''商户KYC审核时间'' AFTER merchant_kyc_reviewed_by');
CALL add_onboarding_column('merchant_application', 'merchant_kyc_review_reason',
  'ALTER TABLE merchant_application ADD COLUMN merchant_kyc_review_reason VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''商户KYC驳回或补正原因'' AFTER merchant_kyc_reviewed_at');
CALL add_onboarding_column('merchant_application', 'active_signature_id',
  'ALTER TABLE merchant_application ADD COLUMN active_signature_id BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''当前有效KYC签署记录'' AFTER merchant_kyc_review_reason');
CALL add_onboarding_column('merchant_application', 'final_approval_request_id',
  'ALTER TABLE merchant_application ADD COLUMN final_approval_request_id VARCHAR(80) NULL COMMENT ''最终批准幂等请求ID'' AFTER active_signature_id');
CALL add_onboarding_column('merchant_application', 'final_approved_at',
  'ALTER TABLE merchant_application ADD COLUMN final_approved_at DATETIME NULL COMMENT ''最终批准完成时间'' AFTER final_approval_request_id');

CALL add_onboarding_column('merchant_application_business', 'client_ref',
  'ALTER TABLE merchant_application_business ADD COLUMN client_ref VARCHAR(64) NULL COMMENT ''注册草稿业务幂等引用'' AFTER application_id');
CALL add_onboarding_column('merchant_application_business', 'country_code',
  'ALTER TABLE merchant_application_business ADD COLUMN country_code CHAR(2) NOT NULL DEFAULT '''' COMMENT ''物业国家代码'' AFTER city');
CALL add_onboarding_column('merchant_application_business', 'city_key',
  'ALTER TABLE merchant_application_business ADD COLUMN city_key VARCHAR(80) NOT NULL DEFAULT '''' COMMENT ''物业城市标识'' AFTER country_code');
CALL add_onboarding_column('merchant_application_business', 'address',
  'ALTER TABLE merchant_application_business ADD COLUMN address VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''物业地址'' AFTER city_key');
CALL add_onboarding_column('merchant_application_business', 'kyc_version',
  'ALTER TABLE merchant_application_business ADD COLUMN kyc_version INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''首批物业KYC版本'' AFTER kyc_status');
CALL add_onboarding_column('merchant_application_business', 'kyc_approved_at',
  'ALTER TABLE merchant_application_business ADD COLUMN kyc_approved_at DATETIME NULL COMMENT ''首批物业KYC通过时间'' AFTER kyc_submitted_by');
CALL add_onboarding_column('merchant_application_business', 'kyc_reject_reason',
  'ALTER TABLE merchant_application_business ADD COLUMN kyc_reject_reason VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''首批物业KYC驳回或补正原因'' AFTER kyc_approved_at');

CALL add_onboarding_column('merchant_verify_document', 'application_business_id',
  'ALTER TABLE merchant_verify_document ADD COLUMN application_business_id BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''入驻期首批物业来源业务ID'' AFTER application_id');
CALL add_onboarding_column('merchant_verify_document', 'scope_resolution_status',
  'ALTER TABLE merchant_verify_document ADD COLUMN scope_resolution_status TINYINT NOT NULL DEFAULT 0 COMMENT ''范围解析:0明确 1旧业务ID已映射 2待人工处理'' AFTER application_business_id');
CALL add_onboarding_column('merchant_verify_document', 'scope_resolution_note',
  'ALTER TABLE merchant_verify_document ADD COLUMN scope_resolution_note VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''旧范围解析说明'' AFTER scope_resolution_status');
CALL add_onboarding_column('merchant_verify_document', 'scope_model_version',
  'ALTER TABLE merchant_verify_document ADD COLUMN scope_model_version TINYINT NOT NULL DEFAULT 0 COMMENT ''文档范围模型版本'' AFTER scope_resolution_note');

CALL add_onboarding_column('merchant_info', 'access_code_normalized',
  'ALTER TABLE merchant_info ADD COLUMN access_code_normalized VARCHAR(32) GENERATED ALWAYS AS (CASE WHEN access_code = '''' THEN NULL ELSE UPPER(access_code) END) STORED COMMENT ''访问码大写唯一键'' AFTER access_code');

DROP PROCEDURE IF EXISTS add_onboarding_column;

DROP PROCEDURE IF EXISTS add_onboarding_index;
DELIMITER $$
CREATE PROCEDURE add_onboarding_index(IN p_table_name VARCHAR(64), IN p_index_name VARCHAR(64), IN p_ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table_name AND INDEX_NAME = p_index_name
  ) THEN
    SET @onboarding_ddl := p_ddl;
    PREPARE onboarding_stmt FROM @onboarding_ddl;
    EXECUTE onboarding_stmt;
    DEALLOCATE PREPARE onboarding_stmt;
  END IF;
END$$
DELIMITER ;

CALL add_onboarding_index('merchant_application', 'idx_onboarding_states',
  'ALTER TABLE merchant_application ADD INDEX idx_onboarding_states (site_id,registration_status,merchant_kyc_status,account_status)');
CALL add_onboarding_index('merchant_application', 'idx_registration_phone',
  'ALTER TABLE merchant_application ADD INDEX idx_registration_phone (site_id,registration_phone_index)');
CALL add_onboarding_index('merchant_application', 'idx_registration_email',
  'ALTER TABLE merchant_application ADD INDEX idx_registration_email (site_id,registration_email_index)');
CALL add_onboarding_index('merchant_application', 'uk_final_approval_request',
  'ALTER TABLE merchant_application ADD UNIQUE INDEX uk_final_approval_request (site_id,final_approval_request_id)');
CALL add_onboarding_index('merchant_application_business', 'uk_application_client_ref',
  'ALTER TABLE merchant_application_business ADD UNIQUE INDEX uk_application_client_ref (application_id,client_ref)');
CALL add_onboarding_index('merchant_application_business', 'idx_application_kyc',
  'ALTER TABLE merchant_application_business ADD INDEX idx_application_kyc (application_id,kyc_status,id)');
CALL add_onboarding_index('merchant_verify_document', 'idx_application_business_document',
  'ALTER TABLE merchant_verify_document ADD INDEX idx_application_business_document (application_id,application_business_id,scope_type,status)');
CALL add_onboarding_index('merchant_info', 'uk_access_code_normalized',
  'ALTER TABLE merchant_info ADD UNIQUE INDEX uk_access_code_normalized (access_code_normalized)');

DROP PROCEDURE IF EXISTS add_onboarding_index;

CREATE TABLE IF NOT EXISTS merchant_onboarding_agreement (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  agreement_version VARCHAR(32) NOT NULL,
  title VARCHAR(200) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  content_sha256 CHAR(64) NOT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0草稿 1已发布 2已归档',
  effective_at DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_site_agreement_version (site_id,agreement_version),
  KEY idx_site_agreement_status (site_id,status,effective_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户入驻条款版本';

CREATE TABLE IF NOT EXISTS merchant_application_signature (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  application_id BIGINT UNSIGNED NOT NULL,
  agreement_id BIGINT UNSIGNED NOT NULL,
  agreement_version VARCHAR(32) NOT NULL,
  agreement_sha256 CHAR(64) NOT NULL,
  signer_name VARCHAR(100) NOT NULL,
  signer_role VARCHAR(100) NOT NULL DEFAULT '',
  signature_file_url VARCHAR(500) NOT NULL,
  signature_sha256 CHAR(64) NOT NULL,
  terms_read_at DATETIME NOT NULL,
  signed_at DATETIME NOT NULL,
  ip_address VARCHAR(45) NOT NULL DEFAULT '',
  user_agent VARCHAR(500) NOT NULL DEFAULT '',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1有效 2已替代 3已撤销',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_application_signature (site_id,application_id,status,id),
  KEY idx_agreement_signature (agreement_id,agreement_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户KYC电子签署记录';

-- Existing applications are mapped only from explicit legacy states and linked accounts.
UPDATE merchant_application a
LEFT JOIN merchant_info m ON m.id = a.merchant_id AND m.site_id = a.site_id AND m.deleted_at IS NULL
SET
  a.registration_status = CASE
    WHEN a.stage = 0 THEN 0
    WHEN a.stage = 1 THEN 1
    WHEN a.stage = 2 THEN 2
    WHEN a.stage IN (3,4,5) THEN 3
    WHEN a.stage = 6 THEN 5
    ELSE 0
  END,
  a.merchant_kyc_status = CASE
    WHEN a.stage = 3 THEN 1
    WHEN a.stage = 4 THEN 2
    WHEN a.stage = 5 AND m.status = 3 THEN 5
    WHEN a.stage = 5 AND m.status = 2 THEN 6
    WHEN a.stage = 5 AND m.status = 6 THEN 4
    WHEN a.stage = 5 THEN 3
    ELSE 0
  END,
  a.account_status = CASE
    WHEN EXISTS (
      SELECT 1 FROM merchant_admin ma
      WHERE ma.merchant_id = a.merchant_id AND ma.site_id = a.site_id
        AND ma.account_type = 2 AND ma.is_owner = 1 AND ma.deleted_at IS NULL
    ) AND m.status = 3 AND m.access_status = 1 THEN 2
    WHEN EXISTS (
      SELECT 1 FROM merchant_admin ma
      WHERE ma.merchant_id = a.merchant_id AND ma.site_id = a.site_id
        AND ma.account_type = 2 AND ma.is_owner = 1 AND ma.deleted_at IS NULL
    ) AND m.status = 4 THEN 3
    WHEN EXISTS (
      SELECT 1 FROM merchant_admin ma
      WHERE ma.merchant_id = a.merchant_id AND ma.site_id = a.site_id
        AND ma.account_type = 2 AND ma.is_owner = 1 AND ma.deleted_at IS NULL
    ) AND m.status IN (2,5) THEN 4
    WHEN EXISTS (
      SELECT 1 FROM merchant_admin ma
      WHERE ma.merchant_id = a.merchant_id AND ma.site_id = a.site_id
        AND ma.account_type = 2 AND ma.is_owner = 1 AND ma.deleted_at IS NULL
    ) THEN 1
    ELSE 0
  END,
  a.completion_percent = CASE WHEN a.stage >= 1 THEN 100 ELSE 0 END,
  a.last_activity_at = COALESCE(a.last_updated_at,a.updated_at,a.created_at),
  a.contact_data_status = CASE
    WHEN a.registration_phone <> '' AND a.registration_email <> '' THEN 0 ELSE 1
  END,
  a.state_model_version = 1
WHERE a.state_model_version = 0;

UPDATE merchant_application a
JOIN (
  SELECT application_id, MIN(business_type) AS only_type, COUNT(DISTINCT business_type) AS type_count
  FROM merchant_application_business
  WHERE business_type <> ''
  GROUP BY application_id
) types ON types.application_id = a.id
SET a.primary_business_type = CASE WHEN types.type_count = 1 THEN types.only_type ELSE '' END
WHERE a.primary_business_type = '';

ALTER TABLE merchant_application
  MODIFY COLUMN state_model_version TINYINT NOT NULL DEFAULT 1 COMMENT '入驻状态模型版本';

-- Preserve every legacy document. Only explicit, same-application numeric IDs are linked.
UPDATE merchant_verify_document d
JOIN merchant_application_business b
  ON d.biz_unit REGEXP '^[0-9]+$'
  AND b.id = CAST(d.biz_unit AS UNSIGNED)
  AND b.application_id = d.application_id
  AND b.site_id = d.site_id
SET d.application_business_id = b.id,
    d.scope_resolution_status = 1,
    d.scope_resolution_note = 'legacy biz_unit mapped by exact application business id'
WHERE d.scope_model_version = 0;

UPDATE merchant_verify_document d
JOIN merchant_store p
  ON p.id = d.property_id AND p.site_id = d.site_id AND p.merchant_id = d.merchant_id
  AND p.deleted_at IS NULL AND p.source_business_id IS NOT NULL
JOIN merchant_application_business b ON b.id = p.source_business_id
SET d.application_business_id = b.id
WHERE d.scope_model_version = 0 AND d.scope_type = 'property' AND d.property_id > 0;

UPDATE merchant_verify_document d
SET d.scope_resolution_status = 2,
    d.scope_resolution_note = 'numeric biz_unit has no same-application business'
WHERE d.scope_model_version = 0 AND d.biz_unit REGEXP '^[0-9]+$'
  AND d.application_business_id = 0;

UPDATE merchant_verify_document d
JOIN (
  SELECT site_id,application_id,doc_type
  FROM merchant_verify_document
  WHERE scope_model_version = 0 AND application_id > 0 AND deleted_at IS NULL
  GROUP BY site_id,application_id,doc_type
  HAVING SUM(application_business_id = 0) > 0 AND SUM(application_business_id > 0) > 0
) conflicts ON conflicts.site_id = d.site_id
  AND conflicts.application_id = d.application_id AND conflicts.doc_type = d.doc_type
SET d.scope_resolution_status = 2,
    d.scope_resolution_note = 'application and legacy business scopes both exist; manual resolution required'
WHERE d.scope_model_version = 0 AND d.deleted_at IS NULL;

UPDATE merchant_verify_document
SET scope_resolution_status = 2,
    scope_resolution_note = 'scope keys are inconsistent; manual resolution required'
WHERE scope_model_version = 0 AND (
  (scope_type = 'merchant' AND property_id > 0)
  OR (scope_type = 'property' AND property_id = 0 AND application_business_id = 0)
);

UPDATE merchant_verify_document SET scope_model_version = 1 WHERE scope_model_version = 0;
ALTER TABLE merchant_verify_document
  MODIFY COLUMN scope_model_version TINYINT NOT NULL DEFAULT 1 COMMENT '文档范围模型版本';
