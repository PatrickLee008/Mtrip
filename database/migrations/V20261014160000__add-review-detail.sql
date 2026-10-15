SET NAMES utf8mb4;

-- 订单评价页(Figma「Hotel Review」`797:1600`):总体 + 四个分项表情评分、出行类型、图文 + 视频。
--
--   goods_review.rating               总体评分(已有,1-5,Overall)
--   goods_review.rating_cleanliness   清洁度 0-5(0=未评)
--   goods_review.rating_location      位置   0-5
--   goods_review.rating_service       服务   0-5
--   goods_review.rating_amenities     设施   0-5
--   goods_review.traveler_type        出行类型:solo / couple / family / friends / business(空=未选)
--   goods_review.videos               评价视频地址 JSON 数组(最多 3 个;图片 images 最多 20 张)
--
-- 一单一评仍由 uk_order 唯一键保证。幂等:列按 information_schema 判存在。

USE `mtrip_business`;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'goods_review' AND COLUMN_NAME = 'rating_cleanliness');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `goods_review` ADD COLUMN `rating_cleanliness` TINYINT NOT NULL DEFAULT 0 COMMENT ''清洁度评分0-5(0未评)'' AFTER `rating`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'goods_review' AND COLUMN_NAME = 'rating_location');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `goods_review` ADD COLUMN `rating_location` TINYINT NOT NULL DEFAULT 0 COMMENT ''位置评分0-5(0未评)'' AFTER `rating_cleanliness`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'goods_review' AND COLUMN_NAME = 'rating_service');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `goods_review` ADD COLUMN `rating_service` TINYINT NOT NULL DEFAULT 0 COMMENT ''服务评分0-5(0未评)'' AFTER `rating_location`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'goods_review' AND COLUMN_NAME = 'rating_amenities');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `goods_review` ADD COLUMN `rating_amenities` TINYINT NOT NULL DEFAULT 0 COMMENT ''设施评分0-5(0未评)'' AFTER `rating_service`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'goods_review' AND COLUMN_NAME = 'traveler_type');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `goods_review` ADD COLUMN `traveler_type` VARCHAR(20) NOT NULL DEFAULT '''' COMMENT ''出行类型 solo/couple/family/friends/business'' AFTER `rating_amenities`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'goods_review' AND COLUMN_NAME = 'videos');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `goods_review` ADD COLUMN `videos` JSON NULL COMMENT ''评价视频(最多3个)'' AFTER `images`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
