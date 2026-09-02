-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Merchant App M4 酒店预订管理]:预订字段、时间线、内部备注、同步任务/日志、门店商品授权
-- 需求源:docs/plans/实现方案-Merchant-M4-酒店预订管理.md 第 6 节
-- 库:mtrip_business;全部幂等(守卫式 ALTER / CREATE TABLE IF NOT EXISTS)
-- 兼容策略:保留 order_main.order_status 双写;新字段默认 0=旧订单兼容态,
--          由下方确定性回填规则一次性迁移,生命周期服务此后持续双写。
-- ============================================================
USE `mtrip_business`;

-- ---------- 1. order_main 新增预订字段(逐列守卫) ----------

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND COLUMN_NAME='booking_status');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `order_main` ADD COLUMN `booking_status` TINYINT NOT NULL DEFAULT 0 COMMENT ''预订状态:0旧数据兼容 1待支付 2已确认 3已入住 4已退房 5已取消 6未入住No-show'' AFTER `refund_status`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND COLUMN_NAME='payment_status');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `order_main` ADD COLUMN `payment_status` TINYINT NOT NULL DEFAULT 0 COMMENT ''支付状态:0旧数据兼容 1待支付 2已支付 3部分退款 4已退款 5支付失败'' AFTER `booking_status`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND COLUMN_NAME='booking_channel');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `order_main` ADD COLUMN `booking_channel` VARCHAR(20) NOT NULL DEFAULT '''' COMMENT ''预订渠道:mtrip在线 walkin到店付 phone电话 ota第三方'' AFTER `payment_status`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND COLUMN_NAME='channel_reference');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `order_main` ADD COLUMN `channel_reference` VARCHAR(64) NOT NULL DEFAULT '''' COMMENT ''渠道参考号(外部渠道订单)'' AFTER `booking_channel`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND COLUMN_NAME='payment_expires_at');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `order_main` ADD COLUMN `payment_expires_at` DATETIME NULL DEFAULT NULL COMMENT ''支付截止时间(创建后10分钟,超时自动取消释放库存)'' AFTER `channel_reference`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND COLUMN_NAME='confirmed_at');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `order_main` ADD COLUMN `confirmed_at` DATETIME NULL DEFAULT NULL COMMENT ''预订确认时间'' AFTER `payment_expires_at`, ADD COLUMN `checked_in_at` DATETIME NULL DEFAULT NULL COMMENT ''入住时间'' AFTER `confirmed_at`, ADD COLUMN `checked_out_at` DATETIME NULL DEFAULT NULL COMMENT ''退房时间'' AFTER `checked_in_at`, ADD COLUMN `no_show_at` DATETIME NULL DEFAULT NULL COMMENT ''No-show标记时间'' AFTER `checked_out_at`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND COLUMN_NAME='no_show_fee');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `order_main` ADD COLUMN `no_show_fee` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT ''No-show扣费金额(按政策快照)'' AFTER `no_show_at`, ADD COLUMN `no_show_waived` TINYINT NOT NULL DEFAULT 0 COMMENT ''No-show费用是否豁免:0否 1是'' AFTER `no_show_fee`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND COLUMN_NAME='assigned_room_no');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `order_main` ADD COLUMN `assigned_room_no` VARCHAR(50) NOT NULL DEFAULT '''' COMMENT ''分配房号(首期仅文本,无物理房间档案)'' AFTER `no_show_waived`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND COLUMN_NAME='meal_plan_snapshot');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `order_main` ADD COLUMN `meal_plan_snapshot` VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''餐食计划快照(下单时取自房型,无真实餐食则留空)'' AFTER `assigned_room_no`, ADD COLUMN `addon_snapshot` JSON NULL COMMENT ''附加服务快照'' AFTER `meal_plan_snapshot`, ADD COLUMN `special_requests` VARCHAR(1000) NOT NULL DEFAULT '''' COMMENT ''住客特殊请求'' AFTER `addon_snapshot`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND COLUMN_NAME='cancellation_policy_snapshot');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `order_main` ADD COLUMN `cancellation_policy_snapshot` JSON NULL COMMENT ''取消政策快照(下单时冻结,退款按此试算)'' AFTER `special_requests`, ADD COLUMN `no_show_policy_snapshot` JSON NULL COMMENT ''No-show政策快照'' AFTER `cancellation_policy_snapshot`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND COLUMN_NAME='pms_sync_status');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `order_main` ADD COLUMN `pms_sync_status` VARCHAR(20) NOT NULL DEFAULT ''not_connected'' COMMENT ''PMS同步状态:not_connected/pending/synced/failed'' AFTER `no_show_policy_snapshot`, ADD COLUMN `channel_sync_status` VARCHAR(20) NOT NULL DEFAULT ''not_connected'' COMMENT ''渠道管理器同步状态'' AFTER `pms_sync_status`, ADD COLUMN `version` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''乐观锁版本号(生命周期并发控制)'' AFTER `channel_sync_status`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 2. 索引(守卫式) ----------

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND INDEX_NAME='idx_booking_status');
SET @ddl := IF(@idx_exists=0, 'ALTER TABLE `order_main` ADD INDEX `idx_booking_status` (`booking_status`)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND INDEX_NAME='idx_payment_status');
SET @ddl := IF(@idx_exists=0, 'ALTER TABLE `order_main` ADD INDEX `idx_payment_status` (`payment_status`)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND INDEX_NAME='idx_booking_channel');
SET @ddl := IF(@idx_exists=0, 'ALTER TABLE `order_main` ADD INDEX `idx_booking_channel` (`booking_channel`)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND INDEX_NAME='idx_payment_expires_at');
SET @ddl := IF(@idx_exists=0, 'ALTER TABLE `order_main` ADD INDEX `idx_payment_expires_at` (`payment_expires_at`)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='order_main' AND INDEX_NAME='idx_site_merchant_goods_date');
SET @ddl := IF(@idx_exists=0, 'ALTER TABLE `order_main` ADD INDEX `idx_site_merchant_goods_date` (`site_id`, `merchant_id`, `goods_id`, `use_date`)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 3. 确定性回填(仅执行一次:以 booking_status=0 为未迁移标记) ----------

-- 3.1 状态双写回填:旧 order_status → 新 booking_status/payment_status
--     0待支付→待支付;1已支付→已确认/已支付;2已入住核销→已入住/已支付;3已完成→已退房/已支付;
--     4已取消(未付)→已取消/待支付;5退款中→已确认/已支付;6已退款→已确认/(全退4|部分3);7已过期→已取消/待支付
UPDATE `order_main` SET
  `booking_status` = CASE `order_status`
    WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 3 WHEN 3 THEN 4
    WHEN 4 THEN 5 WHEN 5 THEN 2 WHEN 7 THEN 5
    WHEN 6 THEN 2 ELSE 0 END,
  `payment_status` = CASE
    WHEN `order_status` = 6 THEN IF(`refund_status` = 3, 4, 3)
    WHEN `order_status` IN (0, 4, 7) THEN 1
    ELSE 2 END,
  `booking_channel` = 'mtrip',
  `payment_expires_at` = IF(`order_status` = 0 AND `payment_expires_at` IS NULL, DATE_ADD(`created_at`, INTERVAL 10 MINUTE), `payment_expires_at`),
  `confirmed_at` = IF(`pay_time` IS NOT NULL AND `confirmed_at` IS NULL, `pay_time`, `confirmed_at`),
  `checked_in_at` = IF(`order_status` IN (2, 3) AND `checked_in_at` IS NULL, `updated_at`, `checked_in_at`),
  `checked_out_at` = IF(`order_status` = 3 AND `checked_out_at` IS NULL, `updated_at`, `checked_out_at`)
WHERE `booking_status` = 0 AND `deleted_at` IS NULL;

-- 3.2 酒店订单特殊请求:沿用下单备注(确定性迁移,空备注不动)
UPDATE `order_main` SET `special_requests` = `remark`
WHERE `booking_status` > 0 AND `order_type` = 1 AND `remark` <> '' AND `special_requests` = '' AND `deleted_at` IS NULL;

-- 3.3 取消政策快照:按当前退改规则回填(房型级优先于商品级;此后下单冻结快照不再回填)
UPDATE `order_main` o
JOIN (
  SELECT r.`goods_id`, r.`sku_id`, r.`rule_type`, r.`rules`
  FROM (
    SELECT g.`goods_id`, g.`sku_id`, g.`rule_type`, g.`rules`,
           ROW_NUMBER() OVER (PARTITION BY g.`goods_id`, g.`sku_id` ORDER BY g.`sku_type` DESC) AS rn
    FROM `goods_refund_rule` g
    WHERE g.`deleted_at` IS NULL
  ) r WHERE r.rn = 1
) p ON p.`goods_id` = o.`goods_id` AND p.`sku_id` = o.`sku_id`
SET o.`cancellation_policy_snapshot` = JSON_OBJECT(
  'ruleType', p.`rule_type`,
  'rules', CASE WHEN p.`rules` IS NULL THEN JSON_ARRAY() ELSE p.`rules` END,
  'source', 'goods_refund_rule',
  'snapshotAt', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
)
WHERE o.`order_type` = 1 AND o.`cancellation_policy_snapshot` IS NULL AND o.`deleted_at` IS NULL;

-- ---------- 4. 预订时间线(不可覆盖的预订/支付/库存/退款/同步事件) ----------
CREATE TABLE IF NOT EXISTS `order_booking_event` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `order_id`        BIGINT UNSIGNED NOT NULL COMMENT '订单ID',
  `order_no`        VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '订单号(快照)',
  `merchant_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '商户ID',
  `event_category`  VARCHAR(20)  NOT NULL DEFAULT 'booking' COMMENT '事件分类:booking/payment/stock/refund/sync/note/security',
  `event_type`      VARCHAR(40)  NOT NULL COMMENT '事件类型:created/payment_success/payment_expired/confirmed/checked_in/checked_out/cancelled/no_show/room_assigned/refund_applied/refund_completed/note_added/sync_failed/guest_contact_viewed',
  `status`          TINYINT      NOT NULL DEFAULT 1 COMMENT '结果:1成功 2失败',
  `detail`          JSON         NULL COMMENT '事件明细(脱敏后)',
  `operator_type`   TINYINT      NOT NULL DEFAULT 0 COMMENT '操作方:0系统 1住客 2商户员工 3平台',
  `operator_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '操作人ID',
  `operator_name`   VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '操作人姓名(快照)',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '事件时间',
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`, `id`),
  KEY `idx_site_merchant` (`site_id`, `merchant_id`),
  KEY `idx_event_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='预订时间线(不可覆盖,永久审计)';

-- ---------- 5. 内部备注(商户员工可见,记录作者与编辑历史) ----------
CREATE TABLE IF NOT EXISTS `order_internal_note` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '商户ID',
  `order_id`      BIGINT UNSIGNED NOT NULL COMMENT '订单ID',
  `order_no`      VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '订单号(快照)',
  `content`       VARCHAR(2000) NOT NULL COMMENT '备注内容',
  `author_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '作者(商户管理员)ID',
  `author_name`   VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '作者姓名(快照)',
  `edited_at`     DATETIME     NULL DEFAULT NULL COMMENT '最后编辑时间',
  `edit_history`  JSON         NULL COMMENT '编辑历史([{content,editorId,editorName,editedAt}])',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`    DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  KEY `idx_order` (`order_id`),
  KEY `idx_site_merchant` (`site_id`, `merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='预订内部备注(仅酒店员工可见)';

-- ---------- 6. PMS/渠道同步任务(Outbox:重试次数、下次执行时间、幂等键) ----------
CREATE TABLE IF NOT EXISTS `order_sync_task` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '商户ID',
  `order_id`        BIGINT UNSIGNED NOT NULL COMMENT '订单ID',
  `order_no`        VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '订单号(快照)',
  `target`          VARCHAR(20)  NOT NULL DEFAULT 'pms' COMMENT '同步目标:pms/channel',
  `action`          VARCHAR(30)  NOT NULL DEFAULT 'create' COMMENT '同步动作:create/update/cancel/confirm/checkin/checkout',
  `status`          TINYINT      NOT NULL DEFAULT 0 COMMENT '状态:0待处理 1处理中 2成功 3失败(达上限)',
  `retry_count`     INT          NOT NULL DEFAULT 0 COMMENT '已重试次数',
  `max_retry`       INT          NOT NULL DEFAULT 5 COMMENT '最大重试次数',
  `next_retry_at`   DATETIME     NULL DEFAULT NULL COMMENT '下次执行时间',
  `idempotency_key` VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '幂等键(同目标同键不重复入队)',
  `payload`         JSON         NULL COMMENT '同步载荷(订单摘要)',
  `last_error`      VARCHAR(500) NOT NULL DEFAULT '' COMMENT '最近一次失败原因(脱敏)',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_target_idem` (`target`, `idempotency_key`),
  KEY `idx_status_retry` (`status`, `next_retry_at`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='PMS/渠道同步任务(Outbox)';

-- ---------- 7. PMS/渠道同步日志(每次尝试一条) ----------
CREATE TABLE IF NOT EXISTS `order_sync_log` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `task_id`          BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '同步任务ID',
  `order_id`         BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '订单ID',
  `order_no`         VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '订单号(快照)',
  `target`           VARCHAR(20)  NOT NULL DEFAULT 'pms' COMMENT '同步目标:pms/channel',
  `action`           VARCHAR(30)  NOT NULL DEFAULT '' COMMENT '同步动作',
  `status`           TINYINT      NOT NULL DEFAULT 1 COMMENT '结果:1成功 2失败',
  `request_summary`  VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '请求摘要',
  `response_summary` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '响应摘要',
  `error_message`    VARCHAR(500) NOT NULL DEFAULT '' COMMENT '错误信息(脱敏)',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '尝试时间',
  PRIMARY KEY (`id`),
  KEY `idx_task` (`task_id`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='PMS/渠道同步日志';

-- ---------- 8. 门店/酒店子账号商品授权(预订数据按获授权商品收窄) ----------
CREATE TABLE IF NOT EXISTS `merchant_store_goods` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `site_id`     BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属站点ID',
  `merchant_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '商户ID',
  `store_id`    BIGINT UNSIGNED NOT NULL COMMENT '门店(酒店)ID',
  `goods_id`    BIGINT UNSIGNED NOT NULL COMMENT '获授权商品(酒店)ID',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at`  DATETIME     NULL DEFAULT NULL COMMENT '删除时间(软删)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_goods` (`store_id`, `goods_id`),
  KEY `idx_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='门店子账号获授权商品范围(预订按此收窄)';
