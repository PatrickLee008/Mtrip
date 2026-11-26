SET NAMES utf8mb4;
USE mtrip_business;

-- Existing tiers retain their original thirty-night eligibility.
DROP PROCEDURE IF EXISTS mtrip_add_long_stay_column;
DELIMITER $$
CREATE PROCEDURE mtrip_add_long_stay_column(IN column_name_to_add VARCHAR(64), IN definition_to_add TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
      AND table_name='marketing_longstay_tier' AND column_name=column_name_to_add) THEN
    SET @long_stay_ddl=CONCAT('ALTER TABLE marketing_longstay_tier ADD COLUMN ', column_name_to_add, ' ', definition_to_add);
    PREPARE long_stay_statement FROM @long_stay_ddl;
    EXECUTE long_stay_statement;
    DEALLOCATE PREPARE long_stay_statement;
  END IF;
END$$
DELIMITER ;
CALL mtrip_add_long_stay_column('max_nights', 'INT UNSIGNED NOT NULL DEFAULT 30');
CALL mtrip_add_long_stay_column('offer_source', 'VARCHAR(12) NOT NULL DEFAULT ''platform''');
CALL mtrip_add_long_stay_column('platform_funding_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 0');
DROP PROCEDURE mtrip_add_long_stay_column;

SET @funding_snapshot_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
    AND table_name='order_main' AND column_name='longstay_funding_snapshot'), 'SELECT 1',
    'ALTER TABLE order_main ADD COLUMN longstay_funding_snapshot JSON NULL');
PREPARE funding_snapshot_stmt FROM @funding_snapshot_ddl;
EXECUTE funding_snapshot_stmt;
DEALLOCATE PREPARE funding_snapshot_stmt;

CREATE TABLE IF NOT EXISTS marketing_longstay_proposal (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  merchant_id BIGINT UNSIGNED NOT NULL,
  submitted_by BIGINT UNSIGNED NOT NULL,
  min_nights INT UNSIGNED NOT NULL,
  max_nights INT UNSIGNED NOT NULL,
  discount_rate DECIMAL(5,2) NOT NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  details VARCHAR(500) NOT NULL DEFAULT '',
  state VARCHAR(16) NOT NULL DEFAULT 'submitted',
  reason VARCHAR(500) NOT NULL DEFAULT '',
  previous_id BIGINT UNSIGNED NULL,
  tier_id BIGINT UNSIGNED NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_revision (previous_id),
  UNIQUE KEY uk_tier (tier_id),
  KEY ix_property (site_id,property_id,id),
  KEY ix_queue (site_id,state,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
