SET NAMES utf8mb4;

-- 房型卧室数(Consumer App PRD 模块 3「Number of Bedrooms」筛选,QA CA_TC_014)。
--
--   bedroom_count  该房型的卧室数,默认 1(普通酒店客房);民宿/公寓整套出租时由商户填写实际卧室数。
--
-- 商户端录入在 merchant-web 房型编辑器,随房型审核版本发布;C 端 /app/hotels/list 按物业任一在售房型
-- 的卧室数筛选(bedrooms=1,2,3,3 表示 3 间及以上)。存量房型统一回填为 1。
--
-- 幂等:列按 information_schema 判存在。

USE `mtrip_business`;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'hotel_room_type' AND COLUMN_NAME = 'bedroom_count');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `hotel_room_type`
     ADD COLUMN `bedroom_count` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT ''卧室数(默认1)'' AFTER `bed_count`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
