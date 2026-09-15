USE `mtrip_business`;

-- Batch F moves hotel discovery, favorites, reviews and marketing scopes to Property.
-- Legacy hotel keys stay in place until Batch G and are used only for deterministic backfill.
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_favorite' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE user_favorite ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER user_id, MODIFY goods_id BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD INDEX idx_property_user (property_id,user_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE user_favorite f
JOIN hotel_property_legacy_map m ON m.goods_id=f.goods_id AND m.site_id=f.site_id
SET f.property_id=m.property_id
WHERE f.property_id=0 AND f.goods_id>0;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_favorite' AND INDEX_NAME='uk_user_goods')>0,
  'ALTER TABLE user_favorite DROP INDEX uk_user_goods', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_favorite' AND INDEX_NAME='uk_user_target')=0,
  'ALTER TABLE user_favorite ADD UNIQUE INDEX uk_user_target (site_id,user_id,property_id,goods_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_review' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE goods_review ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER site_id, MODIFY goods_id BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD INDEX idx_property_status (site_id,property_id,status)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- An attributed hotel order is the strongest review mapping because the review already references it.
UPDATE goods_review r
JOIN order_main o ON o.id=r.order_id AND o.site_id=r.site_id AND o.user_id=r.user_id
  AND o.order_type=1 AND o.property_id>0
SET r.property_id=o.property_id
WHERE r.property_id=0;
UPDATE goods_review r
JOIN hotel_property_legacy_map m ON m.goods_id=r.goods_id AND m.site_id=r.site_id
SET r.property_id=m.property_id
WHERE r.property_id=0 AND r.goods_id>0;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_coupon' AND COLUMN_NAME='property_ids')=0,
  'ALTER TABLE marketing_coupon ADD COLUMN property_ids JSON NULL AFTER goods_ids', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_coupon' AND COLUMN_NAME='room_type_ids')=0,
  'ALTER TABLE marketing_coupon ADD COLUMN room_type_ids JSON NULL AFTER sku_ids', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Preserve ticket IDs while copying only explicitly mapped hotel IDs into the new hotel scope.
UPDATE marketing_coupon c
SET c.property_ids=(
  SELECT JSON_ARRAYAGG(m.property_id)
  FROM JSON_TABLE(COALESCE(c.goods_ids,JSON_ARRAY()), '$[*]' COLUMNS (goods_id BIGINT PATH '$')) j
  JOIN hotel_property_legacy_map m ON m.goods_id=j.goods_id AND m.site_id=c.site_id
)
WHERE c.property_ids IS NULL AND c.goods_ids IS NOT NULL;
UPDATE marketing_coupon c
SET c.room_type_ids=(
  SELECT JSON_ARRAYAGG(r.id)
  FROM JSON_TABLE(COALESCE(c.sku_ids,JSON_ARRAY()), '$[*]' COLUMNS (room_type_id BIGINT PATH '$')) j
  JOIN hotel_room_type r ON r.id=j.room_type_id AND r.site_id=c.site_id AND r.property_id>0
)
WHERE c.room_type_ids IS NULL AND c.sku_ids IS NOT NULL;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_activity_goods' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE marketing_activity_goods ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER site_id, MODIFY goods_id BIGINT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_activity_goods' AND COLUMN_NAME='room_type_id')=0,
  'ALTER TABLE marketing_activity_goods ADD COLUMN room_type_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER sku_id', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_activity_goods' AND INDEX_NAME='idx_property_room')=0,
  'ALTER TABLE marketing_activity_goods ADD INDEX idx_property_room (property_id,room_type_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE marketing_activity_goods a
JOIN hotel_property_legacy_map m ON m.goods_id=a.goods_id AND m.site_id=a.site_id
LEFT JOIN hotel_room_type r ON r.id=a.sku_id AND r.property_id=m.property_id AND r.site_id=a.site_id
SET a.property_id=m.property_id,
    a.room_type_id=IF(a.sku_type=1 AND r.id IS NOT NULL,r.id,0)
WHERE a.property_id=0 AND a.goods_id>0 AND a.sku_type IN (0,1);

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_activity_goods' AND INDEX_NAME='uk_activity_sku')>0,
  'ALTER TABLE marketing_activity_goods DROP INDEX uk_activity_sku', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Existing listing snapshots are rewritten in place so runtime publication contains no hotel goods keys.
UPDATE ranking_market m
SET m.published_json=(
  SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
    'id',j.config_id,'property_id',j.config_property_id,'rank',j.config_rank,
    'pinned',j.config_pinned,'featured',j.config_featured,'status',j.config_status
  )),JSON_ARRAY())
  FROM JSON_TABLE(COALESCE(m.published_json,JSON_ARRAY()), '$[*]' COLUMNS (
    config_id BIGINT PATH '$.id', config_property_id BIGINT PATH '$.property_id', config_rank INT PATH '$.rank',
    config_pinned TINYINT PATH '$.pinned' DEFAULT '0' ON EMPTY,
    config_featured TINYINT PATH '$.featured' DEFAULT '0' ON EMPTY,
    config_status TINYINT PATH '$.status' DEFAULT '1' ON EMPTY
  )) j
  WHERE j.config_property_id>0
)
WHERE m.entity_type='listing' AND m.published_json IS NOT NULL;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='marketing_activity_goods' AND INDEX_NAME='uk_activity_target')=0,
  'ALTER TABLE marketing_activity_goods ADD UNIQUE INDEX uk_activity_target (activity_id,property_id,goods_id,sku_type,room_type_id,sku_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
