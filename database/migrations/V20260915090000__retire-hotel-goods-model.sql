USE `mtrip_business`;

-- G batch may only run after every live hotel good has an explicit one-to-one Property mapping.
SET @unmapped_hotel_goods := (
  SELECT COUNT(*)
  FROM goods_info g
  LEFT JOIN hotel_property_legacy_map m ON m.goods_id=g.id
  WHERE g.goods_type=1 AND g.deleted_at IS NULL AND m.goods_id IS NULL
);
SET @invalid_hotel_maps := (
  SELECT COUNT(*)
  FROM hotel_property_legacy_map m
  LEFT JOIN goods_info g ON g.id=m.goods_id AND g.goods_type=1
  LEFT JOIN merchant_store p ON p.id=m.property_id AND p.business_type='hotel'
  WHERE g.id IS NOT NULL AND (
    p.id IS NULL OR g.site_id<>m.site_id OR p.site_id<>m.site_id
    OR g.merchant_id<>m.merchant_id OR p.merchant_id<>m.merchant_id
  )
);
SET @unmapped_hotel_orders := (
  SELECT COUNT(*) FROM order_main
  WHERE order_type=1 AND (property_id=0 OR room_type_id=0) AND deleted_at IS NULL
);

SET @has_room_goods := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='goods_id'
);
SET @ddl := IF(@has_room_goods=1,
  'SELECT COUNT(*) INTO @unmapped_rooms FROM hotel_room_type WHERE goods_id>0 AND property_id=0 AND deleted_at IS NULL',
  'SET @unmapped_rooms=0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_revision_goods := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type_revision' AND COLUMN_NAME='goods_id'
);
SET @ddl := IF(@has_revision_goods=1,
  'SELECT COUNT(*) INTO @unmapped_revisions FROM hotel_room_type_revision WHERE goods_id>0 AND property_id=0',
  'SET @unmapped_revisions=0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_ranking_goods := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ranking_listing' AND COLUMN_NAME='goods_id'
);
SET @ddl := IF(@has_ranking_goods=1,
  'SELECT COUNT(*) INTO @unmapped_rankings FROM ranking_listing WHERE goods_id>0 AND (property_id IS NULL OR property_id=0) AND deleted_at IS NULL',
  'SET @unmapped_rankings=0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

DROP PROCEDURE IF EXISTS assert_hotel_goods_retirement_ready;
DELIMITER $$
CREATE PROCEDURE assert_hotel_goods_retirement_ready()
BEGIN
  IF @unmapped_hotel_goods>0 OR @invalid_hotel_maps>0 OR @unmapped_hotel_orders>0
     OR @unmapped_rooms>0 OR @unmapped_revisions>0 OR @unmapped_rankings>0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='Hotel goods retirement gate failed; run scripts/audit-hotel-property-mapping.sh and resolve every mapping first';
  END IF;
END$$
DELIMITER ;
CALL assert_hotel_goods_retirement_ready();
DROP PROCEDURE IF EXISTS assert_hotel_goods_retirement_ready;

-- Keep an immutable copy for audit before removing the duplicated hotel entity.
CREATE TABLE IF NOT EXISTS hotel_goods_archive LIKE goods_info;
SET @ddl := IF((
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_goods_archive' AND COLUMN_NAME='archived_at'
)=0, 'ALTER TABLE hotel_goods_archive ADD COLUMN archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
INSERT IGNORE INTO hotel_goods_archive SELECT g.*, NOW() FROM goods_info g WHERE g.goods_type=1;

-- Shared tables retain their ticket keys; hotel rows use Property and room type keys only.
UPDATE goods_daily_stock SET goods_id=0 WHERE sku_type=1;
UPDATE goods_refund_rule SET goods_id=0 WHERE property_id>0 AND sku_type IN (0,1);
UPDATE goods_stock_log SET goods_id=0 WHERE sku_type=1;
UPDATE order_main SET goods_id=0,sku_id=0 WHERE order_type=1;
UPDATE goods_review SET goods_id=0 WHERE property_id>0;
UPDATE user_favorite SET goods_id=0 WHERE property_id>0;
UPDATE marketing_activity_goods SET goods_id=0,sku_id=0 WHERE property_id>0;

DELETE x FROM merchant_store_goods x JOIN goods_info g ON g.id=x.goods_id AND g.goods_type=1;
DELETE x FROM supplier_goods x JOIN goods_info g ON g.id=x.goods_id AND g.goods_type=1;
DELETE FROM goods_category WHERE goods_type=1;
DELETE FROM goods_info WHERE goods_type=1;

SET @ddl := IF((
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND INDEX_NAME='idx_goods_id'
)>0, 'ALTER TABLE hotel_room_type DROP INDEX idx_goods_id', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@has_room_goods=1, 'ALTER TABLE hotel_room_type DROP COLUMN goods_id', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type_revision' AND INDEX_NAME='idx_goods'
)>0, 'ALTER TABLE hotel_room_type_revision DROP INDEX idx_goods', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@has_revision_goods=1, 'ALTER TABLE hotel_room_type_revision DROP COLUMN goods_id', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ranking_listing' AND INDEX_NAME='uk_goods'
)>0, 'ALTER TABLE ranking_listing DROP INDEX uk_goods', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF(@has_ranking_goods=1, 'ALTER TABLE ranking_listing DROP COLUMN goods_id', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ranking_listing' AND COLUMN_NAME='business_id'
)=1, 'ALTER TABLE ranking_listing DROP COLUMN business_id', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Remove the retired admin entry and keep the merchant entry explicit about tickets.
DELETE FROM mtrip_system.sys_role_menu WHERE menu_id IN (1501,150101,150102);
DELETE FROM mtrip_system.sys_menu WHERE id IN (150101,150102,1501);
INSERT IGNORE INTO mtrip_system.sys_menu
  (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort)
VALUES
  (150201,1502,'新增门票','Add','goods:ticket:add',3,1),
  (150202,1502,'编辑门票','Edit','goods:ticket:edit',3,2),
  (150203,1502,'删除门票','Delete','goods:ticket:delete',3,3),
  (150204,1502,'管理票种','Manage Ticket Types','goods:ticket:type',3,4),
  (150301,1503,'新增分类','Add Category','goods:category:add',3,1),
  (150302,1503,'编辑分类','Edit Category','goods:category:edit',3,2),
  (150303,1503,'删除分类','Delete Category','goods:category:delete',3,3),
  (150501,1505,'审核商品','Audit','goods:audit:audit',3,1),
  (150502,1505,'强制下架','Force Off Shelf','goods:audit:off',3,2);
UPDATE merchant_menu
SET menu_name='门票商品',menu_name_en='Ticket Products'
WHERE id=500 AND perm_key='mch:goods:list';
