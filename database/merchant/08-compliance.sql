-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / 模块08]:平台规则与合规(商户侧)
-- 设计源:docs/redesign/super-admin-portal/modules/08-platform-rules-compliance.md
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

-- 平台规则库
CREATE TABLE IF NOT EXISTS `platform_rule` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `title`       VARCHAR(200) NOT NULL COMMENT '规则标题',
  `category`    VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '类别(Booking/Listing/Operations/Pricing/Reviews/Finance/Compliance/Marketing)',
  `severity`    TINYINT      NOT NULL DEFAULT 3 COMMENT '严重度:1critical 2high 3medium 4low',
  `status`      TINYINT      NOT NULL DEFAULT 2 COMMENT '状态:1生效 2草稿 3归档',
  `applies`     VARCHAR(100) NOT NULL DEFAULT 'All Merchants' COMMENT '适用范围',
  `created_by`  VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '创建人(快照)',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='平台规则库';

-- 商户违规工单
CREATE TABLE IF NOT EXISTS `merchant_violation` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `merchant_name` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '商户名(快照)',
  `rule_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '规则ID',
  `rule_title`    VARCHAR(200) NOT NULL DEFAULT '' COMMENT '规则标题(快照)',
  `severity`      TINYINT      NOT NULL DEFAULT 3 COMMENT '严重度:1critical 2high 3medium 4low',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1未处理 2已解决',
  `action`        VARCHAR(100) NOT NULL DEFAULT '' COMMENT '处置动作文案',
  `assigned_to`   VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '处理人',
  `detected_date` DATE         NULL DEFAULT NULL COMMENT '发现日期',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户违规工单';

-- 商户警告
CREATE TABLE IF NOT EXISTS `merchant_warning` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `merchant_name` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '商户名(快照)',
  `reason`        VARCHAR(255) NOT NULL COMMENT '原因',
  `level`         TINYINT      NOT NULL DEFAULT 1 COMMENT '级别:1一级 2二级 3三级',
  `issued_by`     VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '签发人',
  `expires_at`    DATE         NULL DEFAULT NULL COMMENT '到期日',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1有效 2已撤销',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户警告';

-- 合规审计历史
CREATE TABLE IF NOT EXISTS `compliance_history` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL COMMENT '商户ID',
  `merchant_name` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '商户名(快照)',
  `event`         VARCHAR(255) NOT NULL DEFAULT '' COMMENT '事件',
  `result`        TINYINT      NOT NULL DEFAULT 1 COMMENT '结果:1通过 2警告 3不通过',
  `score`         INT          NOT NULL DEFAULT 0 COMMENT '评分(0-100)',
  `reviewer`      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '复核人',
  `event_date`    DATE         NULL DEFAULT NULL COMMENT '事件日期',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_merchant_id` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='合规审计历史';
