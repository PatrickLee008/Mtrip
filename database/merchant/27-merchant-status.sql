-- M12 S1：只追加状态元数据/审计结构，不重分类、不伪造历史，不修改存量经营状态。
SET NAMES utf8mb4;
USE `mtrip_business`;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_info' AND COLUMN_NAME='status_version')=0,
  'ALTER TABLE merchant_info ADD COLUMN status_version BIGINT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_info' AND COLUMN_NAME='suspended_until')=0,
  'ALTER TABLE merchant_info ADD COLUMN suspended_until DATETIME NULL COMMENT ''UTC暂停截止时间''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_info' AND COLUMN_NAME='active_suspension_id')=0,
  'ALTER TABLE merchant_info ADD COLUMN active_suspension_id BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_info' AND COLUMN_NAME='reactivation_requires_super')=0,
  'ALTER TABLE merchant_info ADD COLUMN reactivation_requires_super TINYINT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_info' AND INDEX_NAME='idx_suspension_due')=0,
  'ALTER TABLE merchant_info ADD INDEX idx_suspension_due (status, suspended_until)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `merchant_status_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `site_id` BIGINT UNSIGNED NOT NULL,
  `merchant_id` BIGINT UNSIGNED NOT NULL,
  `action` VARCHAR(30) NOT NULL,
  `from_status` VARCHAR(30) NOT NULL,
  `to_status` VARCHAR(30) NOT NULL,
  `note` VARCHAR(500) NOT NULL,
  `evidence` VARCHAR(500) NOT NULL DEFAULT '',
  `suspended_until` DATETIME NULL COMMENT 'UTC',
  `previous_suspension_id` BIGINT UNSIGNED NULL,
  `from_version` BIGINT UNSIGNED NOT NULL,
  `to_version` BIGINT UNSIGNED NOT NULL,
  `actor_type` VARCHAR(20) NOT NULL,
  `actor_id` BIGINT UNSIGNED NOT NULL,
  `actor_name` VARCHAR(50) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL DEFAULT '',
  `request_id` VARCHAR(80) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `result_json` JSON NOT NULL,
  `created_at` DATETIME NOT NULL COMMENT 'UTC',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_status_request` (`merchant_id`,`actor_type`,`actor_id`,`request_id`),
  UNIQUE KEY `uk_status_version` (`merchant_id`,`to_version`),
  KEY `idx_status_history` (`site_id`,`merchant_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='M12追加式状态历史；迁移前历史不补造';

-- 如果存在重复有效黑名单，先输出冲突ID，唯一索引将拒绝迁移；禁止自动删改未知数据。
SELECT merchant_id, COUNT(*) AS active_count FROM merchant_blacklist WHERE status=1 GROUP BY merchant_id HAVING COUNT(*)>1;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_blacklist' AND COLUMN_NAME='active_merchant_id')=0,
  'ALTER TABLE merchant_blacklist ADD COLUMN active_merchant_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status=1 THEN merchant_id ELSE NULL END) STORED', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_blacklist' AND INDEX_NAME='uk_active_merchant')=0,
  'ALTER TABLE merchant_blacklist ADD UNIQUE INDEX uk_active_merchant (active_merchant_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

USE `mtrip_system`;
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(30108,301,'暂停商户','Suspend merchant','merchant:status:suspend',3,8),
(30109,301,'恢复商户','Activate merchant','merchant:status:activate',3,9),
(30110,301,'拉黑商户','Blacklist merchant','merchant:status:blacklist',3,10),
(30111,301,'解除黑名单','Unblacklist merchant','merchant:status:unblacklist',3,11),
(30112,301,'黑名单后重新激活','Reactivate after blacklist','merchant:status:reactivate',3,12),
(30113,301,'商户状态历史','Merchant status history','merchant:status:history',3,13);
-- 旧状态角色仅继承普通暂停/恢复/历史；特权操作不自动授予，服务层仍要求isSuper。
INSERT IGNORE INTO sys_role_menu (role_id,menu_id)
SELECT old.role_id, m.id FROM sys_role_menu old JOIN sys_menu m ON m.id IN (30108,30109,30113) WHERE old.menu_id=30103;
