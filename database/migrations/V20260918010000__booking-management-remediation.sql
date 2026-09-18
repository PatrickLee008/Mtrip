SET NAMES utf8mb4;
USE mtrip_business;

-- Booking notifications must carry resource scope; NULL remains valid for merchant-wide notices.
SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_notify' AND COLUMN_NAME='property_id');
SET @ddl := IF(@column_exists=0,
  'ALTER TABLE merchant_notify ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER merchant_id',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_notify' AND INDEX_NAME='idx_merchant_property_status');
SET @ddl := IF(@index_exists=0,
  'ALTER TABLE merchant_notify ADD KEY idx_merchant_property_status (merchant_id,property_id,status,send_at)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Normalize only the exact historical booking URL shape; unrelated or malformed values remain untouched.
UPDATE merchant_notify
SET deep_link_value = SUBSTRING_INDEX(deep_link_value, '=', -1)
WHERE deep_link_type = 'booking_detail'
  AND deep_link_value REGEXP '^/order\\?notificationTarget=[1-9][0-9]*$';

ALTER TABLE order_main MODIFY COLUMN pay_method TINYINT NOT NULL DEFAULT 0
  COMMENT '支付方式:1Stripe 2PayPal 3mTrip钱包 4到店付款';

INSERT IGNORE INTO merchant_menu
  (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort,account_scope)
VALUES
  (40016,400,'确认到店收款','Mark as Paid','mch:order:mark-paid',3,16,'1,2,3');
INSERT IGNORE INTO merchant_role_menu(role_id,menu_id)
SELECT role_id,40016 FROM merchant_role_menu WHERE menu_id=400 GROUP BY role_id;
