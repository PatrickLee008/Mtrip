SET NAMES utf8mb4;

-- 客户钱包人工结算改为经办 + 复核(Super Admin PRD v1.0.14 客户 360 第 1743–1746 行 / 模块 25「手动钱包结算控制」)。
--
--   user_wallet_adjust_request   人工调账申请:经办人提交(状态 0 待复核)→ 另一位管理员复核通过即记账(1 已入账)/ 驳回(2)/
--                                记账失败(3,如扣减时余额已不足);request_no 唯一,防重复入账。
--                                冲正:对已入账的申请发起反向申请(reversal_of 指向原申请),同样需要复核;每笔只能冲正一次。
--   菜单按钮 101601              「复核调账」user:wallet:approve,挂在「钱包流水」页(1016)下,默认只授超管角色。
-- 「余额调整」(user:list:adjust-balance)保留为经办权限:提交后不再直接改余额。
-- 幂等:表 IF NOT EXISTS、菜单 / 授权 INSERT IGNORE。

USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `user_wallet_adjust_request` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `request_no`       VARCHAR(32)  NOT NULL COMMENT '申请单号(唯一,对账参考号)',
  `site_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '用户所属站点ID',
  `user_id`          BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `amount`           DECIMAL(12,2) NOT NULL COMMENT '调整金额(正增负减)',
  `reason`           VARCHAR(200) NOT NULL DEFAULT '' COMMENT '调整原因',
  `related_no`       VARCHAR(40)  NOT NULL DEFAULT '' COMMENT '关联预订号 / 退款单号(选填)',
  `reversal_of`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '冲正的原申请ID(0=普通申请)',
  `status`           TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待复核 1已入账 2已驳回 3记账失败',
  `requested_by`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '经办人ID',
  `requested_name`   VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '经办人',
  `reviewed_by`      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '复核人ID',
  `reviewed_name`    VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '复核人',
  `review_remark`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '复核意见 / 失败原因',
  `reviewed_at`      DATETIME     NULL DEFAULT NULL COMMENT '复核时间',
  `posted_log_id`    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '入账后的钱包流水 user_balance_log.id',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_request_no` (`request_no`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`, `id`),
  KEY `idx_reversal_of` (`reversal_of`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='钱包人工调账申请(经办 + 复核)';

USE `mtrip_system`;

INSERT IGNORE INTO sys_menu (id, parent_id, menu_name, menu_name_en, perm_key, menu_type, sort)
VALUES (101601, 1016, '复核调账', 'Approve Adjustment', 'user:wallet:approve', 3, 1);

INSERT IGNORE INTO sys_role_menu (role_id, menu_id) VALUES (1, 101601);
