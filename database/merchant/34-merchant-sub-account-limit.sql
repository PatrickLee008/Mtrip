SET NAMES utf8mb4;
USE `mtrip_business`;
-- ============================================================
-- 增量 34:子账号配额(管理端控制,默认 3)
-- 商户主账号(is_owner=1)不占配额;配额只约束 is_owner=0 的子账号。
-- account_type=2 商户 → merchant_info.sub_account_limit
-- account_type=1 集团 → merchant_group.sub_account_limit
-- account_type=3 门店 → 复用所属商户的 merchant_info.sub_account_limit
-- 幂等:information_schema 探测后再加列
-- ============================================================
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_info' AND COLUMN_NAME='sub_account_limit')=0, 'ALTER TABLE merchant_info ADD COLUMN sub_account_limit INT NOT NULL DEFAULT 3 COMMENT ''子账号数量上限(不含主账号)''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='merchant_group' AND COLUMN_NAME='sub_account_limit')=0, 'ALTER TABLE merchant_group ADD COLUMN sub_account_limit INT NOT NULL DEFAULT 3 COMMENT ''子账号数量上限(不含主账号)''', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
