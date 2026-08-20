-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [最新原型 stir-long]:入驻阶段回归四节点流程
-- 库:mtrip_business
--
-- 新阶段机(merchant_application.stage):
--   1 New Lead(新线索) → 2 Contacted(已联系) → 3 KYC Access Granted(KYC访问权限已授予)
--   → 4 KYC In Progress(KYC进行中) → 5 Approved(得到正式认可) / 6 Rejected(已拒绝)
--
-- 迁移:
--   stage 5(Under Review,审核中) → 4(KYC In Progress,合并)
--   stage 6(Officially Approved) → 5(Approved)
--   stage 7(Rejected)            → 6(Rejected)
-- ============================================================
USE `mtrip_business`;

UPDATE `merchant_application`
SET `stage` = CASE
    WHEN `stage` = 5 THEN 4
    WHEN `stage` = 6 THEN 5
    WHEN `stage` = 7 THEN 6
    ELSE `stage`
END
WHERE `stage` IN (5, 6, 7);
