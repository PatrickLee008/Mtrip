SET NAMES utf8mb4;
USE `mtrip_business`;
-- S5: retain legacy demo rows; NULL market_id rows never enter the real marketplace.
CREATE TABLE IF NOT EXISTS ranking_market (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 site_id BIGINT UNSIGNED NOT NULL,
 entity_type VARCHAR(20) NOT NULL,
 business_type VARCHAR(30) NOT NULL DEFAULT '',
 country_code CHAR(2) NOT NULL DEFAULT '',
 market_key VARCHAR(100) NOT NULL,
 version BIGINT UNSIGNED NOT NULL DEFAULT 0,
 published_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
 published_json JSON NULL,
 updated_by VARCHAR(50) NOT NULL DEFAULT '',
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 published_by VARCHAR(50) NOT NULL DEFAULT '',
 published_at DATETIME NULL,
 UNIQUE KEY uk_market (site_id,entity_type,business_type,country_code,market_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ranking_listing' AND COLUMN_NAME='market_id')=0, 'ALTER TABLE ranking_listing ADD market_id BIGINT UNSIGNED NULL, ADD property_id BIGINT UNSIGNED NULL, ADD goods_id BIGINT UNSIGNED NULL, ADD pinned TINYINT NOT NULL DEFAULT 0, ADD UNIQUE KEY uk_property (property_id), ADD UNIQUE KEY uk_goods (goods_id), ADD KEY idx_market (market_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ranking_destination' AND COLUMN_NAME='market_id')=0, 'ALTER TABLE ranking_destination ADD market_id BIGINT UNSIGNED NULL, ADD country_code CHAR(2) NOT NULL DEFAULT '''', ADD city_key VARCHAR(80) NOT NULL DEFAULT '''', ADD KEY idx_market (market_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ranking_history' AND COLUMN_NAME='market_id')=0, 'ALTER TABLE ranking_history ADD market_id BIGINT UNSIGNED NULL, ADD version BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD before_json JSON NULL, ADD after_json JSON NULL, ADD KEY idx_market (market_id,id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
