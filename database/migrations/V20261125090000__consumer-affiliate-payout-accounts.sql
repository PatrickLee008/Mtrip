SET NAMES utf8mb4;
USE mtrip_business;

CREATE TABLE IF NOT EXISTS consumer_affiliate_payout_provider (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(12) NOT NULL,
  name VARCHAR(80) NOT NULL,
  enabled TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_affiliate_payout_provider (site_id, kind, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS consumer_affiliate_payout_account (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL,
  affiliate_id BIGINT UNSIGNED NOT NULL,
  provider_id BIGINT UNSIGNED NOT NULL,
  holder_cipher VARCHAR(1024) NOT NULL,
  number_cipher VARCHAR(512) NOT NULL,
  number_hash CHAR(64) NOT NULL,
  number_suffix VARCHAR(4) NOT NULL,
  status TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 pending, 1 verified, 2 rejected',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  is_default TINYINT UNSIGNED NOT NULL DEFAULT 0,
  review_note VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_affiliate_payout_number (site_id, affiliate_id, provider_id, number_hash),
  KEY idx_affiliate_payout_account (site_id, affiliate_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS consumer_affiliate_payout_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL,
  account_id BIGINT UNSIGNED NOT NULL,
  version INT UNSIGNED NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(20) NOT NULL,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_affiliate_payout_audit (site_id, account_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

USE mtrip_system;

INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(60202,602,'核验联盟收款账户','Verify Affiliate Payout Accounts','affiliate:payout-account:verify',3,2),
(60203,602,'管理联盟收款服务商','Manage Affiliate Payout Providers','affiliate:payout-provider:manage',3,3);

INSERT IGNORE INTO sys_role_menu (role_id,menu_id) VALUES (1,60202),(1,60203);
