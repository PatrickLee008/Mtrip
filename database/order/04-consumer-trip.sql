-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M4 Phase2]:多酒店 Trip(单结账多预订)
-- 需求出处:PRD 模块 1.1(一次结账多酒店;单笔支付;支付后生成各自独立预订;
--          优惠券按订单金额占比分摊;各预订独立确认/取消/退款/结算)
-- 库:mtrip_business;order_main.trip_id/alloc_coupon_discount 已在 M0 迁移预留
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `order_trip` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `trip_no`         VARCHAR(32)  NOT NULL COMMENT 'Trip单号(唯一)',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `user_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '用户ID',
  `total_amount`    DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '各预订净额合计(含长住优惠后、券前)',
  `coupon_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '整单优惠券(领券记录ID),0=无',
  `coupon_discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '整单券抵扣(按占比分摊到各预订)',
  `pay_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '整单实付=total_amount-coupon_discount',
  `booking_count`   INT          NOT NULL DEFAULT 0 COMMENT '包含预订数',
  `pay_status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '支付状态:0待支付 1已支付 2已取消',
  `pay_method`      TINYINT      NOT NULL DEFAULT 0 COMMENT '支付方式:1Stripe 2PayPal',
  `pay_trade_no`    VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '支付流水号',
  `pay_time`        DATETIME     NULL DEFAULT NULL COMMENT '支付时间',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`      DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_trip_no` (`trip_no`),
  KEY `idx_user` (`user_id`),
  KEY `idx_site_status` (`site_id`, `pay_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='多酒店Trip主单表';
