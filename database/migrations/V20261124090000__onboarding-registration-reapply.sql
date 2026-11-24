SET NAMES utf8mb4;
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `merchant_application_registration_review` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `site_id` BIGINT UNSIGNED NOT NULL,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `round_no` INT UNSIGNED NOT NULL,
  `registration_status` TINYINT UNSIGNED NOT NULL,
  `submitted_at` DATETIME NULL,
  `reviewed_at` DATETIME NULL,
  `reviewer_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `reviewer_name` VARCHAR(100) NOT NULL DEFAULT '',
  `review_reason` VARCHAR(500) NOT NULL DEFAULT '',
  `snapshot` JSON NOT NULL COMMENT 'Immutable company/business submission; phone remains encrypted',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_application_round` (`application_id`,`round_no`),
  KEY `idx_site` (`site_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

USE `mtrip_system`;
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
(20510,205,'重新开启入驻申请（仅超管）','Reopen Registration (Super Admin Only)','merchant:onboarding:reopen',3,10);
-- The API separately requires isSuper; ordinary roles receive no grant.
INSERT IGNORE INTO sys_role_menu (role_id,menu_id) VALUES (1,20510);
