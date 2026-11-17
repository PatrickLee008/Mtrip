SET NAMES utf8mb4;

-- M12 商务配置版本及确认时订单条款；仅存配置，不启用支付方式或改变计费/结算。
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `merchant_commercial_config` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `merchant_id` BIGINT UNSIGNED NOT NULL,
  `site_id` BIGINT UNSIGNED NOT NULL,
  `version` INT UNSIGNED NOT NULL,
  `commission_plan` VARCHAR(20) NOT NULL,
  `commission_rate` DECIMAL(5,2) NOT NULL,
  `transaction_fee_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `pay_at_hotel_enabled` TINYINT NOT NULL DEFAULT 0,
  `no_show_fee_enabled` TINYINT NOT NULL DEFAULT 0,
  `merchant_upfront_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `effective_at` DATETIME NOT NULL COMMENT 'UTC',
  `reason` VARCHAR(500) NOT NULL,
  `created_by` BIGINT UNSIGNED NOT NULL,
  `created_by_name` VARCHAR(100) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL COMMENT 'UTC',
  `request_id` VARCHAR(64) NOT NULL,
  `payload_hash` CHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_merchant_version` (`merchant_id`, `version`),
  UNIQUE KEY `uk_merchant_request` (`merchant_id`, `request_id`),
  KEY `idx_site_effective` (`site_id`, `merchant_id`, `effective_at`, `version`),
  KEY `idx_merchant_effective` (`merchant_id`, `effective_at`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='商户不可变商务条款历史';

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_info' AND COLUMN_NAME = 'commercial_version');
SET @sql := IF(@c = 0, 'ALTER TABLE `merchant_info` ADD COLUMN `commercial_version` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''最新已保存商务版本(含未来生效)''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_main' AND COLUMN_NAME = 'merchant_commercial_snapshot');
SET @sql := IF(@c = 0, 'ALTER TABLE `order_main` ADD COLUMN `merchant_commercial_snapshot` JSON NULL COMMENT ''首次确认时的商户商务条款(不回填旧确认单)''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
