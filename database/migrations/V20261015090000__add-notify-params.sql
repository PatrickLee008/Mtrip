SET NAMES utf8mb4;

-- C 端站内通知(Consumer App PRD 模块 10)多语言化 + 新事件。
--
--   notify_record.params   事件变量 JSON(酒店名 / 订单号 / 入离日期 / 金额 / 申诉结果…)。
--                          App 按 event_key + params 用当前语言渲染文案(i18n notifications.events.*),
--                          title/content 仅存英文兜底(旧版本 App、后台排查用)。旧数据 params 为 NULL,App 回落到 title/content。
--   idx_event_biz          「离店 1 天后邀请评价」定时任务按 (event_key, biz_id) 判重:每个订单只发一次。
--
-- 唯一写入口:shared Mtrip\Shared\Support\UserNotify。幂等:列 / 索引按 information_schema 判存在。

USE `mtrip_business`;

SET @column_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'notify_record' AND COLUMN_NAME = 'params');
SET @ddl := IF(@column_exists = 0,
  'ALTER TABLE `notify_record` ADD COLUMN `params` JSON NULL COMMENT ''事件变量(App 按当前语言渲染文案)'' AFTER `event_key`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'notify_record' AND INDEX_NAME = 'idx_event_biz');
SET @ddl := IF(@index_exists = 0,
  'ALTER TABLE `notify_record` ADD KEY `idx_event_biz` (`event_key`, `biz_id`)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
