SET NAMES utf8mb4;
USE mtrip_business;

-- Expand only. Old approvals do not acquire Finance clearance automatically.
DROP PROCEDURE IF EXISTS mtrip_deletion_add_column;
DELIMITER $$
CREATE PROCEDURE mtrip_deletion_add_column(IN col VARCHAR(64), IN definition TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
      AND table_name='user_account_deletion' AND column_name=col) THEN
    SET @deletion_ddl=CONCAT('ALTER TABLE user_account_deletion ADD COLUMN `',col,'` ',definition);
    PREPARE deletion_stmt FROM @deletion_ddl; EXECUTE deletion_stmt; DEALLOCATE PREPARE deletion_stmt;
  END IF;
END$$
DELIMITER ;
CALL mtrip_deletion_add_column('requested_by','BIGINT UNSIGNED NOT NULL DEFAULT 0');
CALL mtrip_deletion_add_column('requested_name','VARCHAR(50) NOT NULL DEFAULT ''''');
CALL mtrip_deletion_add_column('request_reason','VARCHAR(255) NOT NULL DEFAULT ''''');
CALL mtrip_deletion_add_column('evidence','VARCHAR(1000) NOT NULL DEFAULT ''''');
CALL mtrip_deletion_add_column('requested_balance','DECIMAL(12,2) NOT NULL DEFAULT 0');
CALL mtrip_deletion_add_column('threshold_snapshot','DECIMAL(12,2) NOT NULL DEFAULT 0');
CALL mtrip_deletion_add_column('policy_version','BIGINT UNSIGNED NOT NULL DEFAULT 0');
CALL mtrip_deletion_add_column('validity_days','INT UNSIGNED NOT NULL DEFAULT 7');
CALL mtrip_deletion_add_column('finance_state','TINYINT UNSIGNED NOT NULL DEFAULT 0');
CALL mtrip_deletion_add_column('finance_maker_id','BIGINT UNSIGNED NOT NULL DEFAULT 0');
CALL mtrip_deletion_add_column('finance_maker_name','VARCHAR(50) NOT NULL DEFAULT ''''');
CALL mtrip_deletion_add_column('finance_made_at','DATETIME NULL');
CALL mtrip_deletion_add_column('finance_maker_reason','VARCHAR(255) NOT NULL DEFAULT ''''');
CALL mtrip_deletion_add_column('finance_checker_id','BIGINT UNSIGNED NOT NULL DEFAULT 0');
CALL mtrip_deletion_add_column('finance_checker_name','VARCHAR(50) NOT NULL DEFAULT ''''');
CALL mtrip_deletion_add_column('finance_checked_at','DATETIME NULL');
CALL mtrip_deletion_add_column('finance_checker_reason','VARCHAR(255) NOT NULL DEFAULT ''''');
CALL mtrip_deletion_add_column('finance_balance','DECIMAL(12,2) NOT NULL DEFAULT 0');
CALL mtrip_deletion_add_column('rejection_reason','VARCHAR(255) NOT NULL DEFAULT ''''');
DROP PROCEDURE mtrip_deletion_add_column;

CREATE TABLE IF NOT EXISTS user_account_deletion_event (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 site_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
 deletion_id BIGINT UNSIGNED NOT NULL, action VARCHAR(40) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL, actor_name VARCHAR(50) NOT NULL DEFAULT '',
 reason VARCHAR(255) NOT NULL DEFAULT '', details JSON NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_deletion (deletion_id,id), KEY idx_site (site_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS user_account_deletion_config (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 threshold_amount DECIMAL(12,2) NOT NULL DEFAULT 0, validity_days INT UNSIGNED NOT NULL DEFAULT 7,
 effective_at DATETIME NOT NULL, reason VARCHAR(255) NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL, actor_name VARCHAR(50) NOT NULL DEFAULT '',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_effective (effective_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
INSERT IGNORE INTO user_account_deletion_config
 (id,threshold_amount,validity_days,effective_at,reason,actor_id)
 VALUES (1,0,7,'1970-01-01 00:00:00','Initial policy; positive balances still require reviewed approval',0);

USE mtrip_system;
INSERT IGNORE INTO sys_menu
 (id,parent_id,menu_name,menu_name_en,i18n_key,perm_key,menu_type,route_path,component,sort) VALUES
 (1017,1000,'注销申请与审批','Account Deletion','menu.accountDeletion','user:deletion:list',2,'/user/deletion','user/deletion/index',17),
 (905,902,'钱包余额作废报告','Wallet Forfeiture Report','menu.walletForfeiture','user:deletion:report',2,'/stats/finance/wallet-forfeiture','stats/finance/forfeiture/index',18);
INSERT IGNORE INTO sys_menu (id,parent_id,menu_name,menu_name_en,perm_key,menu_type,sort) VALUES
 (101701,1017,'提交注销申请','Submit Request','user:deletion:request',3,1),
 (101702,1017,'财务经办','Finance Prepare','user:deletion:prepare',3,2),
 (101703,1017,'财务复核','Finance Check','user:deletion:check',3,3),
 (101704,1017,'注销策略配置','Deletion Policy','user:deletion:config',3,4),
 (90501,905,'导出作废报告','Export Report','user:deletion:export',3,1);
INSERT IGNORE INTO sys_role_menu (role_id,menu_id)
 SELECT 1,id FROM sys_menu WHERE id IN (1017,905,101701,101702,101703,101704,90501);
