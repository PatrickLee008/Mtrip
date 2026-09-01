-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [Merchant App M4 酒店预订管理 §9.2]:聊天会话关联预订
-- 需求源:docs/plans/实现方案-Merchant-M4-酒店预订管理.md §9.2(住客消息复用客服会话能力)
-- 库:mtrip_business;幂等(守卫式 ALTER)
-- 说明:商户端 Message Guest 通过 order_id 定位/创建该预订的会话;
--       商户消息以 sender_type=2(坐席/酒店)写入,复用 C 端既有消息展示。
-- ============================================================
USE `mtrip_business`;

-- ---------- 1. chat_conversation 增加预订关联列 ----------
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='chat_conversation' AND COLUMN_NAME='order_id');
SET @ddl := IF(@col_exists=0, 'ALTER TABLE `chat_conversation` ADD COLUMN `order_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''关联预订(订单)ID,0=未关联'' AFTER `target_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------- 2. 关联索引(商户端按预订查会话) ----------
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='mtrip_business' AND TABLE_NAME='chat_conversation' AND INDEX_NAME='idx_order');
SET @ddl := IF(@idx_exists=0, 'ALTER TABLE `chat_conversation` ADD KEY `idx_order` (`order_id`)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
