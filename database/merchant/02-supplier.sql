-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 业务表 02:供应商(业务模块2)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

-- 供应商表
CREATE TABLE IF NOT EXISTS `supplier_info` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`             BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `supplier_name`       VARCHAR(100) NOT NULL COMMENT '供应商名称',
  `supplier_short_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '供应商简称',
  `supplier_type`       TINYINT      NOT NULL DEFAULT 1 COMMENT '类型:1酒店批发商 2景区代理 3综合供应商',
  `credit_code`         VARCHAR(50)  NOT NULL COMMENT '统一社会信用代码',
  `business_license`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '营业执照图片URL',
  `contact_name`        VARCHAR(50)  NOT NULL COMMENT '联系人',
  `contact_phone`       VARCHAR(255) NOT NULL COMMENT '联系电话(加密)',
  `contact_email`       VARCHAR(100) NOT NULL DEFAULT '' COMMENT '联系邮箱',
  `share_rate`          DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '供货分成比例%',
  `settle_type`         TINYINT      NOT NULL DEFAULT 2 COMMENT '结算方式:1预付 2月结 3季结',
  `bank_name`           VARCHAR(100) NOT NULL DEFAULT '' COMMENT '结算银行名称',
  `account_name`        VARCHAR(100) NOT NULL DEFAULT '' COMMENT '结算户名',
  `account_no`          VARCHAR(255) NOT NULL DEFAULT '' COMMENT '结算账号(加密)',
  `contract_file`       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '合作协议电子版URL',
  `status`              TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待审核 1已合作 2已暂停 3已终止',
  `coop_start_at`       DATETIME     NULL DEFAULT NULL COMMENT '合作开始时间',
  `coop_end_at`         DATETIME     NULL DEFAULT NULL COMMENT '合作结束时间',
  `remark`              VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`          DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_credit_code` (`credit_code`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='供应商表';

-- 供应商供货商品表
CREATE TABLE IF NOT EXISTS `supplier_goods` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `supplier_id`   BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  `goods_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '平台商品ID(goods_info)',
  `goods_name`    VARCHAR(200) NOT NULL COMMENT '供货商品名称',
  `goods_type`    TINYINT      NOT NULL DEFAULT 1 COMMENT '类型:1酒店 2门票',
  `supply_price`  DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '供应商底价',
  `retail_price`  DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '建议零售价',
  `sync_type`     TINYINT      NOT NULL DEFAULT 2 COMMENT '库存同步方式:1API实时 2手动导入 3定时同步',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1供货中 2已停供',
  `remark`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_supplier_id` (`supplier_id`),
  KEY `idx_goods_id` (`goods_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='供应商供货商品表';

-- 供应商结算账单表(按月生成)
CREATE TABLE IF NOT EXISTS `supplier_settle` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `settle_no`     VARCHAR(32)  NOT NULL COMMENT '账单编号(唯一)',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `supplier_id`   BIGINT UNSIGNED NOT NULL COMMENT '供应商ID',
  `settle_month`  VARCHAR(7)   NOT NULL COMMENT '账期(YYYY-MM)',
  `order_count`   INT          NOT NULL DEFAULT 0 COMMENT '结算订单数',
  `supply_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '供货总额',
  `share_amount`  DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '分成金额',
  `settle_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应结金额',
  `status`        TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待审核 1已审核 2已回款 3已驳回',
  `audit_by`      BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '审核人ID',
  `audit_time`    DATETIME     NULL DEFAULT NULL COMMENT '审核时间',
  `pay_time`      DATETIME     NULL DEFAULT NULL COMMENT '回款时间',
  `pay_voucher`   VARCHAR(255) NOT NULL DEFAULT '' COMMENT '回款凭证URL',
  `remark`        VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_settle_no` (`settle_no`),
  UNIQUE KEY `uk_supplier_month` (`supplier_id`, `settle_month`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='供应商结算账单表';
