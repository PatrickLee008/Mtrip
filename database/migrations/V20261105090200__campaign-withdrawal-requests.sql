SET NAMES utf8mb4;
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS marketing_campaign_withdrawal (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT UNSIGNED NOT NULL,
  campaign_id BIGINT UNSIGNED NOT NULL,
  participant_id BIGINT UNSIGNED NOT NULL,
  merchant_id BIGINT UNSIGNED NOT NULL,
  status TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0 pending, 1 approved, 2 rejected',
  reason VARCHAR(500) NOT NULL,
  requested_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_by BIGINT UNSIGNED NULL,
  decided_at DATETIME NULL,
  decision_reason VARCHAR(500) NULL,
  KEY idx_participant_history (participant_id, id),
  KEY idx_site_status (site_id, status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

USE `mtrip_system`;
INSERT IGNORE INTO sys_menu (id, parent_id, menu_name, menu_name_en, perm_key, menu_type, sort)
VALUES (50103, 501, '审核活动撤回', 'Review Campaign Withdrawal', 'marketing:campaign:withdrawal-review', 3, 3);
