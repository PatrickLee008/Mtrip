SET NAMES utf8mb4;

-- KBZPay MMQR 接入阶段 2(方案 docs/plans/22-KBZPay-MMQR支付接入方案.md §4.3 / §5.1 / §6.1)
--
--   mtrip_system.sys_pay_account      收款账户(直连/服务商),敏感列存 AES 密文,可被多个站点共用
--   mtrip_system.sys_pay_channel      站点开通:新增 account_id / sub_merch_code / sub_app_id / sort,原 Stripe/PayPal 行不动
--   mtrip_system.sys_config           payment_window_minutes 默认 30;站点可在 sys_site_config 同 key 覆盖
--   mtrip_system.sys_menu             平台配置 → 收款账户(1313)及按钮 131301~131305,授权超管角色
--   mtrip_business.pay_transaction    支付流水 + 业务通知 outbox
--   mtrip_business.pay_refund         退款流水 + 业务通知 outbox
--   pay_method / finance_flow.pay_channel 新增取值 5 = KBZPay MMQR(只追加列注释,类型/默认值不变)
--   mtrip_business.order_refund       新增 pay_no / late_pay / channel_submit_status / channel_queued_at(KBZ 原路退款合并提交)
--
-- 幂等:CREATE TABLE IF NOT EXISTS;列/索引按 information_schema 判存在;种子 INSERT IGNORE;
--       注释追加以 COLUMN_COMMENT 不含 'KBZ' 为前提,并校验原列定义未漂移。

-- ============================================================
-- mtrip_system
-- ============================================================
USE `mtrip_system`;

CREATE TABLE IF NOT EXISTS `sys_pay_account` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '归属站点ID,0=平台共享',
  `channel_code`    VARCHAR(20)  NOT NULL DEFAULT 'kbz_mmqr' COMMENT '渠道标识:kbz_mmqr',
  `account_name`    VARCHAR(100) NOT NULL DEFAULT '' COMMENT '账户名称',
  `mode`            TINYINT      NOT NULL DEFAULT 1 COMMENT '模式:1直连单商户 2服务商',
  `env`             VARCHAR(10)  NOT NULL DEFAULT 'uat' COMMENT '环境:uat/prod',
  `app_id`          VARCHAR(64)  NOT NULL DEFAULT '' COMMENT 'KBZ AppID(服务商模式为服务商自身)',
  `merch_code`      VARCHAR(64)  NOT NULL DEFAULT '' COMMENT 'KBZ 商户号(服务商模式为服务商自身)',
  `app_key`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT '签名 AppKey(AES加密)',
  `cert_pem`        TEXT         NULL COMMENT '退款 mTLS 客户端证书 PEM(AES加密)',
  `key_pem`         TEXT         NULL COMMENT '退款 mTLS 私钥 PEM(AES加密)',
  `key_pwd`         VARCHAR(500) NOT NULL DEFAULT '' COMMENT '私钥密码(AES加密)',
  `ca_pem`          TEXT         NULL COMMENT 'CA 证书 PEM(AES加密)',
  `notify_base_url` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '回调基地址(https)',
  `status`          TINYINT      NOT NULL DEFAULT 1 COMMENT '状态:1启用 2停用',
  `remark`          VARCHAR(255) NOT NULL DEFAULT '' COMMENT '备注',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`      DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_site_id` (`site_id`),
  KEY `idx_channel_code` (`channel_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='支付收款账户表(直连/服务商,可多站点共用)';

-- sys_pay_channel 新增列(原数据不动;Stripe/PayPal 行 account_id 保持 NULL)
SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_system' AND TABLE_NAME = 'sys_pay_channel' AND COLUMN_NAME = 'account_id');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `sys_pay_channel` ADD COLUMN `account_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT ''收款账户ID(sys_pay_account.id,kbz_mmqr 使用;Stripe/PayPal 为 NULL)'' AFTER `channel_code`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_system' AND TABLE_NAME = 'sys_pay_channel' AND COLUMN_NAME = 'sub_merch_code');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `sys_pay_channel` ADD COLUMN `sub_merch_code` VARCHAR(64) NOT NULL DEFAULT '''' COMMENT ''子商户号(服务商模式必填,直连留空)'' AFTER `merchant_no`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_system' AND TABLE_NAME = 'sys_pay_channel' AND COLUMN_NAME = 'sub_app_id');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `sys_pay_channel` ADD COLUMN `sub_app_id` VARCHAR(64) NOT NULL DEFAULT '''' COMMENT ''子商户AppID(服务商模式必填,直连留空)'' AFTER `sub_merch_code`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_system' AND TABLE_NAME = 'sys_pay_channel' AND COLUMN_NAME = 'sort');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `sys_pay_channel` ADD COLUMN `sort` INT NOT NULL DEFAULT 0 COMMENT ''排序号'' AFTER `status`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'mtrip_system' AND TABLE_NAME = 'sys_pay_channel' AND INDEX_NAME = 'idx_account_id');
SET @ddl := IF(@index_exists = 0,
  'ALTER TABLE `sys_pay_channel` ADD INDEX `idx_account_id` (`account_id`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 支付窗口(分钟):先读站点 sys_site_config 同 key,无则读本行,都没有用 30
INSERT IGNORE INTO `sys_config` (`config_group`, `config_key`, `config_value`, `value_type`, `config_name`, `default_value`, `remark`) VALUES
('base', 'payment_window_minutes', '30', 2, '订单支付窗口(分钟)', '30', '待支付订单超时取消时长;站点可在站点配置中以同名 key 覆盖');

-- 菜单:平台配置 → 收款账户(与支付配置 sort 相同,按 id 紧随其后)
INSERT IGNORE INTO `sys_menu`
  (`id`,`parent_id`,`menu_name`,`menu_name_en`,`i18n_key`,`perm_key`,`menu_type`,`route_path`,`component`,`icon`,`sort`)
VALUES
  (1313,1300,'收款账户','Payment Accounts','menu.configPayAccount','config:payAccount:list',2,'/config/pay-account','config/pay-account/index','',4);
INSERT IGNORE INTO `sys_menu` (`id`,`parent_id`,`menu_name`,`menu_name_en`,`perm_key`,`menu_type`,`sort`) VALUES
  (131301,1313,'新增收款账户','Add Payment Account','config:payAccount:add',3,1),
  (131302,1313,'编辑收款账户','Edit Payment Account','config:payAccount:edit',3,2),
  (131303,1313,'启用禁用收款账户','Enable/Disable Payment Account','config:payAccount:status',3,3),
  (131304,1313,'删除收款账户','Delete Payment Account','config:payAccount:delete',3,4),
  (131305,1313,'测试收款账户连通性','Test Payment Account','config:payAccount:test',3,5);

INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT 1, `id` FROM `sys_menu`
WHERE `id` IN (1313,131301,131302,131303,131304,131305) AND `deleted_at` IS NULL;

-- ============================================================
-- mtrip_business
-- ============================================================
USE `mtrip_business`;

CREATE TABLE IF NOT EXISTS `pay_transaction` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `pay_no`             VARCHAR(32)  NOT NULL COMMENT '支付单号,即发给 KBZ 的 merch_order_id:P{yyMMddHHmmss}{6位}',
  `site_id`            BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '站点ID',
  `user_id`            BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '付款用户ID',
  `biz_type`           VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '业务类型:order/trip',
  `biz_no`             VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '业务单号',
  `channel_code`       VARCHAR(20)  NOT NULL DEFAULT 'kbz_mmqr' COMMENT '渠道标识(下单快照)',
  `account_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '收款账户ID快照(sys_pay_account.id),回调验签/退款按此取账户',
  `binding_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '站点开通ID快照(sys_pay_channel.id)',
  `amount`             DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '支付金额(回调比对用)',
  `currency`           VARCHAR(10)  NOT NULL DEFAULT 'MMK' COMMENT '币种(ISO 4217)',
  `subject`            VARCHAR(255) NOT NULL DEFAULT '' COMMENT '商品标题',
  `prepay_id`          VARCHAR(128) NOT NULL DEFAULT '' COMMENT 'KBZ prepay_id',
  `qr_code`            VARCHAR(1024) NOT NULL DEFAULT '' COMMENT '收款二维码内容',
  `expire_at`          DATETIME     NULL DEFAULT NULL COMMENT '二维码/支付过期时间',
  `channel_trade_no`   VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '渠道交易号(KBZ mm_order_id)',
  `status`             TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待支付 1成功 2失败 3过期/关闭 5迟到支付待处理',
  `paid_at`            DATETIME     NULL DEFAULT NULL COMMENT '支付成功时间',
  `late_paid`          TINYINT      NOT NULL DEFAULT 0 COMMENT '本地已关闭/失败后才确认支付:0否 1是(业务方决定恢复或退款)',
  `fail_reason`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '失败原因(渠道 code/msg)',
  `notify_raw`         TEXT         NULL COMMENT '渠道回调原文',
  `biz_notify_url`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '业务方通知地址(outbox)',
  `biz_notify_status`  TINYINT      NOT NULL DEFAULT 0 COMMENT '业务通知状态:0无需通知 1待通知 2已确认 3重试耗尽',
  `biz_notify_tries`   INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '业务通知已尝试次数',
  `biz_notify_next_at` DATETIME     NULL DEFAULT NULL COMMENT '业务通知下次重试时间',
  `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pay_no` (`pay_no`),
  KEY `idx_biz` (`biz_type`, `biz_no`),
  KEY `idx_status_expire` (`status`, `expire_at`),
  KEY `idx_biz_notify` (`biz_notify_status`, `biz_notify_next_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='支付流水表(含业务通知 outbox)';

CREATE TABLE IF NOT EXISTS `pay_refund` (
  `id`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `refund_no`          VARCHAR(32)  NOT NULL COMMENT '退款单号,即发给 KBZ 的 refund_request_no',
  `pay_no`             VARCHAR(32)  NOT NULL COMMENT '原支付单号(pay_transaction.pay_no)',
  `site_id`            BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '站点ID',
  `amount`             DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '退款金额',
  `currency`           VARCHAR(10)  NOT NULL DEFAULT 'MMK' COMMENT '币种(ISO 4217)',
  `reason`             VARCHAR(255) NOT NULL DEFAULT '' COMMENT '退款原因',
  `channel_refund_no`  VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '渠道退款单号',
  `status`             TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0处理中 1成功 2失败',
  `refunded_at`        DATETIME     NULL DEFAULT NULL COMMENT '退款成功时间',
  `fail_reason`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '失败原因(渠道 code/msg)',
  `notify_raw`         TEXT         NULL COMMENT '渠道退款响应/查询原文',
  `biz_notify_url`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '业务方通知地址(outbox)',
  `biz_notify_status`  TINYINT      NOT NULL DEFAULT 0 COMMENT '业务通知状态:0无需通知 1待通知 2已确认 3重试耗尽',
  `biz_notify_tries`   INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '业务通知已尝试次数',
  `biz_notify_next_at` DATETIME     NULL DEFAULT NULL COMMENT '业务通知下次重试时间',
  `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refund_no` (`refund_no`),
  KEY `idx_pay_no` (`pay_no`),
  KEY `idx_status` (`status`),
  KEY `idx_biz_notify` (`biz_notify_status`, `biz_notify_next_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='退款流水表(单笔支付成功退款最多 3 次;含业务通知 outbox)';

-- pay_method / pay_channel 新增取值 5:仅在列定义仍为 TINYINT NOT NULL DEFAULT 0 且注释未含 KBZ 时追加注释,
-- MODIFY 时原样保留类型/可空/默认值;定义已漂移则跳过(不冒险改结构)。
SET @col_comment := (SELECT COLUMN_COMMENT FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_main' AND COLUMN_NAME = 'pay_method'
    AND DATA_TYPE = 'tinyint' AND COLUMN_TYPE IN ('tinyint', 'tinyint(4)') AND IS_NULLABLE = 'NO'
    AND COLUMN_DEFAULT = '0' AND EXTRA = '' AND COLUMN_COMMENT NOT LIKE '%KBZ%');
SET @ddl := IF(@col_comment IS NULL, 'SELECT 1',
  CONCAT('ALTER TABLE `order_main` MODIFY COLUMN `pay_method` TINYINT NOT NULL DEFAULT 0 COMMENT ''',
         REPLACE(CONCAT(@col_comment, ' 5KBZPay MMQR'), '''', ''''''), ''''));
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_comment := (SELECT COLUMN_COMMENT FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_trip' AND COLUMN_NAME = 'pay_method'
    AND DATA_TYPE = 'tinyint' AND COLUMN_TYPE IN ('tinyint', 'tinyint(4)') AND IS_NULLABLE = 'NO'
    AND COLUMN_DEFAULT = '0' AND EXTRA = '' AND COLUMN_COMMENT NOT LIKE '%KBZ%');
SET @ddl := IF(@col_comment IS NULL, 'SELECT 1',
  CONCAT('ALTER TABLE `order_trip` MODIFY COLUMN `pay_method` TINYINT NOT NULL DEFAULT 0 COMMENT ''',
         REPLACE(CONCAT(@col_comment, ' 5KBZPay MMQR'), '''', ''''''), ''''));
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_comment := (SELECT COLUMN_COMMENT FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'finance_flow' AND COLUMN_NAME = 'pay_channel'
    AND DATA_TYPE = 'tinyint' AND COLUMN_TYPE IN ('tinyint', 'tinyint(4)') AND IS_NULLABLE = 'NO'
    AND COLUMN_DEFAULT = '0' AND EXTRA = '' AND COLUMN_COMMENT NOT LIKE '%KBZ%');
SET @ddl := IF(@col_comment IS NULL, 'SELECT 1',
  CONCAT('ALTER TABLE `finance_flow` MODIFY COLUMN `pay_channel` TINYINT NOT NULL DEFAULT 0 COMMENT ''',
         REPLACE(CONCAT(@col_comment, ' 5KBZPay MMQR'), '''', ''''''), ''''));
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- order_refund:KBZ 原路退款跟踪列(方案 22 §9.1 遗留 4 / 5;order_refund 为 mtrip_business 单表,不按月分表)
--   pay_no                 原支付单号(pay_transaction.pay_no;KBZ 原路退款 / 迟到支付退款才有值)
--   late_pay               1 = 迟到支付自动退款(钱未计入订单,完成时不动订单状态),替代旧 reason 前缀 [LATE_PAY:payNo]
--   channel_submit_status  0 不适用(钱包 / 人工)1 排队待提交 2 已提交支付中心 3 已转钱包(渠道退款次数达上限)
--   channel_queued_at      进入排队时间(合并窗口起点)
SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_refund' AND COLUMN_NAME = 'pay_no');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `order_refund` ADD COLUMN `pay_no` VARCHAR(32) NOT NULL DEFAULT '''' COMMENT ''原支付单号(KBZ 原路退款,pay_transaction.pay_no)'' AFTER `refund_trade_no`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_refund' AND COLUMN_NAME = 'late_pay');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `order_refund` ADD COLUMN `late_pay` TINYINT NOT NULL DEFAULT 0 COMMENT ''迟到支付自动退款:0否 1是(不计入订单已退金额,不阻塞商户退款)'' AFTER `pay_no`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_refund' AND COLUMN_NAME = 'channel_submit_status');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `order_refund` ADD COLUMN `channel_submit_status` TINYINT NOT NULL DEFAULT 0 COMMENT ''渠道提交状态:0不适用 1排队待提交 2已提交支付中心 3已转钱包'' AFTER `late_pay`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_refund' AND COLUMN_NAME = 'channel_queued_at');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `order_refund` ADD COLUMN `channel_queued_at` DATETIME NULL DEFAULT NULL COMMENT ''进入渠道退款排队时间(合并窗口起点)'' AFTER `channel_submit_status`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_refund' AND INDEX_NAME = 'idx_pay_no_submit');
SET @ddl := IF(@index_exists = 0,
  'ALTER TABLE `order_refund` ADD INDEX `idx_pay_no_submit` (`pay_no`, `channel_submit_status`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_refund' AND INDEX_NAME = 'idx_submit_queue');
SET @ddl := IF(@index_exists = 0,
  'ALTER TABLE `order_refund` ADD INDEX `idx_submit_queue` (`channel_submit_status`, `status`, `channel_queued_at`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'order_refund' AND INDEX_NAME = 'idx_refund_trade_no');
SET @ddl := IF(@index_exists = 0,
  'ALTER TABLE `order_refund` ADD INDEX `idx_refund_trade_no` (`refund_trade_no`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 回填(条件更新,可重复执行):旧版 reason 前缀 [LATE_PAY:P{18位}] 的迟到退款单;KBZ 订单原路退款单补 pay_no / 提交状态
UPDATE `order_refund`
   SET `late_pay` = 1, `pay_no` = SUBSTRING(`reason`, 11, 19)
 WHERE `late_pay` = 0 AND `reason` LIKE '[LATE_PAY:P%' AND SUBSTRING(`reason`, 30, 1) = ']';
UPDATE `order_refund` r
  JOIN `order_main` o ON o.`id` = r.`order_id`
   SET r.`pay_no` = o.`pay_trade_no`
 WHERE r.`pay_no` = '' AND r.`late_pay` = 0 AND r.`refund_channel` = 2 AND o.`pay_method` = 5 AND o.`pay_trade_no` LIKE 'P%';
UPDATE `order_refund`
   SET `channel_submit_status` = 2
 WHERE `channel_submit_status` = 0 AND `pay_no` <> '' AND `refund_trade_no` <> '' AND `status` IN (2, 3);
UPDATE `order_refund`
   SET `channel_submit_status` = 1, `channel_queued_at` = COALESCE(`platform_audit_time`, NOW())
 WHERE `channel_submit_status` = 0 AND `pay_no` <> '' AND `refund_trade_no` = '' AND `status` = 2;
