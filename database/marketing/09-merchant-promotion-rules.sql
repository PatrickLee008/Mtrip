-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Merchant PRD v1.0 / Module 8 促销与活动管理]
-- 设计源:Figma file `fsK2rrl2sadcowrxspvGV8` SECTION `2285:21516`「Promotion tables」
--
-- 四件事:
--   1) `marketing_coupon` 补商家促销的「呈现形态」与规则列。
--      ⚠ 刻意**不动** `coupon_type` —— 它是下游计价轴(order-service `PricingService` 把
--      `coupon_type=2` 的 `discount_value` 当折扣率读,`SettlementService` 据此分摊出资),
--      而稿面的 3 个 Tab 混了「面额轴(百分比/固定金额)」和「是否需券码」两个维度,
--      无法用 `coupon_type` 表达。故另立 `promotion_kind` 只做展示分组,换算在 API 层收口:
--        Percentage 15% Off → coupon_type=2, discount_value=8.50(用户付 85%)
--        Fixed MMK 5,000 Off → coupon_type=1, discount_value=5000
--        Long Stay 10% Off   → coupon_type=2 + min_nights
--      这样计价与结算链路零改动。
--   2) `marketing_campaign` 补「出资模式 / 参与资格 / 活动条款 / 邀请方式」,
--      让商户端能展示平台活动的资格与条款(平台侧 Admin/CampaignController 同步接收这些入参)。
--   3) 新表 `marketing_campaign_participant`:商户 ↔ 平台活动的参与关系(接受/拒绝邀请)。
--   4) 新表 `marketing_promotion_impression`:曝光埋点,**按日聚合**(不做行级流水,
--      避免 C 端每次列表渲染写一行)。转化率 = 领券量 / 曝光量。
--
-- 库:mtrip_business
-- 幂等:全部先查 information_schema,已存在则跳过;可重复执行。
-- ============================================================
USE `mtrip_business`;

-- ---- 1. marketing_coupon.description:卡面描述(稿面卡片正文) ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_coupon'
        AND COLUMN_NAME = 'description'
    ),
    'DO 0',
    'ALTER TABLE `marketing_coupon` ADD COLUMN `description` VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''卡面描述(稿面卡片正文)'' AFTER `coupon_name`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 2. marketing_coupon.promotion_kind:商家促销呈现形态(仅做 Tab 分组) ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_coupon'
        AND COLUMN_NAME = 'promotion_kind'
    ),
    'DO 0',
    'ALTER TABLE `marketing_coupon` ADD COLUMN `promotion_kind` TINYINT NOT NULL DEFAULT 0 COMMENT ''促销形态:0未分类(存量/平台券) 1百分比 2固定金额 3优惠码 4长住'' AFTER `coupon_type`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 3. marketing_coupon.promo_code:优惠码(promotion_kind=3) ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_coupon'
        AND COLUMN_NAME = 'promo_code'
    ),
    'DO 0',
    'ALTER TABLE `marketing_coupon` ADD COLUMN `promo_code` VARCHAR(32) NOT NULL DEFAULT '''' COMMENT ''优惠码(promotion_kind=3 必填,同一站点内唯一)'' AFTER `promotion_kind`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_coupon'
        AND INDEX_NAME = 'idx_site_promo_code'
    ),
    'DO 0',
    'ALTER TABLE `marketing_coupon` ADD KEY `idx_site_promo_code` (`site_id`, `promo_code`)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 4. marketing_coupon.staff_note:内部员工备注(与面向客人的 remark=条款 分开) ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_coupon'
        AND COLUMN_NAME = 'staff_note'
    ),
    'DO 0',
    'ALTER TABLE `marketing_coupon` ADD COLUMN `staff_note` VARCHAR(500) NOT NULL DEFAULT '''' COMMENT ''内部员工备注(稿面 Internal Staff Notes,不对客人展示)'' AFTER `remark`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 5. 长住 / 提前预订规则列 ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_coupon'
        AND COLUMN_NAME = 'min_nights'
    ),
    'DO 0',
    'ALTER TABLE `marketing_coupon` ADD COLUMN `min_nights` INT NOT NULL DEFAULT 0 COMMENT ''长住促销最低入住晚数(promotion_kind=4 必填,0=不限)'' AFTER `per_user_limit`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_coupon'
        AND COLUMN_NAME = 'max_nights'
    ),
    'DO 0',
    'ALTER TABLE `marketing_coupon` ADD COLUMN `max_nights` INT NOT NULL DEFAULT 0 COMMENT ''适用入住时长上限(0=不限)'' AFTER `min_nights`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_coupon'
        AND COLUMN_NAME = 'book_advance_days'
    ),
    'DO 0',
    'ALTER TABLE `marketing_coupon` ADD COLUMN `book_advance_days` INT NOT NULL DEFAULT 0 COMMENT ''提前预订优惠:需提前 N 天预订(0=不限制)'' AFTER `max_nights`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 6. marketing_campaign:出资模式 / 参与资格 / 活动条款 / 邀请方式 ----
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_campaign'
        AND COLUMN_NAME = 'funding_source'
    ),
    'DO 0',
    'ALTER TABLE `marketing_campaign` ADD COLUMN `funding_source` TINYINT NOT NULL DEFAULT 1 COMMENT ''出资方:1平台 2商户 3合作方 4共担'' AFTER `coupon_ids`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_campaign'
        AND COLUMN_NAME = 'funding_rules'
    ),
    'DO 0',
    'ALTER TABLE `marketing_campaign` ADD COLUMN `funding_rules` JSON NULL COMMENT ''共担比例{mtrip,merchant,partner}百分比(funding_source=4)'' AFTER `funding_source`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_campaign'
        AND COLUMN_NAME = 'requirements'
    ),
    'DO 0',
    'ALTER TABLE `marketing_campaign` ADD COLUMN `requirements` VARCHAR(1000) NOT NULL DEFAULT '''' COMMENT ''参与资格要求(商户端活动详情展示)'' AFTER `funding_rules`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_campaign'
        AND COLUMN_NAME = 'terms'
    ),
    'DO 0',
    'ALTER TABLE `marketing_campaign` ADD COLUMN `terms` VARCHAR(1000) NOT NULL DEFAULT '''' COMMENT ''活动条款'' AFTER `requirements`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'mtrip_business'
        AND TABLE_NAME = 'marketing_campaign'
        AND COLUMN_NAME = 'invite_mode'
    ),
    'DO 0',
    'ALTER TABLE `marketing_campaign` ADD COLUMN `invite_mode` TINYINT NOT NULL DEFAULT 1 COMMENT ''参与方式:1定向邀请 2公开报名'' AFTER `terms`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- 7. 商户 ↔ 平台活动参与关系(接受/拒绝邀请的唯一依据) ----
CREATE TABLE IF NOT EXISTS `marketing_campaign_participant` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `campaign_id`    BIGINT UNSIGNED NOT NULL COMMENT '平台活动ID(marketing_campaign.id)',
  `merchant_id`    BIGINT UNSIGNED NOT NULL COMMENT '商家ID',
  `status`         TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待响应 1已接受 2已拒绝 3已退出',
  `funding_source` TINYINT      NOT NULL DEFAULT 1 COMMENT '本次参与的出资方:1平台 2商户 3合作方 4共担',
  `funding_rules`  JSON         NULL COMMENT '共担比例快照{mtrip,merchant,partner}',
  `invited_at`     DATETIME     NULL DEFAULT NULL COMMENT '邀请时间',
  `responded_at`   DATETIME     NULL DEFAULT NULL COMMENT '响应时间',
  `remark`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT '商户响应备注(拒绝原因等)',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_campaign_merchant` (`campaign_id`, `merchant_id`),
  KEY `idx_merchant_status` (`merchant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='平台活动商户参与表';

-- ---- 8. 促销曝光按日聚合(转化率分母;不做行级流水) ----
CREATE TABLE IF NOT EXISTS `marketing_promotion_impression` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `coupon_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '券模板ID(marketing_coupon.id,0=仅活动曝光)',
  `campaign_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '平台活动ID(0=非活动来源)',
  `stat_date`   DATE         NOT NULL COMMENT '统计日期',
  `source`      VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '来源:app_list/app_detail/campaign_page 等',
  `impressions` INT          NOT NULL DEFAULT 0 COMMENT '当日累计曝光次数',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_scope_date` (`coupon_id`, `campaign_id`, `stat_date`, `source`),
  KEY `idx_stat_date` (`stat_date`),
  KEY `idx_coupon_date` (`coupon_id`, `stat_date`),
  KEY `idx_campaign_date` (`campaign_id`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='促销曝光按日聚合表';
