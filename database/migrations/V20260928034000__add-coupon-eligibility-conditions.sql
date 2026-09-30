SET NAMES utf8mb4;

-- 优惠券资格条件(Consumer App PRD v1.0.1 §17.5):补齐后台可配的四个条件列。
--
--   min_room_count   最少间数(按合格房型的间数合计,0=不限)        Multi-Room
--   min_hotel_count  最少酒店数(按整单不同物业数,0=不限)           Multi-Hotel
--   stay_start       适用入住日期段起(该段每一晚都须落在区间内,NULL=不限)  Specific Stay Date
--   stay_end         适用入住日期段止(含当晚,NULL=不限)
--
-- min_nights / max_nights / book_advance_days 已由 V20260921121500 建好,本次起在下单与选券时真正生效。
-- 判定与分摊的唯一实现:backend/shared/src/Support/CouponEligibility.php。
--
-- 幂等:列按 information_schema 判存在。

USE `mtrip_business`;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'marketing_coupon' AND COLUMN_NAME = 'min_room_count');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `marketing_coupon`
     ADD COLUMN `min_room_count`  INT  NOT NULL DEFAULT 0 COMMENT ''最少间数(合格房型间数合计,0=不限)'' AFTER `book_advance_days`,
     ADD COLUMN `min_hotel_count` INT  NOT NULL DEFAULT 0 COMMENT ''最少酒店数(整单不同物业数,0=不限)'' AFTER `min_room_count`,
     ADD COLUMN `stay_start`      DATE NULL DEFAULT NULL  COMMENT ''适用入住日期段起(NULL=不限)'' AFTER `min_hotel_count`,
     ADD COLUMN `stay_end`        DATE NULL DEFAULT NULL  COMMENT ''适用入住日期段止,含当晚(NULL=不限)'' AFTER `stay_start`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
