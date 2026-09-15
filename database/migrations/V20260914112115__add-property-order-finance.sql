USE `mtrip_business`;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_main' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE order_main ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER supplier_id, ADD COLUMN room_type_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER sku_id, ADD INDEX idx_site_property_date (site_id,property_id,use_date), ADD INDEX idx_property_room (property_id,room_type_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_refund' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE order_refund ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER merchant_id, ADD COLUMN room_type_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER property_id, ADD INDEX idx_property_refund (property_id,created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_flow' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE finance_flow ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER merchant_id, ADD COLUMN room_type_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER property_id, ADD INDEX idx_property_flow (property_id,created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_account_entry' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE finance_account_entry ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER merchant_id, ADD COLUMN room_type_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER property_id, ADD INDEX idx_property_created (property_id,created_at)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_merchant_settle' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE finance_merchant_settle ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER merchant_id, ADD INDEX idx_property_status (property_id,status)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_merchant_settle' AND INDEX_NAME='uk_merchant_cycle')>0,
  'ALTER TABLE finance_merchant_settle DROP INDEX uk_merchant_cycle', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_merchant_settle' AND INDEX_NAME='uk_merchant_property_cycle')=0,
  'ALTER TABLE finance_merchant_settle ADD UNIQUE INDEX uk_merchant_property_cycle (merchant_id,property_id,settle_cycle)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Existing hotel orders are backfilled only through a room already carrying an explicit property mapping.
UPDATE order_main o
JOIN hotel_room_type r ON r.id=o.sku_id AND r.goods_id=o.goods_id AND r.site_id=o.site_id AND r.property_id>0
JOIN merchant_store p ON p.id=r.property_id AND p.site_id=o.site_id AND p.merchant_id=o.merchant_id AND p.deleted_at IS NULL
SET o.property_id=r.property_id,o.room_type_id=r.id
WHERE o.order_type=1 AND o.property_id=0 AND o.room_type_id=0;

UPDATE order_refund r
JOIN order_main o ON o.id=r.order_id AND o.order_type=1 AND o.property_id>0 AND o.room_type_id>0
SET r.property_id=o.property_id,r.room_type_id=o.room_type_id
WHERE r.property_id=0 AND r.room_type_id=0;

UPDATE finance_account_entry e
JOIN order_main o ON o.id=e.order_id AND o.order_type=1 AND o.property_id>0 AND o.room_type_id>0
SET e.property_id=o.property_id,e.room_type_id=o.room_type_id
WHERE e.property_id=0 AND e.room_type_id=0;

UPDATE finance_flow f
JOIN order_main o ON o.id=f.order_id AND o.order_type=1 AND o.property_id>0 AND o.room_type_id>0
SET f.property_id=o.property_id,f.room_type_id=o.room_type_id
WHERE f.property_id=0 AND f.room_type_id=0;
