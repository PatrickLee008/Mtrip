-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 业务表 01:商户(文档 5.2.1 + 业务模块1)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

-- 商户表(严格按文档 5.2.1)
CREATE TABLE IF NOT EXISTS `merchant_info` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`             BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局',
  `group_id`            BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属集团ID(merchant_group),0=独立商户',
  `merchant_name`       VARCHAR(100) NOT NULL COMMENT '商户全称',
  `merchant_short_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '商户简称(C端展示名)',
  `merchant_type`       TINYINT      NOT NULL DEFAULT 1 COMMENT '类型:1酒店 2景区 3综合',
  `credit_code`         VARCHAR(50)  NOT NULL COMMENT '统一社会信用代码',
  `business_license`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '营业执照图片URL',
  `legal_person`        VARCHAR(50)  NOT NULL COMMENT '法人姓名',
  `legal_id_card`       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '法人身份证号(加密)',
  `legal_id_images`     JSON         NULL COMMENT '法人身份证正反面照片',
  `contact_name`        VARCHAR(50)  NOT NULL COMMENT '联系人姓名',
  `contact_phone`       VARCHAR(255) NOT NULL COMMENT '联系人手机号(加密)',
  `contact_email`       VARCHAR(100) NOT NULL DEFAULT '' COMMENT '联系人邮箱',
  `address`             VARCHAR(255) NOT NULL DEFAULT '' COMMENT '商户地址',
  `longitude`           DECIMAL(10,7) NULL DEFAULT NULL COMMENT '经度',
  `latitude`            DECIMAL(10,7) NULL DEFAULT NULL COMMENT '纬度',
  `commission_rate`     DECIMAL(5,2) NOT NULL DEFAULT 10.00 COMMENT '平台抽佣比例%',
  `settlement_cycle`    TINYINT      NOT NULL DEFAULT 7 COMMENT '结算周期天数(T+7/T+15/30月结)',
  `status`              TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待审核 1审核通过 2审核驳回 3已启用 4已禁用 5已注销',
  `audit_remark`        VARCHAR(500) NOT NULL DEFAULT '' COMMENT '审核备注',
  `audit_by`            BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '审核人ID',
  `audit_time`          DATETIME     NULL DEFAULT NULL COMMENT '审核时间',
  `logo`                VARCHAR(255) NOT NULL DEFAULT '' COMMENT '商户Logo',
  `cover_image`         VARCHAR(255) NOT NULL DEFAULT '' COMMENT '封面图',
  `last_login_at`       DATETIME     NULL DEFAULT NULL COMMENT '最后登录时间',
  `remark`              VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`          DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_credit_code` (`credit_code`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_group_id` (`group_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户表';

-- 商户结算账户表(支持多账户,账号加密存储)
CREATE TABLE IF NOT EXISTS `merchant_account` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`  BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `bank_name`    VARCHAR(100) NOT NULL COMMENT '银行名称',
  `account_name` VARCHAR(100) NOT NULL COMMENT '户名',
  `account_no`   VARCHAR(255) NOT NULL COMMENT '银行账号(加密)',
  `swift_code`   VARCHAR(20)  NOT NULL DEFAULT '' COMMENT 'SWIFT Code',
  `currency`     VARCHAR(10)  NOT NULL DEFAULT 'EUR' COMMENT '结算货币',
  `is_default`   TINYINT      NOT NULL DEFAULT 0 COMMENT '是否默认账户:0否 1是',
  `status`       TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `remark`       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户结算账户表';

-- 商户子账号表(商户后台操作员)
CREATE TABLE IF NOT EXISTS `merchant_admin` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '商户ID,0=集团账号',
  `group_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属集团ID,>0且merchant_id=0为集团账号',
  `username`      VARCHAR(50)  NOT NULL COMMENT '登录账号',
  `password`      VARCHAR(255) NOT NULL COMMENT '登录密码(bcrypt)',
  `real_name`     VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '姓名',
  `mobile`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '手机号(加密)',
  `is_owner`      TINYINT      NOT NULL DEFAULT 0 COMMENT '是否商户主账号:0否 1是',
  `role_perms`    JSON         NULL COMMENT '商户后台菜单/按钮权限集合',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `last_login_at` DATETIME     NULL DEFAULT NULL COMMENT '最后登录时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_group_id` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户子账号表';
