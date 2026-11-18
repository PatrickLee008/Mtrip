SET NAMES utf8mb4;
USE `mtrip_business`;

-- A public group points to immutable version rows. Private property checklists
-- keep a NULL group and their existing ID references.
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_kyc_template' AND COLUMN_NAME='template_group_id')=0,
  'ALTER TABLE merchant_kyc_template ADD COLUMN template_group_id BIGINT UNSIGNED NULL, ADD COLUMN template_version INT UNSIGNED NOT NULL DEFAULT 1, ADD COLUMN is_current TINYINT NOT NULL DEFAULT 1, ADD COLUMN created_by BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD COLUMN created_by_name VARCHAR(100) NOT NULL DEFAULT '''', ADD COLUMN change_action VARCHAR(20) NOT NULL DEFAULT ''baseline'', ADD COLUMN change_reason VARCHAR(300) NOT NULL DEFAULT '''', ADD UNIQUE KEY uk_template_group_version (template_group_id,template_version), ADD KEY idx_template_current (application_business_id,is_current,status)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE merchant_kyc_template SET template_group_id=id WHERE application_business_id=0 AND template_group_id IS NULL;

USE `mtrip_system`;
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,i18n_key,perm_key,menu_type,route_path,component,icon,sort) VALUES
(1315,1314,'KYC 模板管理','KYC Templates','kycTemplate.title','config:kyc:list',2,'/config/kyc-template','config/kyc-template/index','',14);
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(131501,1315,'新建复制 KYC 模板','Create/Copy KYC Template','config:kyc:add',3,1),
(131502,1315,'编辑 KYC 模板','Edit KYC Template','config:kyc:edit',3,2),
(131503,1315,'启停 KYC 模板','Enable/Disable KYC Template','config:kyc:status',3,3);
INSERT IGNORE INTO sys_role_menu (role_id,menu_id) VALUES (1,1314),(1,1315),(1,131501),(1,131502),(1,131503);
