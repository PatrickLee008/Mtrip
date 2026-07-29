-- ============================================================
-- 业务表 03 增量:C端用户手机号哈希检索列(模块09 移动端微服务)
-- mobile 为 AES-GCM 随机IV加密,密文不可等值检索;
-- 登录/注册按 mobile_hash = HMAC-SHA256(手机号, MTRIP_AES_KEY) 查找
-- ============================================================
USE `mtrip_business`;

ALTER TABLE `user_info`
  ADD COLUMN `mobile_hash` CHAR(64) NOT NULL DEFAULT '' COMMENT '手机号HMAC-SHA256哈希(检索用)' AFTER `mobile`,
  ADD UNIQUE KEY `uk_site_mobile_hash` (`site_id`, `mobile_hash`);
