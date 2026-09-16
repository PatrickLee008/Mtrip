SET NAMES utf8mb4;
USE mtrip_business;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='contact_phone2')=0,
  'ALTER TABLE merchant_store ADD COLUMN contact_phone2 VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''物业备用联系电话(加密)'' AFTER contact_phone', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='contact_email')=0,
  'ALTER TABLE merchant_store ADD COLUMN contact_email VARCHAR(100) NOT NULL DEFAULT '''' COMMENT ''物业联系邮箱'' AFTER contact_phone2', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='image_gallery')=0,
  'ALTER TABLE merchant_store ADD COLUMN image_gallery JSON NULL COMMENT ''物业图片及启用状态'' AFTER images', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE merchant_store
SET image_gallery=JSON_ARRAY()
WHERE image_gallery IS NULL AND (images IS NULL OR JSON_VALID(images)=0 OR JSON_LENGTH(images)=0);

UPDATE merchant_store
SET image_gallery=(
  SELECT JSON_ARRAYAGG(JSON_OBJECT('url', jt.url, 'enabled', JSON_EXTRACT('true', '$')))
  FROM JSON_TABLE(merchant_store.images, '$[*]' COLUMNS(url VARCHAR(1000) PATH '$')) jt
)
WHERE image_gallery IS NULL AND JSON_VALID(images)=1 AND JSON_LENGTH(images)>0;
