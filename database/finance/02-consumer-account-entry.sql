-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M3 运营与风控]:按订单结算分录(Booking Settlement Ledger)
-- 需求出处:PRD 模块 8 Campaign Expense Record(每笔订单:折扣 / mTrip Pays / Merchant Pays / Partner Pays)
-- 库:mtrip_business;支付成功时按优惠券出资方生成一行,供财务对账与商户结算取数
-- 口径:merchant_settlement = order_amount − commission − merchant_pays;platform_revenue = commission − mtrip_pays
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `finance_account_entry` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`             BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `order_id`            BIGINT UNSIGNED NOT NULL COMMENT '订单ID',
  `order_no`            VARCHAR(32)  NOT NULL COMMENT '订单号',
  `merchant_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '商户ID',
  `coupon_id`           BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '领券记录ID(无券=0)',
  `order_amount`        DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '订单原总额',
  `commission`          DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '平台佣金',
  `discount_amount`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '促销折扣总额',
  `funding_source`      TINYINT      NOT NULL DEFAULT 1 COMMENT '出资方:1平台 2商户 3合作方 4共担',
  `mtrip_pays`          DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'mTrip 承担的促销',
  `merchant_pays`       DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商户承担的促销',
  `partner_pays`        DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '合作方承担的促销',
  `merchant_settlement` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应结商户金额',
  `platform_revenue`    DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '平台净收入',
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order` (`order_id`),
  KEY `idx_site_merchant` (`site_id`, `merchant_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='按订单结算分录表';
