SET NAMES utf8mb4;
USE mtrip_business;

-- Batch C expands the property aggregate. Legacy hotel keys remain for rollback/audit.
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='country_code')=0,
  'ALTER TABLE merchant_store ADD COLUMN country_code CHAR(2) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='city_key')=0,
  'ALTER TABLE merchant_store ADD COLUMN city_key VARCHAR(80) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='description')=0,
  'ALTER TABLE merchant_store ADD COLUMN description TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='star_level')=0,
  'ALTER TABLE merchant_store ADD COLUMN star_level TINYINT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='facilities')=0,
  'ALTER TABLE merchant_store ADD COLUMN facilities JSON NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='website')=0,
  'ALTER TABLE merchant_store ADD COLUMN website VARCHAR(255) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='checkin_time')=0,
  'ALTER TABLE merchant_store ADD COLUMN checkin_time VARCHAR(20) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='checkout_time')=0,
  'ALTER TABLE merchant_store ADD COLUMN checkout_time VARCHAR(20) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='content_status')=0,
  'ALTER TABLE merchant_store ADD COLUMN content_status TINYINT NOT NULL DEFAULT 0 COMMENT ''0 draft,1 pending,2 approved,3 rejected''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='content_version')=0,
  'ALTER TABLE merchant_store ADD COLUMN content_version INT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='content_approved_version')=0,
  'ALTER TABLE merchant_store ADD COLUMN content_approved_version INT UNSIGNED NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='content_submitted_at')=0,
  'ALTER TABLE merchant_store ADD COLUMN content_submitted_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='content_approved_at')=0,
  'ALTER TABLE merchant_store ADD COLUMN content_approved_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='content_reject_reason')=0,
  'ALTER TABLE merchant_store ADD COLUMN content_reject_reason VARCHAR(500) NOT NULL DEFAULT ''''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='publish_status')=0,
  'ALTER TABLE merchant_store ADD COLUMN publish_status TINYINT NOT NULL DEFAULT 0 COMMENT ''0 unpublished,1 published,2 offline''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='published_at')=0,
  'ALTER TABLE merchant_store ADD COLUMN published_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_store' AND COLUMN_NAME='operating_status')=0,
  'ALTER TABLE merchant_store ADD COLUMN operating_status TINYINT NOT NULL DEFAULT 2 COMMENT ''1 operating,2 closed,3 platform suspended,4 archived''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE merchant_store SET operating_status=IF(status=1,1,2) WHERE operating_status=2 AND status=1;

CREATE TABLE IF NOT EXISTS merchant_property_content_revision (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT UNSIGNED NOT NULL,
  merchant_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  version INT UNSIGNED NOT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0 draft,1 pending,2 approved,3 rejected,4 withdrawn',
  payload_json JSON NOT NULL,
  reject_reason VARCHAR(500) NOT NULL DEFAULT '',
  submitted_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  submitted_at DATETIME NULL,
  reviewed_by BIGINT UNSIGNED NOT NULL DEFAULT 0,
  reviewed_at DATETIME NULL,
  review_remark VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_property_content_version (property_id,version),
  KEY idx_property_content_queue (site_id,status,submitted_at),
  KEY idx_property_content_history (merchant_id,property_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS hotel_property_legacy_map (
  goods_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  property_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  merchant_id BIGINT UNSIGNED NOT NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'explicit',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_legacy_property (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

DROP TEMPORARY TABLE IF EXISTS tmp_hotel_property_edge;
CREATE TEMPORARY TABLE tmp_hotel_property_edge (
  property_id BIGINT UNSIGNED NOT NULL,
  goods_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (property_id,goods_id),
  KEY idx_edge_goods (goods_id)
);
INSERT IGNORE INTO tmp_hotel_property_edge (property_id,goods_id)
SELECT l.property_id,l.goods_id
FROM ranking_listing l
JOIN merchant_store p ON p.id=l.property_id AND p.site_id=l.site_id AND p.merchant_id=l.merchant_id AND p.deleted_at IS NULL
JOIN goods_info g ON g.id=l.goods_id AND g.site_id=l.site_id AND g.merchant_id=l.merchant_id AND g.goods_type=1 AND g.deleted_at IS NULL
WHERE l.property_id>0 AND l.goods_id>0 AND l.deleted_at IS NULL
UNION ALL
SELECT x.store_id,x.goods_id
FROM merchant_store_goods x
JOIN merchant_store p ON p.id=x.store_id AND p.site_id=x.site_id AND p.merchant_id=x.merchant_id AND p.deleted_at IS NULL
JOIN goods_info g ON g.id=x.goods_id AND g.site_id=x.site_id AND g.merchant_id=x.merchant_id AND g.goods_type=1 AND g.deleted_at IS NULL
WHERE x.store_id>0 AND x.goods_id>0 AND x.deleted_at IS NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_hotel_goods_degree;
CREATE TEMPORARY TABLE tmp_hotel_goods_degree (
  goods_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  edge_count INT UNSIGNED NOT NULL
);
INSERT INTO tmp_hotel_goods_degree SELECT goods_id,COUNT(*) FROM tmp_hotel_property_edge GROUP BY goods_id;
DROP TEMPORARY TABLE IF EXISTS tmp_hotel_property_degree;
CREATE TEMPORARY TABLE tmp_hotel_property_degree (
  property_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  edge_count INT UNSIGNED NOT NULL
);
INSERT INTO tmp_hotel_property_degree SELECT property_id,COUNT(*) FROM tmp_hotel_property_edge GROUP BY property_id;

INSERT IGNORE INTO hotel_property_legacy_map (goods_id,property_id,site_id,merchant_id)
SELECT e.goods_id,e.property_id,p.site_id,p.merchant_id
FROM tmp_hotel_property_edge e
JOIN merchant_store p ON p.id=e.property_id AND p.deleted_at IS NULL
JOIN goods_info g ON g.id=e.goods_id AND g.goods_type=1 AND g.deleted_at IS NULL
JOIN tmp_hotel_goods_degree gd ON gd.goods_id=e.goods_id AND gd.edge_count=1
JOIN tmp_hotel_property_degree pd ON pd.property_id=e.property_id AND pd.edge_count=1
WHERE p.site_id=g.site_id AND p.merchant_id=g.merchant_id
;

SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE hotel_room_type ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER site_id, MODIFY goods_id BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD INDEX idx_property_id (property_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type_revision' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE hotel_room_type_revision ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER merchant_id, MODIFY goods_id BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD INDEX idx_property_revision (property_id,id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_daily_stock' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE goods_daily_stock ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER site_id, MODIFY goods_id BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD INDEX idx_property_stock (property_id,stock_date)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_refund_rule' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE goods_refund_rule ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER site_id, MODIFY goods_id BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD INDEX idx_property_refund (property_id,sku_type,sku_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_stock_log' AND COLUMN_NAME='property_id')=0,
  'ALTER TABLE goods_stock_log ADD COLUMN property_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER site_id, MODIFY goods_id BIGINT UNSIGNED NOT NULL DEFAULT 0, ADD INDEX idx_property_stock_log (property_id,sku_id,stock_date)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE hotel_room_type r JOIN hotel_property_legacy_map m ON m.goods_id=r.goods_id
SET r.property_id=m.property_id WHERE r.property_id=0;
UPDATE hotel_room_type_revision v JOIN hotel_room_type r ON r.id=v.room_id
SET v.property_id=r.property_id WHERE v.property_id=0 AND r.property_id>0;
UPDATE goods_daily_stock s JOIN hotel_property_legacy_map m ON m.goods_id=s.goods_id
SET s.property_id=m.property_id WHERE s.sku_type=1 AND s.property_id=0;
UPDATE goods_refund_rule r JOIN hotel_property_legacy_map m ON m.goods_id=r.goods_id
SET r.property_id=m.property_id WHERE r.sku_type IN (0,1) AND r.property_id=0;
UPDATE goods_stock_log l JOIN hotel_property_legacy_map m ON m.goods_id=l.goods_id
SET l.property_id=m.property_id WHERE l.sku_type=1 AND l.property_id=0;

UPDATE merchant_store p
JOIN hotel_property_legacy_map m ON m.property_id=p.id
JOIN goods_info g ON g.id=m.goods_id
SET p.description=COALESCE(g.goods_detail,g.goods_brief), p.star_level=g.star_level,
    p.facilities=g.facilities, p.images=COALESCE(p.images,g.images),
    p.checkin_time=g.open_time, p.checkout_time=g.close_time,
    p.content_status=IF(g.status=3,2,0),
    p.content_version=IF(g.status=3,1,0), p.content_approved_version=IF(g.status=3,1,0),
    p.publish_status=IF(g.status=3,1,0), p.published_at=IF(g.status=3,g.updated_at,NULL)
WHERE p.content_version=0;

DROP TEMPORARY TABLE IF EXISTS tmp_hotel_property_edge;
DROP TEMPORARY TABLE IF EXISTS tmp_hotel_goods_degree;
DROP TEMPORARY TABLE IF EXISTS tmp_hotel_property_degree;

INSERT IGNORE INTO merchant_menu
  (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort,account_scope)
VALUES
  (140004,1400,'编辑物业资料','Edit Property Profile','mch:properties:profile-edit',3,4,'1,2,3'),
  (140005,1400,'提交物业资料','Submit Property Profile','mch:properties:profile-submit',3,5,'1,2,3'),
  (140006,1400,'发布物业','Publish Property','mch:properties:publish',3,6,'1,2,3');
INSERT IGNORE INTO merchant_role_menu (role_id,menu_id)
SELECT rm.role_id,p.menu_id FROM merchant_role_menu rm
JOIN (SELECT 140004 menu_id UNION ALL SELECT 140005 UNION ALL SELECT 140006) p
WHERE rm.menu_id=1400;

USE mtrip_system;
INSERT IGNORE INTO sys_menu
  (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort)
VALUES (30116,301,'审核物业资料','Review Property Profile','merchant:property:content-audit',3,16);
