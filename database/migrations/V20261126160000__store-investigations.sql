SET NAMES utf8mb4;
USE mtrip_business;
CREATE TABLE IF NOT EXISTS merchant_store_investigation (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 site_id BIGINT UNSIGNED NOT NULL,
 merchant_id BIGINT UNSIGNED NOT NULL,
 store_id BIGINT UNSIGNED NOT NULL,
 merchant_name VARCHAR(100) NOT NULL,
 store_name VARCHAR(160) NOT NULL,
 category VARCHAR(24) NOT NULL,
 status VARCHAR(16) NOT NULL,
 decision VARCHAR(24) NULL,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 open_store_id BIGINT UNSIGNED GENERATED ALWAYS AS (IF(status IN ('flagged','investigating'),store_id,NULL)) STORED,
 UNIQUE KEY uk_investigation_open_store(open_store_id),
 KEY idx_investigation_scope(site_id,status,id),
 KEY idx_investigation_store(store_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_store_investigation_event (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 investigation_id BIGINT UNSIGNED NOT NULL,
 action VARCHAR(12) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 evidence VARCHAR(500) NOT NULL DEFAULT '',
 decision VARCHAR(24) NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 actor_name VARCHAR(100) NOT NULL,
 created_at DATETIME NOT NULL,
 KEY idx_investigation_events(investigation_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

USE mtrip_system;
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,i18n_key,perm_key,menu_type,route_path,component,icon,sort) VALUES
(313,300,'商户调查','Merchant Investigations','menu.merchantInvestigation','merchant:investigation:list',2,'/merchant/investigations','merchant/investigations/index','',13);
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(30804,308,'标记门店疑似违规','Flag Store for Investigation','merchant:store:flag',3,4),
(31301,313,'升级商户调查','Escalate Merchant Investigation','merchant:investigation:escalate',3,1),
(31302,313,'记录调查决定','Resolve Merchant Investigation','merchant:investigation:review',3,2);
