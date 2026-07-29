-- ============================================================
-- 业务表 08:营销活动(业务模块8:优惠券/限时活动/首页推荐/积分)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

-- 优惠券模板表
CREATE TABLE IF NOT EXISTS `marketing_coupon` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `coupon_name`    VARCHAR(100) NOT NULL COMMENT '优惠券名称',
  `coupon_type`    TINYINT      NOT NULL DEFAULT 1 COMMENT '券类型:1满减券 2折扣券 3无门槛券',
  `discount_value` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠值(满减/无门槛=金额,折扣=折扣率如8.50)',
  `min_amount`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '使用门槛金额,0=无门槛',
  `max_discount`   DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '折扣券最高优惠金额,0=不限',
  `goods_scope`    TINYINT      NOT NULL DEFAULT 0 COMMENT '适用范围:0全部商品 1酒店 2门票 3指定商品',
  `goods_ids`      JSON         NULL COMMENT '指定商品ID列表(goods_scope=3)',
  `total_count`    INT          NOT NULL DEFAULT 0 COMMENT '发行总量,0=不限',
  `received_count` INT          NOT NULL DEFAULT 0 COMMENT '已领取数量',
  `used_count`     INT          NOT NULL DEFAULT 0 COMMENT '已使用数量',
  `per_user_limit` INT          NOT NULL DEFAULT 1 COMMENT '每人限领张数',
  `valid_type`     TINYINT      NOT NULL DEFAULT 1 COMMENT '有效期类型:1固定日期 2领取后N天',
  `valid_start`    DATETIME     NULL DEFAULT NULL COMMENT '有效期开始(固定日期)',
  `valid_end`      DATETIME     NULL DEFAULT NULL COMMENT '有效期结束(固定日期)',
  `valid_days`     INT          NOT NULL DEFAULT 0 COMMENT '领取后有效天数(valid_type=2)',
  `status`         TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0未开始 1进行中 2已停发 3已结束',
  `remark`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注/使用说明',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='优惠券模板表';

-- 用户领券记录表
CREATE TABLE IF NOT EXISTS `marketing_coupon_receive` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `coupon_id`   BIGINT UNSIGNED NOT NULL COMMENT '优惠券模板ID',
  `user_id`     BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `coupon_code` VARCHAR(32)  NOT NULL COMMENT '券码(唯一)',
  `status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0未使用 1已使用 2已过期 3已作废',
  `valid_start` DATETIME     NULL DEFAULT NULL COMMENT '有效期开始',
  `valid_end`   DATETIME     NULL DEFAULT NULL COMMENT '有效期结束',
  `order_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '使用订单ID',
  `used_time`   DATETIME     NULL DEFAULT NULL COMMENT '使用时间',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_coupon_code` (`coupon_code`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_coupon_id` (`coupon_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户领券记录表';

-- 限时活动表(秒杀/特价)
CREATE TABLE IF NOT EXISTS `marketing_activity` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `activity_name` VARCHAR(100) NOT NULL COMMENT '活动名称',
  `activity_type` TINYINT      NOT NULL DEFAULT 1 COMMENT '活动类型:1限时特价 2秒杀 3满减活动',
  `banner_image`  VARCHAR(255) NOT NULL DEFAULT '' COMMENT '活动头图',
  `start_time`    DATETIME     NOT NULL COMMENT '开始时间',
  `end_time`      DATETIME     NOT NULL COMMENT '结束时间',
  `rules`         JSON         NULL COMMENT '活动规则(满减梯度等)',
  `status`        TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0未开始 1进行中 2已暂停 3已结束',
  `remark`        VARCHAR(500) NOT NULL DEFAULT '' COMMENT '活动说明',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_status` (`status`),
  KEY `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='限时活动表';

-- 活动商品关联表
CREATE TABLE IF NOT EXISTS `marketing_activity_goods` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `activity_id`    BIGINT UNSIGNED NOT NULL COMMENT '活动ID',
  `site_id`        BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `goods_id`       BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  `sku_type`       TINYINT      NOT NULL DEFAULT 0 COMMENT 'SKU类型:0商品级 1房型 2票种',
  `sku_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '房型ID/票种ID,0=商品级',
  `activity_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '活动价',
  `activity_stock` INT          NOT NULL DEFAULT 0 COMMENT '活动库存,0=不限',
  `sold_count`     INT          NOT NULL DEFAULT 0 COMMENT '活动已售',
  `per_user_limit` INT          NOT NULL DEFAULT 0 COMMENT '每人限购,0=不限',
  `sort`           INT          NOT NULL DEFAULT 0 COMMENT '排序号',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`     DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_activity_sku` (`activity_id`, `goods_id`, `sku_type`, `sku_id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_goods_id` (`goods_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='活动商品关联表';

-- 首页推荐位/Banner 表
CREATE TABLE IF NOT EXISTS `marketing_banner` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `position`    TINYINT      NOT NULL DEFAULT 1 COMMENT '推荐位:1首页轮播 2首页推荐 3专题页',
  `title`       VARCHAR(100) NOT NULL COMMENT '标题',
  `image`       VARCHAR(255) NOT NULL COMMENT '图片URL',
  `link_type`   TINYINT      NOT NULL DEFAULT 0 COMMENT '跳转类型:0无 1商品详情 2活动页 3外链',
  `link_value`  VARCHAR(500) NOT NULL DEFAULT '' COMMENT '跳转目标(商品ID/活动ID/URL)',
  `start_time`  DATETIME     NULL DEFAULT NULL COMMENT '展示开始时间',
  `end_time`    DATETIME     NULL DEFAULT NULL COMMENT '展示结束时间',
  `sort`        INT          NOT NULL DEFAULT 0 COMMENT '排序号(小在前)',
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1上架 2下架',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_position` (`position`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='首页推荐位Banner表';

-- 积分规则表
CREATE TABLE IF NOT EXISTS `marketing_points_rule` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID,0=全局默认',
  `rule_key`     VARCHAR(50)  NOT NULL COMMENT '规则标识(order_paid/sign_in/register等)',
  `rule_name`    VARCHAR(100) NOT NULL COMMENT '规则名称',
  `points_type`  TINYINT      NOT NULL DEFAULT 1 COMMENT '积分方式:1固定值 2按金额比例',
  `points_value` INT          NOT NULL DEFAULT 0 COMMENT '固定积分值',
  `points_rate`  DECIMAL(6,4) NOT NULL DEFAULT 0.0000 COMMENT '按金额比例(1.0000=每1元1分)',
  `daily_limit`  INT          NOT NULL DEFAULT 0 COMMENT '每日上限,0=不限',
  `deduct_rate`  DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '抵扣比例(多少积分抵1元,0=不可抵扣)',
  `status`       TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2禁用',
  `remark`       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`   DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_site_rule` (`site_id`, `rule_key`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分规则表';
