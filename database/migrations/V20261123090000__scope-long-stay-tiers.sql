SET NAMES utf8mb4;
USE mtrip_business;

-- Preserve existing site-wide ladders and their coupon behavior.
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
CALL mtrip_add_long_stay_column('property_id', 'BIGINT UNSIGNED NOT NULL DEFAULT 0');
CALL mtrip_add_long_stay_column('starts_at', 'DATETIME NULL');
CALL mtrip_add_long_stay_column('ends_at', 'DATETIME NULL');
CALL mtrip_add_long_stay_column('priority', 'INT NOT NULL DEFAULT 0');
CALL mtrip_add_long_stay_column('coupon_stackable', 'TINYINT NULL DEFAULT NULL');
DROP PROCEDURE mtrip_add_long_stay_column;
