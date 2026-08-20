-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [最新原型 localhost:8443 v4.2.1]:入驻阶段流程节点 4 → 6
-- 库:mtrip_business
--
-- 新阶段机(merchant_application.stage):
--   1 New Lead(新线索) → 2 Contacted(已联系) → 3 KYC Requested(已发送 KYC 信息)
--   → 4 Waiting for Documents(等待文件) → 5 Under Review(审核中)
--   → 6 Officially Approved(得到正式认可) / 7 Rejected(已驳回)
--
-- 旧 → 新迁移:
--   stage 4(Under Review) → 5
--   stage 5(Approved)     → 6
--   stage 6(Rejected)     → 7
--   重交标记(resubmit_required_at)语义不变:进行中(stage 1-5)且已要求重交 → Resubmission 队列
-- ============================================================
USE `mtrip_business`;

UPDATE `merchant_application`
SET `stage` = CASE
    WHEN `stage` = 4 THEN 5
    WHEN `stage` = 5 THEN 6
    WHEN `stage` = 6 THEN 7
    ELSE `stage`
END
WHERE `stage` IN (4, 5, 6);
