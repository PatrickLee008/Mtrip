SET NAMES utf8mb4;
USE mtrip_business;

CREATE TABLE IF NOT EXISTS order_refund_destination (
  refund_id BIGINT UNSIGNED PRIMARY KEY,
  site_id BIGINT UNSIGNED NOT NULL,
  close_booking TINYINT UNSIGNED NOT NULL DEFAULT 0,
  recipient_cipher TEXT NULL,
  finance_actor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  transfer_reference VARCHAR(100) NULL,
  proof_mime VARCHAR(32) NULL,
  proof_image MEDIUMBLOB NULL,
  completed_at DATETIME NULL,
  UNIQUE KEY uk_site_transfer_reference (site_id, transfer_reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

USE mtrip_system;
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort)
VALUES (40202,402,'执行退款打款','Execute Refund Transfer','order:refund:transfer',3,2);
