SET NAMES utf8mb4;
USE mtrip_business;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'merchant_store' AND COLUMN_NAME = 'booking_status_version') = 0,
    'ALTER TABLE merchant_store ADD COLUMN booking_status_version INT UNSIGNED NOT NULL DEFAULT 0',
    'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS merchant_store_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id BIGINT UNSIGNED NOT NULL,
    merchant_id BIGINT UNSIGNED NOT NULL,
    store_id BIGINT UNSIGNED NOT NULL,
    version INT UNSIGNED NOT NULL,
    action VARCHAR(12) NOT NULL,
    from_status TINYINT UNSIGNED NOT NULL,
    to_status TINYINT UNSIGNED NOT NULL,
    reason VARCHAR(500) NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    actor_name VARCHAR(100) NOT NULL,
    effective_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_store_status_version (site_id, store_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

USE mtrip_system;
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(30803,308,'暂停或恢复门店','Suspend or Restore Store','merchant:store:status',3,3);
