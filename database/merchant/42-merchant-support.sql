SET NAMES utf8mb4;
USE mtrip_business;

CREATE TABLE IF NOT EXISTS merchant_support_ticket (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ticket_no VARCHAR(40) NULL,
 site_id BIGINT UNSIGNED NOT NULL,
 merchant_id BIGINT UNSIGNED NOT NULL,
 property_id BIGINT UNSIGNED NULL,
 category VARCHAR(30) NOT NULL,
 subject VARCHAR(200) NOT NULL,
 description TEXT NOT NULL,
 priority VARCHAR(10) NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'open',
 created_by BIGINT UNSIGNED NOT NULL,
 creator_name VARCHAR(100) NOT NULL,
 assigned_admin_id BIGINT UNSIGNED NULL,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 violation_id BIGINT UNSIGNED NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 resolved_at DATETIME NULL,
 closed_at DATETIME NULL,
 UNIQUE KEY uk_support_number(ticket_no),
 KEY idx_support_scope(site_id,merchant_id,property_id,status,updated_at,id),
 KEY idx_support_queue(site_id,status,updated_at,id),
 KEY idx_support_violation(violation_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_support_reply (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ticket_id BIGINT UNSIGNED NOT NULL,
 actor_type VARCHAR(10) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 actor_name VARCHAR(100) NOT NULL,
 content TEXT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_support_reply(ticket_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_support_event (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ticket_id BIGINT UNSIGNED NOT NULL,
 actor_type VARCHAR(10) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 actor_name VARCHAR(100) NOT NULL,
 action VARCHAR(30) NOT NULL,
 changes_json JSON NOT NULL,
 reason TEXT NOT NULL,
 version INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uk_support_version(ticket_id,version),
 KEY idx_support_event(ticket_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_support_attachment (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 site_id BIGINT UNSIGNED NOT NULL,
 merchant_id BIGINT UNSIGNED NOT NULL,
 property_id BIGINT UNSIGNED NULL,
 ticket_id BIGINT UNSIGNED NULL,
 reply_id BIGINT UNSIGNED NULL,
 bound_at DATETIME NULL,
 actor_type VARCHAR(10) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 storage_key VARCHAR(100) NOT NULL,
 filename VARCHAR(255) NOT NULL,
 mime VARCHAR(100) NOT NULL,
 size INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_support_attachment(ticket_id,reply_id),
 KEY idx_support_temp(bound_at,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS merchant_support_request (
 site_id BIGINT UNSIGNED NOT NULL,
 actor_type VARCHAR(10) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 request_id VARCHAR(64) NOT NULL,
 payload_hash CHAR(64) NOT NULL,
 ticket_id BIGINT UNSIGNED NULL,
 result_json JSON NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(site_id,actor_type,actor_id,request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
