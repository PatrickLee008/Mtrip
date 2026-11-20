SET NAMES utf8mb4;
USE mtrip_business;

CREATE TABLE IF NOT EXISTS merchant_property_commercial_config (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 merchant_id BIGINT UNSIGNED NOT NULL, site_id BIGINT UNSIGNED NOT NULL, property_id BIGINT UNSIGNED NOT NULL,
 version INT UNSIGNED NOT NULL, commission_rate DECIMAL(5,2) NULL COMMENT 'NULL restores merchant default',
 effective_at DATETIME NOT NULL COMMENT 'UTC', reason VARCHAR(500) NOT NULL,
 request_id VARCHAR(64) NOT NULL, payload_hash CHAR(64) NOT NULL,
 created_by BIGINT UNSIGNED NOT NULL, created_by_name VARCHAR(100) NOT NULL DEFAULT '', created_at DATETIME NOT NULL,
 UNIQUE KEY uk_property_version (property_id,version), UNIQUE KEY uk_property_request (property_id,request_id),
 KEY idx_effective (merchant_id,site_id,property_id,effective_at,version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
