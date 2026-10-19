SET NAMES utf8mb4;
USE mtrip_business;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND COLUMN_NAME='property_id')=0,'ALTER TABLE `chat_conversation` ADD COLUMN `property_id` BIGINT UNSIGNED NOT NULL DEFAULT 0','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND COLUMN_NAME='assignee_id')=0,'ALTER TABLE `chat_conversation` ADD COLUMN `assignee_id` BIGINT UNSIGNED NOT NULL DEFAULT 0','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND COLUMN_NAME='version')=0,'ALTER TABLE `chat_conversation` ADD COLUMN `version` INT UNSIGNED NOT NULL DEFAULT 1','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND COLUMN_NAME='last_sender_type')=0,'ALTER TABLE `chat_conversation` ADD COLUMN `last_sender_type` TINYINT NOT NULL DEFAULT 0','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND COLUMN_NAME='resolved_at')=0,'ALTER TABLE `chat_conversation` ADD COLUMN `resolved_at` DATETIME NULL','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND COLUMN_NAME='thread_key')=0,'ALTER TABLE `chat_conversation` ADD COLUMN `thread_key` VARCHAR(150) NULL','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_message' AND COLUMN_NAME='sender_id')=0,'ALTER TABLE `chat_message` ADD COLUMN `sender_id` BIGINT UNSIGNED NOT NULL DEFAULT 0','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_message' AND COLUMN_NAME='sender_role')=0,'ALTER TABLE `chat_message` ADD COLUMN `sender_role` VARCHAR(20) NOT NULL DEFAULT ''legacy''','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_message' AND COLUMN_NAME='sender_name')=0,'ALTER TABLE `chat_message` ADD COLUMN `sender_name` VARCHAR(100) NOT NULL DEFAULT ''''','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_message' AND COLUMN_NAME='client_message_id')=0,'ALTER TABLE `chat_message` ADD COLUMN `client_message_id` VARCHAR(64) NULL','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_message' AND COLUMN_NAME='payload_hash')=0,'ALTER TABLE `chat_message` ADD COLUMN `payload_hash` CHAR(64) NULL','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_notify' AND COLUMN_NAME='recipient_id')=0,'ALTER TABLE `merchant_notify` ADD COLUMN `recipient_id` BIGINT UNSIGNED NULL','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_admin_role' AND COLUMN_NAME='created_at')=0,'ALTER TABLE `merchant_admin_role` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_role_menu' AND COLUMN_NAME='created_at')=0,'ALTER TABLE `merchant_role_menu` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- Only order-backed history provides an unambiguous property mapping. Other legacy targets remain quarantined.
UPDATE chat_conversation c JOIN order_main o ON c.order_id=o.id AND c.site_id=o.site_id AND c.user_id=o.user_id
SET c.property_id=o.property_id WHERE c.type=1 AND c.property_id=0 AND o.property_id>0;
-- Duplicate legacy threads retain their IDs/history. New writes reuse the oldest mapped thread.
UPDATE chat_conversation c JOIN (SELECT MIN(id) id,site_id,property_id,user_id,order_id FROM
 (SELECT * FROM chat_conversation WHERE type=1 AND property_id>0) mapped
 GROUP BY site_id,property_id,user_id,order_id) k ON c.id=k.id
SET c.thread_key=CONCAT(c.site_id,':',c.property_id,':',c.user_id,':',c.order_id) WHERE c.thread_key IS NULL;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND INDEX_NAME='uk_chat_thread')=0,'ALTER TABLE chat_conversation ADD UNIQUE KEY uk_chat_thread(thread_key)','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_message' AND INDEX_NAME='uk_chat_retry')=0,'ALTER TABLE chat_message ADD UNIQUE KEY uk_chat_retry(conversation_id,sender_role,sender_id,client_message_id)','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl=IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_conversation' AND INDEX_NAME='idx_chat_property')=0,'ALTER TABLE chat_conversation ADD KEY idx_chat_property(site_id,property_id,last_time,id)','SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;


CREATE TABLE IF NOT EXISTS chat_receipt (
 conversation_id BIGINT UNSIGNED NOT NULL, actor_role VARCHAR(20) NOT NULL, actor_id BIGINT UNSIGNED NOT NULL,
 delivered_id BIGINT UNSIGNED NOT NULL DEFAULT 0, read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(conversation_id,actor_role,actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS chat_note (
 conversation_id BIGINT UNSIGNED PRIMARY KEY, content TEXT NOT NULL, version INT UNSIGNED NOT NULL,
 editor_id BIGINT UNSIGNED NOT NULL, editor_name VARCHAR(100) NOT NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS chat_note_history (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, conversation_id BIGINT UNSIGNED NOT NULL,
 content TEXT NOT NULL, version INT UNSIGNED NOT NULL, editor_id BIGINT UNSIGNED NOT NULL,
 editor_name VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uk_note_version(conversation_id,version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS chat_attachment (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, conversation_id BIGINT UNSIGNED NOT NULL,
 message_id BIGINT UNSIGNED NULL, actor_role VARCHAR(20) NOT NULL, actor_id BIGINT UNSIGNED NOT NULL,
 storage_key VARCHAR(100) NOT NULL, filename VARCHAR(255) NOT NULL, mime VARCHAR(100) NOT NULL,
 size INT UNSIGNED NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_attachment_message(message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS chat_quick_reply (
 site_id BIGINT UNSIGNED NOT NULL, property_id BIGINT UNSIGNED NOT NULL, language VARCHAR(10) NOT NULL,
 kind VARCHAR(20) NOT NULL, content VARCHAR(2000) NOT NULL, editor_id BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(site_id,property_id,language,kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS chat_audit (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, conversation_id BIGINT UNSIGNED NOT NULL,
 actor_role VARCHAR(20) NOT NULL, actor_id BIGINT UNSIGNED NOT NULL,
 action VARCHAR(30) NOT NULL, details VARCHAR(500) NOT NULL DEFAULT '', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_chat_audit(conversation_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS chat_preferences (
 site_id BIGINT UNSIGNED NOT NULL, admin_id BIGINT UNSIGNED NOT NULL,
 inapp_enabled TINYINT NOT NULL DEFAULT 1, sound_enabled TINYINT NOT NULL DEFAULT 0,
 PRIMARY KEY(site_id,admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO merchant_menu(id,parent_id,menu_name,menu_name_en,i18n_key,perm_key,menu_type,route_path,component,icon,sort,account_scope,module_key,is_cache) VALUES
(1500,0,'访客消息','Guest Messages','menu.guestMessaging','mch:chat:list',2,'/guest-messaging','guest-messaging/index','MessageOutlined',65,'1,2,3','',2);
INSERT IGNORE INTO merchant_menu(id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort,account_scope) VALUES
(150001,1500,'回复消息','Reply','mch:chat:reply',3,1,'1,2,3'),
(150002,1500,'内部备注','Internal Notes','mch:chat:note',3,2,'1,2,3'),
(150003,1500,'分配会话','Assign','mch:chat:assign',3,3,'1,2,3'),
(150004,1500,'解决会话','Resolve','mch:chat:resolve',3,4,'1,2,3'),
(150005,1500,'配置快捷回复','Quick Reply Settings','mch:chat:settings',3,5,'1,2,3');
INSERT IGNORE INTO merchant_role_menu(role_id,menu_id)
SELECT r.id,m.id FROM merchant_role r JOIN merchant_menu m ON m.id IN(1500,150001,150002,150003,150004,150005)
WHERE r.is_builtin=1 AND r.id IN(1,2,3) AND r.deleted_at IS NULL;
