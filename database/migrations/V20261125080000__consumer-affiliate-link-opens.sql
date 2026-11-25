SET NAMES utf8mb4;
USE mtrip_business;

CREATE TABLE IF NOT EXISTS consumer_affiliate_link_daily (
  site_id BIGINT UNSIGNED NOT NULL,
  affiliate_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  opened_on DATE NOT NULL,
  opens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, affiliate_id, property_id, opened_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @affiliate_source_sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'user_referral' AND column_name = 'referral_property_id'),
  'SELECT 1',
  'ALTER TABLE user_referral ADD COLUMN referral_property_id BIGINT UNSIGNED NULL COMMENT ''Hotel destination from the referral link at signup'''
);
PREPARE affiliate_source FROM @affiliate_source_sql;
EXECUTE affiliate_source;
DEALLOCATE PREPARE affiliate_source;
