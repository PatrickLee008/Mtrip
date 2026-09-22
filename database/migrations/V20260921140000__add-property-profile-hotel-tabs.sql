SET NAMES utf8mb4;
USE mtrip_business;

-- 酒店资料页 Long Stay Details / Hotel Policies / Nearby Attraction 三个页签的落库字段
-- (与 amenities / image_gallery 同范式:merchant_store 上的 JSON 列,随 content revision 走草稿/审核/版本快照)
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='long_stay')=0,
  'ALTER TABLE merchant_store ADD COLUMN long_stay JSON NULL COMMENT ''长住促销与长住权益'' AFTER amenities', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='hotel_policies')=0,
  'ALTER TABLE merchant_store ADD COLUMN hotel_policies JSON NULL COMMENT ''预订/入住退房/儿童加床/宠物/物业规则'' AFTER long_stay', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='nearby_attractions')=0,
  'ALTER TABLE merchant_store ADD COLUMN nearby_attractions JSON NULL COMMENT ''附近景点:图片、名称、路程与交通方式'' AFTER hotel_policies', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
