SET NAMES utf8mb4;

-- Consumer App PRD 模块 19「mTrip 账户删除」。
--
--   user_account_deletion  每个注销流程一行:
--                          status 1 客服已批准没收余额(等用户在 App 内确认注销,approval_expires_at 前有效)
--                                 2 已注销(closed_at 起保留 90 天,purge_after 到期后由定时任务匿名化 → purged_at)
--                                 3 批准已撤销
--                          注销时把 mobile_hash / email_hash / 社交身份从 user_info / user_social_identity 解绑并归档在这里,
--                          同一手机号 / 邮箱 / 社交账号可以注册新账号,新账号不会恢复旧数据。
--   user_wallet_forfeit    「已没收 mTrip 钱包余额台账」(PRD 模块 19 第 8 条):会计 / 审计用,每次注销最多一行;
--                          对应钱包流水 change_type 7(WalletLedger::TYPE_FORFEITED),批次状态 4 已没收。
--   菜单按钮 100104        「批准注销(没收余额)」user:list:approve-deletion,挂在用户目录(1001)下,默认只授超管角色。
-- 幂等:表 IF NOT EXISTS、菜单 / 授权 INSERT IGNORE。

USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `user_account_deletion` (
  `id`                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`              BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '用户所属站点ID',
  `user_id`              BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `status`               TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1已批准待用户注销 2已注销 3批准已撤销',
  `approved_balance`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '客服批准没收时的钱包余额(上限)',
  `approve_reason`       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '批准原因 / 核实记录',
  `approved_by`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '批准人ID',
  `approved_name`        VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '批准人',
  `approved_at`          DATETIME     NULL DEFAULT NULL COMMENT '批准时间',
  `approval_expires_at`  DATETIME     NULL DEFAULT NULL COMMENT '批准有效期',
  `forfeited_amount`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '实际没收金额',
  `closed_at`            DATETIME     NULL DEFAULT NULL COMMENT '注销时间',
  `purge_after`          DATETIME     NULL DEFAULT NULL COMMENT '数据保留截止(注销 + 90 天)',
  `purged_at`            DATETIME     NULL DEFAULT NULL COMMENT '匿名化完成时间',
  `archived_mobile_hash` CHAR(64)     NULL DEFAULT NULL COMMENT '注销前的 mobile_hash(保留期内审计用,匿名化时清空)',
  `archived_email_hash`  CHAR(64)     NULL DEFAULT NULL COMMENT '注销前的 email_hash(同上)',
  `archived_identities`  JSON         NULL COMMENT '注销前解绑的社交登录身份(同上)',
  `client_ip`            VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '用户发起注销的IP',
  `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_status` (`user_id`, `status`),
  KEY `idx_purge` (`status`, `purged_at`, `purge_after`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='C端账户注销(批准 / 注销 / 90 天保留)';

CREATE TABLE IF NOT EXISTS `user_wallet_forfeit` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '用户所属站点ID',
  `user_id`         BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `deletion_id`     BIGINT UNSIGNED NOT NULL COMMENT 'user_account_deletion.id',
  `amount`          DECIMAL(12,2) NOT NULL COMMENT '没收金额(正数)',
  `balance_log_id`  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '对应钱包流水 user_balance_log.id(change_type 7)',
  `approved_by`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '批准人ID',
  `approved_name`   VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '批准人',
  `reason`          VARCHAR(255) NOT NULL DEFAULT '' COMMENT '批准原因',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '没收时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_deletion` (`deletion_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_site_created` (`site_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='已没收 mTrip 钱包余额台账(账户注销)';

USE `mtrip_system`;

INSERT IGNORE INTO sys_menu (id, parent_id, menu_name, menu_name_en, perm_key, menu_type, sort)
VALUES (100104, 1001, '批准注销(没收余额)', 'Approve Deletion (Forfeit Wallet)', 'user:list:approve-deletion', 3, 4);

INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 100104);
