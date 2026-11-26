SET NAMES utf8mb4;
USE mtrip_business;

CREATE TABLE IF NOT EXISTS merchant_deletion_request (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    site_id BIGINT UNSIGNED NOT NULL,
    merchant_id BIGINT UNSIGNED NOT NULL,
    account_id BIGINT UNSIGNED NOT NULL,
    merchant_name VARCHAR(100) NOT NULL,
    merchant_code VARCHAR(20) NOT NULL DEFAULT '',
    applicant_name VARCHAR(100) NOT NULL,
    properties_json JSON NOT NULL,
    reason VARCHAR(20) NOT NULL,
    details VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(12) NOT NULL DEFAULT 'pending',
    submitted_at DATETIME NOT NULL,
    resolved_at DATETIME NULL,
    resolver_id BIGINT UNSIGNED NULL,
    resolver_name VARCHAR(100) NOT NULL DEFAULT '',
    review_note VARCHAR(500) NOT NULL DEFAULT '',
    pending_merchant_id BIGINT UNSIGNED GENERATED ALWAYS AS (IF(status = 'pending', merchant_id, NULL)) STORED,
    UNIQUE KEY uk_deletion_pending (pending_merchant_id),
    KEY idx_deletion_merchant (merchant_id, id),
    KEY idx_deletion_status (status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

USE mtrip_system;
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,i18n_key,perm_key,menu_type,route_path,component,icon,sort) VALUES
(312,300,'商户注销审批','Merchant Account Deletion','menu.merchantDeletion','merchant:deletion:list',2,'/merchant/deletion','merchant/deletion/index','',12);
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(31201,312,'审批注销申请','Review Deletion Requests','merchant:deletion:review',3,1);
