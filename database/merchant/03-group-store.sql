-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 业务表 03:商户集团 + 商户门店(计划 11-集团与门店模块)
-- 库:mtrip_business
-- 层级:站点 → 集团(可选,授权绑定) → 商户(签约/结算主体) → 门店(履约/核销单元)
-- 本脚本幂等:可在全新与存量环境重复执行
-- ============================================================
USE `mtrip_business`;

-- 集团表(管理/授权实体,不签约不结算;商户通过 merchant_info.group_id 授权绑定)
CREATE TABLE IF NOT EXISTS `merchant_group` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局',
  `group_name`       VARCHAR(100) NOT NULL COMMENT '集团名称',
  `group_short_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '集团简称',
  `logo`             VARCHAR(255) NOT NULL DEFAULT '' COMMENT '集团Logo',
  `contact_name`     VARCHAR(50)  NOT NULL COMMENT '联系人姓名',
  `contact_phone`    VARCHAR(255) NOT NULL COMMENT '联系人手机号(加密)',
  `contact_email`    VARCHAR(100) NOT NULL DEFAULT '' COMMENT '联系人邮箱',
  `status`           TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `remark`           VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`       DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户集团表';

-- 门店表(履约/核销单元;结算主体仍在商户,需独立结算的门店应注册为独立商户)
CREATE TABLE IF NOT EXISTS `merchant_store` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`      BIGINT UNSIGNED NOT NULL COMMENT '所属商户ID',
  `store_name`       VARCHAR(100) NOT NULL COMMENT '门店名称',
  `contact_name`     VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '门店联系人',
  `contact_phone`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '联系电话(加密)',
  `address`          VARCHAR(255) NOT NULL DEFAULT '' COMMENT '门店地址',
  `longitude`        DECIMAL(10,7) NULL DEFAULT NULL COMMENT '经度',
  `latitude`         DECIMAL(10,7) NULL DEFAULT NULL COMMENT '纬度',
  `business_license` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '门店营业执照URL(独立办照时填写)',
  `business_hours`   VARCHAR(100) NOT NULL DEFAULT '' COMMENT '营业时间(如 09:00-22:00)',
  `images`           JSON         NULL COMMENT '门店照片',
  `is_main`          TINYINT      NOT NULL DEFAULT 0 COMMENT '是否主门店:0否 1是(商户审核通过自动创建)',
  `status`           TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1营业 2停业',
  `remark`           VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`       DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户门店表';

-- ---------- 存量库幂等加列(全新安装 01-merchant.sql 已含,以下探测跳过) ----------
-- merchant_info.group_id
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_info' AND COLUMN_NAME = 'group_id');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_info` ADD COLUMN `group_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''所属集团ID(merchant_group),0=独立商户'' AFTER `site_id`, ADD KEY `idx_group_id` (`group_id`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- merchant_admin.group_id(merchant_id=0 且 group_id>0 为集团账号)
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_admin' AND COLUMN_NAME = 'group_id');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `merchant_admin` MODIFY COLUMN `merchant_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''商户ID,0=集团账号'', ADD COLUMN `group_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''所属集团ID,>0且merchant_id=0为集团账号'' AFTER `merchant_id`, ADD KEY `idx_group_id` (`group_id`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 存量已审核商户回填主门店(一商户一门店场景无感升级) ----------
INSERT INTO `merchant_store`
  (`site_id`, `merchant_id`, `store_name`, `contact_name`, `contact_phone`, `address`, `longitude`, `latitude`, `is_main`, `status`)
SELECT m.`site_id`, m.`id`, m.`merchant_name`, m.`contact_name`, m.`contact_phone`, m.`address`, m.`longitude`, m.`latitude`, 1,
       IF(m.`status` = 3, 1, 2)
FROM `merchant_info` m
WHERE m.`deleted_at` IS NULL AND m.`status` IN (3, 4)
  AND NOT EXISTS (SELECT 1 FROM `merchant_store` s WHERE s.`merchant_id` = m.`id` AND s.`deleted_at` IS NULL);
