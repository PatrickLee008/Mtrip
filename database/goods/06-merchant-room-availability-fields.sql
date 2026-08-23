-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Merchant App PRD v1.0 / M2+M3]:商家端房型详情与房量价格限制字段
-- 库:mtrip_business;全新环境 01-goods.sql 已包含这些列,存量库幂等补列
-- ============================================================
USE `mtrip_business`;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='room_code');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `room_code` VARCHAR(50) NOT NULL DEFAULT '''' COMMENT ''房型内部编码'' AFTER `room_name`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='description');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `description` VARCHAR(1000) NOT NULL DEFAULT '''' COMMENT ''房型描述'' AFTER `room_code`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='bed_count');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `bed_count` TINYINT NOT NULL DEFAULT 1 COMMENT ''床数量'' AFTER `bed_type`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='max_adults');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `max_adults` TINYINT NOT NULL DEFAULT 2 COMMENT ''最多成人数'' AFTER `area`, ADD COLUMN `max_children` TINYINT NOT NULL DEFAULT 0 COMMENT ''最多儿童数'' AFTER `max_adults`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='floor_name');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `floor_name` VARCHAR(50) NOT NULL DEFAULT '''' COMMENT ''楼层范围'' AFTER `max_guests`, ADD COLUMN `room_view` VARCHAR(80) NOT NULL DEFAULT '''' COMMENT ''景观'' AFTER `floor_name`, ADD COLUMN `smoking` TINYINT NOT NULL DEFAULT 0 COMMENT ''是否允许吸烟:0否 1是'' AFTER `room_view`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='meal_plan');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `meal_plan` VARCHAR(80) NOT NULL DEFAULT '''' COMMENT ''餐食计划'' AFTER `breakfast`, ADD COLUMN `cancellation_policy` VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''取消政策'' AFTER `meal_plan`, ADD COLUMN `checkin_notes` VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''入住提示'' AFTER `cancellation_policy`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='weekend_price');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `weekend_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT ''周末价'' AFTER `base_price`, ADD COLUMN `extra_bed_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT ''加床价'' AFTER `weekend_price`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='launch_stock');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `launch_stock` INT NOT NULL DEFAULT 0 COMMENT ''发布首日可售库存'' AFTER `base_stock`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='video_url');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `video_url` VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''房型视频'' AFTER `images`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='publish_status');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `publish_status` TINYINT NOT NULL DEFAULT 0 COMMENT ''发布流程:0草稿 1待审核 2已发布 3驳回'' AFTER `status`, ADD COLUMN `submitted_at` DATETIME NULL DEFAULT NULL COMMENT ''提交审核时间'' AFTER `publish_status`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='goods_daily_stock' AND COLUMN_NAME='min_stay');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `goods_daily_stock` ADD COLUMN `min_stay` INT NOT NULL DEFAULT 1 COMMENT ''最少入住晚数'' AFTER `is_closed`, ADD COLUMN `max_stay` INT NOT NULL DEFAULT 30 COMMENT ''最多入住晚数'' AFTER `min_stay`, ADD COLUMN `closed_to_arrival` TINYINT NOT NULL DEFAULT 0 COMMENT ''CTA:是否关闭入住'' AFTER `max_stay`, ADD COLUMN `closed_to_departure` TINYINT NOT NULL DEFAULT 0 COMMENT ''CTD:是否关闭离店'' AFTER `closed_to_arrival`, ADD COLUMN `source` VARCHAR(30) NOT NULL DEFAULT ''manual'' COMMENT ''库存来源:manual/pms/channel/base'' AFTER `closed_to_departure`, ADD COLUMN `note` VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''商户备注'' AFTER `source`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
