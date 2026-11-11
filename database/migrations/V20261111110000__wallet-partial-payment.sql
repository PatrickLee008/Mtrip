SET NAMES utf8mb4;

-- 钱包部分抵扣(Super Admin PRD v1.0.14 模块 25:结账自动抵扣、可关闭、按交易类型限额,不足部分用其他支付方式)。
--
--   order_main / order_trip.wallet_amount       本单由钱包支付的金额(纯钱包支付 = 应付全额;部分抵扣 = 抵扣额;0 = 未用钱包)
--   order_main / order_trip.wallet_hold_status  钱包抵扣状态:0 未用 1 已冻结待其他方式付清(已从钱包扣出)
--                                               2 已支付 3 已退回钱包(订单未付清就取消 / 超时)
-- 其他方式(KBZPay MMQR / mock)只付 pay_amount - wallet_amount;部分抵扣的订单退款一律退回钱包。
-- Trip 整单支付时抵扣额记在 order_trip,并按各预订应付比例分摊到 order_main.wallet_amount(按预订退款用)。
-- 幂等:列按 information_schema 判存在。

USE `mtrip_business`;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_main' AND COLUMN_NAME = 'wallet_amount');
SET @ddl := IF(@c = 0,
  'ALTER TABLE `order_main` ADD COLUMN `wallet_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT ''钱包支付金额'' AFTER `pay_amount`, ADD COLUMN `wallet_hold_status` TINYINT NOT NULL DEFAULT 0 COMMENT ''钱包抵扣状态:0未用 1已冻结待付清 2已支付 3已退回'' AFTER `wallet_amount`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_trip' AND COLUMN_NAME = 'wallet_amount');
SET @ddl := IF(@c = 0,
  'ALTER TABLE `order_trip` ADD COLUMN `wallet_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT ''钱包支付金额'' AFTER `pay_amount`, ADD COLUMN `wallet_hold_status` TINYINT NOT NULL DEFAULT 0 COMMENT ''钱包抵扣状态:0未用 1已冻结待付清 2已支付 3已退回'' AFTER `wallet_amount`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 存量纯钱包支付的已付订单(pay_method=3)回填 wallet_amount,便于统一按「钱包支付额」统计
UPDATE `order_main` SET `wallet_amount` = `pay_amount`, `wallet_hold_status` = 2
WHERE `pay_method` = 3 AND `payment_status` IN (2, 3, 4) AND `wallet_amount` = 0 AND `wallet_hold_status` = 0;
UPDATE `order_trip` SET `wallet_amount` = `pay_amount`, `wallet_hold_status` = 2
WHERE `pay_method` = 3 AND `pay_status` = 1 AND `wallet_amount` = 0 AND `wallet_hold_status` = 0;
