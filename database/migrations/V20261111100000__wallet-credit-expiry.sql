SET NAMES utf8mb4;

-- mTrip 钱包额度有效期(Super Admin PRD v1.0.14 模块 25):每笔入账一个额度批次,按配置天数到期作废。
--
--   user_wallet_lot                 额度批次:每笔入账(退款 / 推荐返利 / 人工结算)一行,扣款按到期日最早优先扣减,
--                                   到期由 order-service 定时任务作废剩余额度并写 change_type 6「过期」流水。
--   user_balance_log.expires_at     入账流水上的到期时间(后台钱包流水展示用;扣款 / 过期流水为 NULL)。
--   sys_config 分组 wallet          有效天数 / 结账自动抵扣 / 酒店与汽车单笔最高可用金额,后台「全局配置 → wallet」维护。
--
-- 存量余额:每个 balance > 0 且还没有批次的用户补一个「期初」批次(change_type 0,金额 = 当前余额),
-- 到期日 = 本迁移执行时间 + 配置有效天数(避免上线即把老余额作废);有效天数为 0 时不设到期。
-- 幂等:表 IF NOT EXISTS、列按 information_schema 判存在、配置 INSERT IGNORE、期初批次只补没有批次的用户。

USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `user_wallet_lot` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID(入账流水的站点)',
  `user_id`       BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `source_log_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '来源入账流水 user_balance_log.id(期初批次为0)',
  `change_type`   TINYINT      NOT NULL DEFAULT 0 COMMENT '来源类型:0期初 1充值 3退款 4调账/推荐返利',
  `amount`        DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '入账金额',
  `remaining`     DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '剩余可用金额',
  `expires_at`    DATETIME     NULL DEFAULT NULL COMMENT '到期时间(NULL=永不过期)',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1有效 2已用完 3已过期',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_status_expires` (`user_id`, `status`, `expires_at`),
  KEY `idx_status_expires` (`status`, `expires_at`),
  KEY `idx_source_log` (`source_log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='用户钱包额度批次(按笔到期)';

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'user_balance_log' AND COLUMN_NAME = 'expires_at');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `user_balance_log` ADD COLUMN `expires_at` DATETIME NULL DEFAULT NULL COMMENT ''入账额度到期时间(仅入账流水)'' AFTER `remark`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `user_balance_log` MODIFY COLUMN `change_type` TINYINT NOT NULL DEFAULT 1 COMMENT '变动类型:1充值 2消费 3退款 4调账 5提现 6过期';

INSERT IGNORE INTO `mtrip_system`.`sys_config`
  (`config_group`, `config_key`, `config_value`, `value_type`, `config_name`, `default_value`, `remark`)
VALUES
  ('wallet', 'wallet_credit_validity_days', '365', 2, '钱包额度有效天数', '365', '新入账的每笔额度从入账起算,0 = 永不过期'),
  ('wallet', 'wallet_auto_apply',           '1',   3, '结账默认自动抵扣钱包', '1', '用户付款前仍可关闭'),
  ('wallet', 'wallet_max_use_hotel',        '0',   2, '酒店订单单笔最高可用钱包金额', '0', 'MMK,0 = 不限'),
  ('wallet', 'wallet_max_use_car',          '0',   2, '汽车订单单笔最高可用钱包金额', '0', 'MMK,0 = 不限');

SET @validity_days := (SELECT CAST(`config_value` AS SIGNED) FROM `mtrip_system`.`sys_config`
  WHERE `config_key` = 'wallet_credit_validity_days' AND `deleted_at` IS NULL LIMIT 1);

INSERT INTO `user_wallet_lot` (`site_id`, `user_id`, `source_log_id`, `change_type`, `amount`, `remaining`, `expires_at`, `status`)
SELECT u.`site_id`, u.`id`, 0, 0, u.`balance`, u.`balance`,
       IF(COALESCE(@validity_days, 365) > 0, DATE_ADD(NOW(), INTERVAL COALESCE(@validity_days, 365) DAY), NULL),
       1
FROM `user_info` u
WHERE u.`balance` > 0
  AND NOT EXISTS (SELECT 1 FROM `user_wallet_lot` l WHERE l.`user_id` = u.`id`);
