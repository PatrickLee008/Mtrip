-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Consumer App PRD v1.0 / M3 运营与风控]:优惠券出资方(Promotion Funding Source)
-- 需求出处:PRD 模块 8(促销成本按出资方分摊,决定商户结算额与平台费用)
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

ALTER TABLE `marketing_coupon`
  ADD COLUMN `funding_source` TINYINT NOT NULL DEFAULT 1 COMMENT '出资方:1平台 2商户 3合作方 4共担' AFTER `max_discount`,
  ADD COLUMN `funding_rules`  JSON    NULL COMMENT '共担比例{mtrip,merchant,partner}百分比(funding_source=4)' AFTER `funding_source`;
