-- 强制客户端连接字符集为 utf8mb4,防止中文注释乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量:业务单元 KYC 正式提交边界
-- 上传仅保存草稿；只有显式“提交核验”才进入待核验。
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

SET @has_kyc_submitted_at := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'merchant_application_business'
    AND COLUMN_NAME = 'kyc_submitted_at'
);
SET @sql := IF(
  @has_kyc_submitted_at = 0,
  'ALTER TABLE `merchant_application_business` ADD COLUMN `kyc_submitted_at` DATETIME NULL DEFAULT NULL COMMENT ''业务单元正式提交核验时间'' AFTER `kyc_status`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_kyc_submitted_by := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'merchant_application_business'
    AND COLUMN_NAME = 'kyc_submitted_by'
);
SET @sql := IF(
  @has_kyc_submitted_by = 0,
  'ALTER TABLE `merchant_application_business` ADD COLUMN `kyc_submitted_by` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''提交核验管理员ID'' AFTER `kyc_submitted_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 旧逻辑无法证明业务单元是否执行过正式提交，保守退回待办中，要求重新提交。
UPDATE `merchant_application_business` b
JOIN `merchant_application` a ON a.id = b.application_id
SET b.kyc_status = 0
WHERE a.stage < 5
  AND b.kyc_status = 2
  AND b.kyc_submitted_at IS NULL;
