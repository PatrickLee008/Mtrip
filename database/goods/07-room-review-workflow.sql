USE `mtrip_business`;

-- 房型审核版本:正式表保存当前生效投影,本表保存草稿/提交/审批历史。
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='currency');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `currency` CHAR(3) NOT NULL DEFAULT ''THB'' COMMENT ''币种'' AFTER `cancellation_policy`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hotel_room_type' AND COLUMN_NAME='approved_version');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `hotel_room_type` ADD COLUMN `approved_version` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''当前已生效版本号,0=从未发布'' AFTER `submitted_at`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 存量系统没有真实房型审核流:已上架酒店下的旧房型视为既有线上版本。
UPDATE `hotel_room_type` r
JOIN `goods_info` g ON g.id = r.goods_id
SET r.`publish_status` = 2
WHERE g.`status` = 3 AND r.`publish_status` = 0 AND r.`deleted_at` IS NULL;

UPDATE `hotel_room_type`
SET `approved_version` = 1
WHERE `publish_status` = 2 AND `approved_version` = 0;

CREATE TABLE IF NOT EXISTS `hotel_room_type_revision` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '修订主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`    BIGINT UNSIGNED NOT NULL COMMENT '所属商户ID',
  `goods_id`       BIGINT UNSIGNED NOT NULL COMMENT '所属酒店商品ID',
  `room_id`        BIGINT UNSIGNED NOT NULL COMMENT '房型ID',
  `version`        INT UNSIGNED NOT NULL COMMENT '房型版本号',
  `action`         VARCHAR(20) NOT NULL DEFAULT 'upsert' COMMENT '动作:upsert/delete',
  `status`         TINYINT NOT NULL DEFAULT 0 COMMENT '0草稿 1待审核 2通过 3驳回 4撤销',
  `payload_json`   JSON NOT NULL COMMENT '完整房型字段快照',
  `reject_reason`  VARCHAR(500) NOT NULL DEFAULT '' COMMENT '驳回原因',
  `submitted_by`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '提交商户账号ID',
  `submitted_at`   DATETIME NULL DEFAULT NULL COMMENT '提交时间',
  `reviewed_by`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '审核管理员ID',
  `reviewed_at`    DATETIME NULL DEFAULT NULL COMMENT '审核时间',
  `review_remark`  VARCHAR(500) NOT NULL DEFAULT '' COMMENT '审核意见',
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_room_version` (`room_id`,`version`),
  KEY `idx_review_queue` (`site_id`,`status`,`submitted_at`),
  KEY `idx_merchant_room` (`merchant_id`,`room_id`,`id`),
  KEY `idx_goods` (`goods_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='酒店房型草稿及审核版本';
