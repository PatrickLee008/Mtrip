-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 清理 [最新原型 localhost:8443 v4.2.1]:废弃重交标记列
-- 库:mtrip_business
--
-- 入驻阶段 6 节点后,「等待文件」为正式 stage 4,重交队列口径改为 stage=4,
-- 原 resubmit_required_at 标记列废弃,守卫式删除(仅已应用旧 16 号脚本的环境有该列)。
-- ============================================================
USE `mtrip_business`;

-- 存量重交标记的进行中线索 → 等待文件(stage 4),保持 Resubmission 队列成员
UPDATE `merchant_application`
SET `stage` = 4
WHERE `resubmit_required_at` IS NOT NULL AND `stage` BETWEEN 1 AND 5;

-- 删除索引
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_application' AND INDEX_NAME = 'idx_resubmit');
SET @ddl := IF(@idx_exists > 0,
  'ALTER TABLE `merchant_application` DROP INDEX `idx_resubmit`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 删除列
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'mtrip_business' AND TABLE_NAME = 'merchant_application' AND COLUMN_NAME = 'resubmit_required_at');
SET @ddl := IF(@col_exists > 0,
  'ALTER TABLE `merchant_application` DROP COLUMN `resubmit_required_at`',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
