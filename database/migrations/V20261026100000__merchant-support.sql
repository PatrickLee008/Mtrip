SET NAMES utf8mb4;
USE mtrip_business;

CREATE TABLE IF NOT EXISTS merchant_support_ticket (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ticket_no VARCHAR(40) NULL,
 site_id BIGINT UNSIGNED NOT NULL,
 merchant_id BIGINT UNSIGNED NOT NULL,
 property_id BIGINT UNSIGNED NULL,
 category VARCHAR(30) NOT NULL,
 subject VARCHAR(200) NOT NULL,
 description TEXT NOT NULL,
 priority VARCHAR(10) NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'open',
 created_by BIGINT UNSIGNED NOT NULL,
 creator_name VARCHAR(100) NOT NULL,
 assigned_admin_id BIGINT UNSIGNED NULL,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 violation_id BIGINT UNSIGNED NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 resolved_at DATETIME NULL,
 closed_at DATETIME NULL,
 UNIQUE KEY uk_support_number(ticket_no),
 KEY idx_support_scope(site_id,merchant_id,property_id,status,updated_at,id),
 KEY idx_support_queue(site_id,status,updated_at,id),
 KEY idx_support_violation(violation_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_support_reply (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ticket_id BIGINT UNSIGNED NOT NULL,
 actor_type VARCHAR(10) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 actor_name VARCHAR(100) NOT NULL,
 content TEXT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_support_reply(ticket_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_support_event (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ticket_id BIGINT UNSIGNED NOT NULL,
 actor_type VARCHAR(10) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 actor_name VARCHAR(100) NOT NULL,
 action VARCHAR(30) NOT NULL,
 changes_json JSON NOT NULL,
 reason TEXT NOT NULL,
 version INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uk_support_version(ticket_id,version),
 KEY idx_support_event(ticket_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_support_attachment (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 site_id BIGINT UNSIGNED NOT NULL,
 merchant_id BIGINT UNSIGNED NOT NULL,
 property_id BIGINT UNSIGNED NULL,
 ticket_id BIGINT UNSIGNED NULL,
 reply_id BIGINT UNSIGNED NULL,
 bound_at DATETIME NULL,
 actor_type VARCHAR(10) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 storage_key VARCHAR(100) NOT NULL,
 filename VARCHAR(255) NOT NULL,
 mime VARCHAR(100) NOT NULL,
 size INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_support_attachment(ticket_id,reply_id),
 KEY idx_support_temp(bound_at,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_support_request (
 site_id BIGINT UNSIGNED NOT NULL,
 actor_type VARCHAR(10) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 request_id VARCHAR(64) NOT NULL,
 payload_hash CHAR(64) NOT NULL,
 ticket_id BIGINT UNSIGNED NULL,
 result_json JSON NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(site_id,actor_type,actor_id,request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT IGNORE INTO merchant_menu(id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort,account_scope) VALUES
(120001,1200,'创建工单','Create Ticket','mch:support:create',3,1,'1,2,3'),
(120002,1200,'回复工单','Reply','mch:support:reply',3,2,'1,2,3'),
(120003,1200,'关闭工单','Close','mch:support:close',3,3,'1,2,3'),
(120004,1200,'重开工单','Reopen','mch:support:reopen',3,4,'1,2,3'),
(120005,1200,'商户通用工单','Merchant Scope','mch:support:merchant-scope',3,5,'1,2'),
(120006,1200,'用户指南','User Guide','mch:support:guides',3,6,'1,2,3');
UPDATE merchant_menu SET menu_name='支持与帮助' WHERE id=1200 AND perm_key='mch:support:list';
-- Existing employee role grants are intentionally unchanged.

USE mtrip_system;
INSERT IGNORE INTO sys_menu(id,parent_id,menu_name,menu_name_en,i18n_key,perm_key,menu_type,route_path,component,sort) VALUES
(1105,1100,'商户支持工单','Merchant Support Tickets','menu.supportTickets','help:ticket:list',2,'/helpcenter/merchant-tickets','helpcenter/merchant-tickets/index',5);
INSERT IGNORE INTO sys_menu(id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(110501,1105,'回复工单','Reply','help:ticket:reply',3,1),
(110502,1105,'指派工单','Assign','help:ticket:assign',3,2),
(110503,1105,'调整优先级','Priority','help:ticket:priority',3,3),
(110504,1105,'处理状态','Status','help:ticket:status',3,4),
(110505,1105,'重开工单','Reopen','help:ticket:reopen',3,5);
