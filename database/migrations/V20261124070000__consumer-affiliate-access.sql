SET NAMES utf8mb4;
USE mtrip_business;

CREATE TABLE IF NOT EXISTS consumer_affiliate_profile (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  affiliate_type VARCHAR(16) NOT NULL,
  status TINYINT UNSIGNED NOT NULL COMMENT '1 active, 2 suspended, 3 disabled',
  activated_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_consumer_affiliate_user (user_id),
  KEY idx_consumer_affiliate_site (site_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS consumer_affiliate_status_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  site_id BIGINT UNSIGNED NOT NULL,
  profile_id BIGINT UNSIGNED NOT NULL,
  previous_status TINYINT UNSIGNED NOT NULL,
  new_status TINYINT UNSIGNED NOT NULL,
  operator_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_consumer_affiliate_log (site_id, profile_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @consumer_affiliate_snapshot_sql = IF(
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'user_referral' AND column_name = 'consumer_affiliate_id'),
  'SELECT 1',
  'ALTER TABLE user_referral ADD COLUMN consumer_affiliate_id BIGINT UNSIGNED NULL COMMENT ''Affiliate profile at registration, NULL for ordinary referrals'''
);
PREPARE consumer_affiliate_snapshot FROM @consumer_affiliate_snapshot_sql;
EXECUTE consumer_affiliate_snapshot;
DEALLOCATE PREPARE consumer_affiliate_snapshot;

USE mtrip_system;

INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(60201,602,'管理消费者联盟资格','Manage Consumer Affiliate Access','affiliate:partner:manage-consumer',3,1);

INSERT IGNORE INTO sys_role_menu (role_id,menu_id) VALUES (1,60201);
