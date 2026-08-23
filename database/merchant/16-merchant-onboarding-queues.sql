-- 强制客户端连接字符集为 utf8mb4,防止容器内 mysql 客户端按 latin1 解析导致中文乱码
SET NAMES utf8mb4;

-- ============================================================
-- 增量 [最新原型 localhost:8443 v4.2.1]:Merchant Verification 四队列线索视图
-- 库:mtrip_business
--
-- 四队列口径(merchant_application):
--   pending       stage 1,2,3,5(不含等待文件)
--   approved      stage = 6
--   rejected      stage = 7
--   resubmission  stage = 4(等待文件,承接"退回商户修正重交"语义)
-- 注:重交标记列 resubmit_required_at 已由 stage 4 取代,不再建列;
--   已应用旧版本的环境由 18-merchant-onboarding-resubmit-cleanup.sql 守卫式清理。
-- ============================================================
USE `mtrip_business`;
