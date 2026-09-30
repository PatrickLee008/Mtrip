SET NAMES utf8mb4;

-- 订单优惠券规则快照:下单时把所用券的规则(类型/面额/门槛/封顶/适用范围/出资方与共担比例)
-- 冻结进订单,结算、对账与客服查询都读快照,不再随后台改券模板而变化。
--
--   order_main.coupon_snapshot:JSON,无券订单为 NULL;Trip 下各预订存同一份整单券快照。
--   存量订单保持 NULL,结算时回退读券模板(与改动前口径一致)。
--
-- 幂等:列按 information_schema 判存在。

USE `mtrip_business`;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_main' AND COLUMN_NAME = 'coupon_snapshot');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `order_main`
     ADD COLUMN `coupon_snapshot` JSON NULL COMMENT ''下单时优惠券规则快照(无券为NULL;结算按此计算出资方分摊)'' AFTER `alloc_coupon_discount`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
