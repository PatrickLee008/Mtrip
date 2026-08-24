-- 强制客户端连接字符集为 utf8mb4,防止中文注释乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量:注册业务单元 KYC 状态流转整改
-- 0 待办中 → 2 待核验 → 3 审核中 → 1 已验证；4 保留为已驳回终态
-- 库:mtrip_business
-- ============================================================
USE `mtrip_business`;

ALTER TABLE `merchant_application_business`
  MODIFY COLUMN `kyc_status` TINYINT NOT NULL DEFAULT 0
  COMMENT 'KYC状态:0待办中 1已验证 2待核验 3审核中 4已驳回';

-- 存量数据按当前流程阶段和文件状态校正；入驻阶段仅上传文件不再进入待核验。
UPDATE `merchant_application_business` b
JOIN `merchant_application` a ON a.id = b.application_id
LEFT JOIN `merchant_info` m ON m.id = a.merchant_id AND m.deleted_at IS NULL
SET b.kyc_status = CASE
  WHEN a.stage = 6 THEN 4
  WHEN m.status = 3 THEN 1
  WHEN a.stage = 5
    AND EXISTS (
      SELECT 1 FROM `merchant_verify_document` d
      WHERE d.application_id = b.application_id
        AND d.biz_unit = CAST(b.id AS CHAR)
        AND d.file_url <> ''
        AND d.deleted_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM `merchant_verify_document` d
      WHERE d.application_id = b.application_id
        AND d.biz_unit = CAST(b.id AS CHAR)
        AND d.status <> 1
        AND d.deleted_at IS NULL
    ) THEN 1
  WHEN a.stage = 5 THEN 3
  ELSE 0
END;
