-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Super Admin Portal / Phase 2]:带货达人与联盟(B2B Affiliate & Influencer)
-- 设计源:docs/redesign/super-admin-portal/modules/06-affiliate-influencer.md
-- 库:mtrip_business
-- 注:Affiliate(B2B 达人/机构带货)≠ Referral(C 端用户推荐返利,复用 user_referral)
-- ============================================================
USE `mtrip_business`;

-- 合作方/达人(签约带货渠道:网红/博主/KOL/OTA/企业)
CREATE TABLE IF NOT EXISTS `affiliate_partner` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `name`            VARCHAR(100) NOT NULL COMMENT '名称',
  `handle`          VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '社媒账号 @handle',
  `type`            VARCHAR(20)  NOT NULL DEFAULT 'influencer' COMMENT '类型:influencer/blogger/kol/ota_partner/corporate',
  `platform`        VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '主平台',
  `followers`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '粉丝数',
  `country`         VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '国家/地区',
  `status`          TINYINT      NOT NULL DEFAULT 2 COMMENT '状态:1活跃 2待审 3暂停 4已拒绝',
  `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '佣金比例%',
  `total_earnings`  BIGINT       NOT NULL DEFAULT 0 COMMENT '累计佣金(最小货币单位)',
  `withdrawable`    BIGINT       NOT NULL DEFAULT 0 COMMENT '可提现余额(最小货币单位)',
  `total_referrals` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '累计带来引流',
  `conversions`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '累计转化',
  `fraud_score`     INT          NOT NULL DEFAULT 0 COMMENT '欺诈分(0-100)',
  `join_date`       DATE         NULL DEFAULT NULL COMMENT '加入日期',
  `last_activity`   DATETIME     NULL DEFAULT NULL COMMENT '最后活跃',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`      DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='带货达人/合作方';

-- 达人入驻申请
CREATE TABLE IF NOT EXISTS `affiliate_application` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `name`          VARCHAR(100) NOT NULL COMMENT '名称',
  `handle`        VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '社媒账号',
  `type`          VARCHAR(20)  NOT NULL DEFAULT 'influencer' COMMENT '类型',
  `platform`      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '主平台',
  `followers`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '粉丝数',
  `contact_email` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '联系邮箱',
  `contact_phone` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '联系电话(加密)',
  `audience`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '受众描述',
  `materials`     JSON         NULL COMMENT '资料/案例链接',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1待审 2通过 3拒绝',
  `reviewer_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '审核人ID',
  `reviewer_name` VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '审核人姓名(快照)',
  `review_note`   VARCHAR(500) NOT NULL DEFAULT '' COMMENT '审核意见',
  `partner_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '通过后生成的达人ID',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='达人入驻申请';

-- 联盟计划配置(佣金规则/奖励规则/全局参数,单表 kind 区分)
CREATE TABLE IF NOT EXISTS `affiliate_program` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `kind`       TINYINT      NOT NULL DEFAULT 1 COMMENT '类别:1佣金规则 2奖励规则 3全局参数',
  `name`       VARCHAR(100) NOT NULL DEFAULT '' COMMENT '名称/键',
  `config`     JSON         NULL COMMENT '规则明细(commission:{affiliateType,rate,minBookingValue};reward:{trigger,target,rewardType,rewardValue};setting:{key,value})',
  `enabled`    TINYINT      NOT NULL DEFAULT 1 COMMENT '是否启用:0否 1是',
  `sort`       INT          NOT NULL DEFAULT 0 COMMENT '排序',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_kind` (`site_id`, `kind`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='联盟计划配置';

-- 联盟折扣码
CREATE TABLE IF NOT EXISTS `affiliate_code` (
  `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`           BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `code`              VARCHAR(50)  NOT NULL COMMENT '折扣码',
  `partner_id`        BIGINT UNSIGNED NOT NULL COMMENT '达人ID',
  `partner_name`      VARCHAR(100) NOT NULL DEFAULT '' COMMENT '达人名称(快照)',
  `partner_handle`    VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '达人账号(快照)',
  `promotion_type`    VARCHAR(20)  NOT NULL DEFAULT 'percentage' COMMENT '类型:percentage/fixed/free_night/cashback',
  `discount_value`    DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '折扣值',
  `discount_display`  VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '折扣展示文案',
  `referral_link`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '推广链接',
  `status`            TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1生效 2暂停 3过期 4草稿',
  `start_date`        DATE         NULL DEFAULT NULL COMMENT '开始日期',
  `end_date`          DATE         NULL DEFAULT NULL COMMENT '结束日期',
  `usage_limit`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '总用量上限(0=不限)',
  `usage_count`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已用量',
  `per_user_limit`    INT          NOT NULL DEFAULT 0 COMMENT '每人限用(0=不限)',
  `min_spend`         BIGINT       NOT NULL DEFAULT 0 COMMENT '最低消费(最小货币单位)',
  `eligible_merchants` VARCHAR(10) NOT NULL DEFAULT 'all' COMMENT '适用商户:all/selected',
  `merchant_count`    INT          NOT NULL DEFAULT 0 COMMENT '适用商户数',
  `bookings`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '带来预订数',
  `conversions`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '转化数',
  `revenue`           BIGINT       NOT NULL DEFAULT 0 COMMENT '带来 GMV(最小货币单位)',
  `commission`        BIGINT       NOT NULL DEFAULT 0 COMMENT '产生佣金(最小货币单位)',
  `commission_rate`   DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '佣金比例%',
  `last_used_at`      DATETIME     NULL DEFAULT NULL COMMENT '最后使用时间',
  `created_by`        VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '创建人(快照)',
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`        DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_partner_id` (`partner_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='联盟折扣码';

-- 佣金流水
CREATE TABLE IF NOT EXISTS `affiliate_commission_log` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `partner_id`      BIGINT UNSIGNED NOT NULL COMMENT '达人ID',
  `code_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '联盟码ID',
  `order_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '归因订单ID',
  `amount`          BIGINT       NOT NULL DEFAULT 0 COMMENT '佣金额(最小货币单位)',
  `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '佣金比例%',
  `status`          TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1待结算 2已结算 3已作废',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_partner_id` (`partner_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='达人佣金流水';

-- 达人提现
CREATE TABLE IF NOT EXISTS `affiliate_withdraw` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `partner_id`    BIGINT UNSIGNED NOT NULL COMMENT '达人ID',
  `amount`        BIGINT       NOT NULL DEFAULT 0 COMMENT '提现额(最小货币单位)',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1待审 2已批 3已打款 4已拒绝',
  `bank_info`     VARCHAR(500) NOT NULL DEFAULT '' COMMENT '收款信息(加密)',
  `operator_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '处理人ID',
  `paid_at`       DATETIME     NULL DEFAULT NULL COMMENT '打款时间',
  `remark`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_partner_id` (`partner_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='达人提现';

-- 反欺诈案件
CREATE TABLE IF NOT EXISTS `affiliate_fraud_flag` (
  `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`              BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `partner_id`           BIGINT UNSIGNED NOT NULL COMMENT '达人ID',
  `partner_name`         VARCHAR(100) NOT NULL DEFAULT '' COMMENT '达人名称(快照)',
  `handle`               VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '达人账号(快照)',
  `fraud_score`          INT          NOT NULL DEFAULT 0 COMMENT '欺诈分(0-100)',
  `risk_level`           TINYINT      NOT NULL DEFAULT 3 COMMENT '风险等级:1高 2中 3低',
  `suspicious_activity`  VARCHAR(100) NOT NULL DEFAULT '' COMMENT '可疑行为',
  `evidence_summary`     VARCHAR(500) NOT NULL DEFAULT '' COMMENT '证据摘要',
  `investigation_status` TINYINT      NOT NULL DEFAULT 1 COMMENT '调查状态:1调查中 2待复核 3已解决 4已驳回',
  `reviewer`             VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '处理人',
  `detection_date`       DATE         NULL DEFAULT NULL COMMENT '检测日期',
  `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_partner_id` (`partner_id`),
  KEY `idx_status` (`investigation_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='达人反欺诈案件';
