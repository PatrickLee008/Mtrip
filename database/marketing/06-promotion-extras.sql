-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / 模块05]:促销独立实体 代金券/促销码/新客奖励
-- 设计源:docs/redesign/super-admin-portal/modules/05-campaign-promotion.md
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

-- 代金券
CREATE TABLE IF NOT EXISTS `marketing_voucher` (
  `id`                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`                BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `name`                   VARCHAR(100) NOT NULL COMMENT '名称',
  `campaign_id`            BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联活动ID(0=独立)',
  `voucher_type`           VARCHAR(20)  NOT NULL DEFAULT 'fixed' COMMENT '类型:fixed/percentage/free_night/upgrade',
  `value`                  DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '面值',
  `value_display`          VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '面值展示',
  `status`                 TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1生效 2暂停 3过期 4待生效 5草稿',
  `start_date`             DATE         NULL DEFAULT NULL COMMENT '开始日期',
  `end_date`               DATE         NULL DEFAULT NULL COMMENT '结束日期',
  `quantity`               BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '发行量',
  `claimed`                BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已领取',
  `redeemed`               BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已核销',
  `min_spend`              BIGINT       NOT NULL DEFAULT 0 COMMENT '最低消费(最小货币单位)',
  `per_user_limit`         INT          NOT NULL DEFAULT 0 COMMENT '每人限领(0=不限)',
  `total_redemption_limit` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '总核销上限(0=不限)',
  `merchant_scope`         VARCHAR(10)  NOT NULL DEFAULT 'all' COMMENT '适用商户:all/selected',
  `merchant_count`         INT          NOT NULL DEFAULT 0 COMMENT '适用商户数',
  `created_by`             VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '创建人(快照)',
  `created_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`             DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='代金券';

-- 促销码
CREATE TABLE IF NOT EXISTS `marketing_promo_code` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `code`             VARCHAR(50)  NOT NULL COMMENT '促销码',
  `name`             VARCHAR(100) NOT NULL DEFAULT '' COMMENT '名称',
  `campaign_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联活动ID',
  `discount_type`    VARCHAR(20)  NOT NULL DEFAULT 'percentage' COMMENT '类型:percentage/fixed/free_night/cashback',
  `discount_value`   DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '折扣值',
  `discount_display` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '折扣展示',
  `status`           TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1生效 2暂停 3过期 4待生效 5草稿',
  `start_date`       DATE         NULL DEFAULT NULL COMMENT '开始日期',
  `end_date`         DATE         NULL DEFAULT NULL COMMENT '结束日期',
  `usage_limit`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '总用量上限(0=不限)',
  `usage_count`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已用量',
  `per_user_limit`   INT          NOT NULL DEFAULT 0 COMMENT '每人限用',
  `min_spend`        BIGINT       NOT NULL DEFAULT 0 COMMENT '最低消费(最小货币单位)',
  `stackable`        TINYINT      NOT NULL DEFAULT 0 COMMENT '是否可叠加:0否 1是',
  `merchant_scope`   VARCHAR(10)  NOT NULL DEFAULT 'all' COMMENT '适用商户:all/selected',
  `merchant_count`   INT          NOT NULL DEFAULT 0 COMMENT '适用商户数',
  `created_by`       VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '创建人(快照)',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`       DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='促销码';

-- 新客欢迎奖励
CREATE TABLE IF NOT EXISTS `marketing_welcome_reward` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`             BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `name`                VARCHAR(100) NOT NULL COMMENT '名称',
  `reward_type`         VARCHAR(20)  NOT NULL DEFAULT 'new_user' COMMENT '类型:new_user/first_booking/registration',
  `discount_type`       VARCHAR(20)  NOT NULL DEFAULT 'fixed' COMMENT '折扣类型:percentage/fixed/free_night/cashback',
  `discount_value`      DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '折扣值',
  `discount_display`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '折扣展示',
  `status`              TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1生效 2暂停 3草稿',
  `validity_days`       INT          NOT NULL DEFAULT 30 COMMENT '有效天数',
  `usage_limit`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '发放上限',
  `usage_count`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已发放',
  `min_spend`           BIGINT       NOT NULL DEFAULT 0 COMMENT '最低消费(最小货币单位)',
  `new_users_converted` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '转化新客数',
  `revenue`             BIGINT       NOT NULL DEFAULT 0 COMMENT '带来营收(最小货币单位)',
  `created_by`          VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '创建人(快照)',
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`          DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='新客欢迎奖励';
