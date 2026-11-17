SET NAMES utf8mb4;
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `merchant_pay_at_hotel_terms` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `merchant_id` BIGINT UNSIGNED NOT NULL,
  `site_id` BIGINT UNSIGNED NOT NULL,
  `version` INT UNSIGNED NOT NULL,
  `enabled` TINYINT NOT NULL DEFAULT 0,
  `no_show_enabled` TINYINT NOT NULL DEFAULT 0,
  `deposit_cap_rate` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `deposit_rate` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `transaction_fee_rate` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `effective_at` DATETIME NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `actor_type` VARCHAR(16) NOT NULL,
  `actor_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_merchant_version` (`merchant_id`, `version`),
  KEY `idx_effective` (`merchant_id`, `site_id`, `effective_at`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户到店支付配置版本';

ALTER TABLE `order_main`
  ADD COLUMN `pay_at_hotel` TINYINT NOT NULL DEFAULT 0 COMMENT '线上预付+到店支付余额' AFTER `pay_amount`,
  ADD COLUMN `hotel_balance` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '到店直接支付余额,不进入平台收款' AFTER `pay_at_hotel`,
  ADD COLUMN `hotel_commission` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '平台预收佣金' AFTER `hotel_balance`,
  ADD COLUMN `hotel_deposit` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '商户房费预收,独立于佣金' AFTER `hotel_commission`,
  ADD COLUMN `hotel_transaction_fee` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '按佣金计算的客户承担手续费' AFTER `hotel_deposit`,
  ADD COLUMN `hotel_terms_snapshot` JSON NULL COMMENT '预订时生效的商务条款及房费基数' AFTER `hotel_transaction_fee`,
  ADD COLUMN `hotel_settlement_status` TINYINT NOT NULL DEFAULT 0 COMMENT '0未完成 1实际入住自动完成' AFTER `hotel_terms_snapshot`,
  ADD COLUMN `hotel_settled_at` DATETIME NULL COMMENT '到店支付运营结算完成时间' AFTER `hotel_settlement_status`;

ALTER TABLE `order_trip`
  ADD COLUMN `pay_at_hotel` TINYINT NOT NULL DEFAULT 0 COMMENT '行程含到店支付预订' AFTER `pay_amount`,
  ADD COLUMN `hotel_balance` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '各预订到店直接支付余额合计' AFTER `pay_at_hotel`;

ALTER TABLE `finance_account_entry`
  ADD COLUMN `hotel_balance` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '酒店直接收取,不计入平台应结' AFTER `order_amount`,
  ADD COLUMN `hotel_deposit` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '商户房费预收' AFTER `hotel_balance`,
  ADD COLUMN `transaction_fee` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '按佣金计算的手续费' AFTER `hotel_deposit`;

ALTER TABLE `order_refund`
  ADD COLUMN `refund_hotel_commission` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '到店支付佣金退款组成' AFTER `refund_amount`,
  ADD COLUMN `refund_hotel_deposit` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '到店支付商户预收退款组成' AFTER `refund_hotel_commission`,
  ADD COLUMN `refund_transaction_fee` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '到店支付手续费退款组成' AFTER `refund_hotel_deposit`,
  ADD COLUMN `refund_addon` DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '到店支付附加服务退款组成' AFTER `refund_transaction_fee`;
