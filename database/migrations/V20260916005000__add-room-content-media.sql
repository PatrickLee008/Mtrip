SET NAMES utf8mb4;
USE mtrip_business;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='bedding')=0,
  'ALTER TABLE hotel_room_type ADD COLUMN bedding JSON NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='area_unit')=0,
  'ALTER TABLE hotel_room_type ADD COLUMN area_unit VARCHAR(8) NOT NULL DEFAULT ''sqm''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='image_gallery')=0,
  'ALTER TABLE hotel_room_type ADD COLUMN image_gallery JSON NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='panorama')=0,
  'ALTER TABLE hotel_room_type ADD COLUMN panorama JSON NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='vr_tour')=0,
  'ALTER TABLE hotel_room_type ADD COLUMN vr_tour JSON NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='floor_plan')=0,
  'ALTER TABLE hotel_room_type ADD COLUMN floor_plan JSON NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='refund_policy')=0,
  'ALTER TABLE hotel_room_type ADD COLUMN refund_policy JSON NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='status_version')=0,
  'ALTER TABLE hotel_room_type ADD COLUMN status_version INT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS hotel_room_media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(20) NOT NULL,
  url VARCHAR(255) NOT NULL,
  mime VARCHAR(80) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  width INT UNSIGNED NOT NULL DEFAULT 0,
  height INT UNSIGNED NOT NULL DEFAULT 0,
  duration DECIMAL(10,3) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_room_media_url (url),
  KEY idx_room_media_property (site_id, property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
